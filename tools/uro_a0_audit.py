#!/usr/bin/env python3
"""Read-only, reproducible URO A0 source-tree and literal inventory auditor."""
from __future__ import annotations

import argparse
import ast
import base64
import concurrent.futures
import json
import os
import re
import sys
import subprocess
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

API = "https://api.github.com"
USER_AGENT = "URO-A0-ReadOnly-Auditor/1.0"
NUMBER_RE = re.compile(r"(?<![\w.])[-+]?(?:0[xX][0-9a-fA-F_]+|(?:\d[\d_]*(?:\.[\d_]*)?|\.[\d_]+)(?:[eE][-+]?\d[\d_]*)?)(?![\w.])")
ALPHA_RE = re.compile(r"α|\bfine[-_ ]?structure\b|\balpha\b", re.IGNORECASE)
ALPHA_IDENTIFIER_RE = re.compile(r"\balpha(?:_[A-Za-z0-9_]+|[0-9]+)\b", re.IGNORECASE)
PY_EXT = {".py", ".pyi"}
BINARY_EXT = {".gz", ".pcap", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".zip", ".tar", ".pdf", ".pyc", ".wasm", ".so", ".dll", ".exe", ".o", ".a", ".pack"}
TEXT_EXT = {
    ".py", ".pyi", ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".html",
    ".htm", ".css", ".scss", ".sass", ".less", ".sql", ".sh", ".bash",
    ".zsh", ".yml", ".yaml", ".toml", ".json", ".md", ".txt", ".log",
    ".sol", ".rs", ".go", ".java", ".kt", ".swift", ".c", ".h", ".cpp",
    ".hpp", ".m", ".mm", ".xml", ".svg", ".ini", ".cfg", ".conf",
    ".env", ".properties", ".graphql", ".proto", ".make", ".mk", ".lock",
}
REPOSITORIES = [
    {
        "repository": "Erdemhasates35/quantum-nexus-os",
        "label": "Quantum Nexus OS",
        "directory": ".",
        "default_branch": "main",
        "is_fork": False,
        "parent_repository": None,
        "license_spdx": "MIT",
    },
    {
        "repository": "Erdemhasates35/heretic",
        "label": "Heretic fork/reference",
        "directory": "heretic-reference",
        "default_branch": "master",
        "is_fork": True,
        "parent_repository": "p-e-w/heretic",
        "license_spdx": "AGPL-3.0",
    },
]


class AuditError(RuntimeError):
    pass


def api_json(url: str, token: str) -> dict:
    headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": f"Bearer {token}",
        "User-Agent": USER_AGENT,
        "X-GitHub-Api-Version": "2022-11-28",
    }
    for attempt in range(5):
        try:
            with urlopen(Request(url, headers=headers), timeout=45) as response:
                return json.loads(response.read().decode("utf-8"))
        except HTTPError as exc:
            if exc.code in (403, 429, 500, 502, 503, 504) and attempt < 4:
                retry = exc.headers.get("Retry-After", "")
                delay = int(retry) if retry.isdigit() else min(2 ** attempt, 30)
                time.sleep(max(1, delay))
                continue
            raise AuditError(f"GitHub API HTTP {exc.code}: {url}") from None
        except (URLError, TimeoutError, json.JSONDecodeError) as exc:
            if attempt < 4:
                time.sleep(min(2 ** attempt, 30))
                continue
            raise AuditError(f"GitHub API request failed: {type(exc).__name__}") from None
    raise AuditError("GitHub API retry budget exhausted")


def extract_python_symbols(text: str) -> dict:
    try:
        tree = ast.parse(text)
    except SyntaxError as exc:
        return {"parse_error": f"SyntaxError:{exc.lineno}:{exc.msg}", "functions": [], "classes": []}
    functions, classes = [], []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            functions.append({"name": node.name, "line": node.lineno, "kind": "async" if isinstance(node, ast.AsyncFunctionDef) else "function"})
        elif isinstance(node, ast.ClassDef):
            classes.append({"name": node.name, "line": node.lineno})
    return {"functions": sorted(functions, key=lambda x: (x["line"], x["name"])), "classes": sorted(classes, key=lambda x: (x["line"], x["name"]))}


def extract_web_symbols(text: str, suffix: str) -> dict:
    functions = []
    types = []
    ids = []
    classes = []
    css_classes = []
    long_lines_skipped = 0
    js_patterns = [
        re.compile(r"\bfunction\s+([A-Za-z_$][\w$]*)\s*\("),
        re.compile(r"\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>"),
        re.compile(r"\b([A-Za-z_$][\w$]*)\s*:\s*(?:async\s*)?function\s*\("),
    ]
    rust_pattern = re.compile(r"\b(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z_]\w*)\s*\(")
    go_pattern = re.compile(r"\bfunc\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)\s*\(")
    c_pattern = re.compile(r"^\s*(?:static\s+)?(?:inline\s+)?(?:[\w:*&<>\[\]]+\s+)+([A-Za-z_]\w*)\s*\([^;{}]{0,2000}\)\s*(?:const\s*)?\{")
    type_pattern = re.compile(r"\b(?:class|struct|contract|interface|library|enum)\s+([A-Za-z_]\w*)")
    html_id_pattern = re.compile(r'\bid\s*=\s*["\']([^"\']+)["\']')
    html_class_pattern = re.compile(r'\bclass\s*=\s*["\']([^"\']+)["\']')
    css_pattern = re.compile(r"(?m)(?:^|[}\s])\.([A-Za-z_-][\w-]*)")

    js_ext = {".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx"}
    c_ext = {".c", ".h", ".cpp", ".hpp", ".m", ".mm", ".java", ".kt", ".swift", ".sol"}
    for line_no, line in enumerate(text.splitlines(), 1):
        if len(line) > 10000:
            long_lines_skipped += 1
            continue
        patterns = []
        if suffix in js_ext:
            patterns.extend(js_patterns)
        if suffix == ".rs":
            patterns.append(rust_pattern)
        if suffix == ".go":
            patterns.append(go_pattern)
        if suffix in c_ext:
            if suffix == ".sol":
                patterns.append(re.compile(r"\bfunction\s+([A-Za-z_]\w*)\s*\("))
            patterns.append(c_pattern)
        for pattern in patterns:
            for match in pattern.finditer(line):
                functions.append({"name": match.group(1), "line": line_no})
        for match in type_pattern.finditer(line):
            types.append({"name": match.group(1), "line": line_no})
        if suffix in {".html", ".htm", ".jsx", ".tsx"}:
            ids.extend({"value": m.group(1), "line": line_no} for m in html_id_pattern.finditer(line))
            classes.extend({"value": m.group(1), "line": line_no} for m in html_class_pattern.finditer(line))
        if suffix in {".css", ".scss", ".sass", ".less", ".html", ".htm"}:
            css_classes.extend({"value": m.group(1), "line": line_no} for m in css_pattern.finditer(line))

    seen = set()
    unique_functions = []
    for item in functions:
        key = (item["name"], item["line"])
        if key not in seen:
            unique_functions.append(item)
            seen.add(key)
    components = [{"name": item["name"], "line": item["line"]}
                  for item in unique_functions if item["name"][:1].isupper()]
    return {
        "functions": sorted(unique_functions, key=lambda x: (x["line"], x["name"])),
        "types": types,
        "react_component_candidates": components,
        "html_ids": ids,
        "html_classes": classes,
        "css_class_selectors": css_classes,
        "long_lines_skipped": long_lines_skipped,
    }
CLAIM_TERMS = re.compile(
    r"\b(?:live|production|verified|real|atomic|zero[- ]?loss|zero[- ]?downtime|"
    r"fully|complete|secure|compliant|supports|implements|ensures|guarantees|"
    r"prevents|autonomous|real[- ]time|reproducible|deterministic)\b",
    re.IGNORECASE,
)


def extract_claim_candidates(path: str, text: str) -> list[dict]:
    suffix = Path(path).suffix.lower()
    claims = []
    for line_no, line in enumerate(text.splitlines(), 1):
        stripped = line.strip()
        if not stripped:
            continue
        if suffix in {".md", ".rst", ".txt"}:
            claims.append({
                "line": line_no,
                "kind": "prose_statement",
                "tag": "[UNVERIFIED — source statement; evidence review required]",
                "context": stripped[:500],
            })
            continue
        if suffix in {".html", ".htm"}:
            visible = re.sub(r"<[^>]*>", " ", stripped)
            visible = re.sub(r"\s+", " ", visible).strip()
            if visible and len(visible) > 8:
                claims.append({
                    "line": line_no,
                    "kind": "html_text_candidate",
                    "tag": "[UNVERIFIED — rendered text claim; evidence review required]",
                    "context": visible[:500],
                })
                continue
        is_comment = bool(re.match(r"^\s*(?:#|//|/\*|\*|--|///|//!|<!--)", line))
        if is_comment or CLAIM_TERMS.search(line):
            claims.append({
                "line": line_no,
                "kind": "comment_or_assertion_candidate",
                "tag": "[UNVERIFIED — code/comment claim; runtime evidence required]",
                "context": stripped[:500],
            })
    return claims
def scan_text(path: str, text: str) -> dict:
    numeric, alpha, alpha_identifiers = [], [], []
    for line_no, line in enumerate(text.splitlines(), 1):
        for match in NUMBER_RE.finditer(line):
            numeric.append({"line": line_no, "literal": match.group(0), "tag": "[GERÇEK — source literal; live measurement not implied]", "context": line.strip()[:500]})
        for match in ALPHA_RE.finditer(line):
            context = line.strip()[:500]
            folded = line.casefold()
            tag = ("[GERÇEK — physical constant reference text]" if "fine-structure" in folded or "scientific reference" in folded else "[KALDIRILACAK — legacy architecture claim]" if "coupling" in folded or "efficiency" in folded else "[SEMBOLIK — parameter, branding, or domain term]")
            alpha.append({"line": line_no, "match": match.group(0), "tag": tag, "context": context})
        for match in ALPHA_IDENTIFIER_RE.finditer(line):
            alpha_identifiers.append({"line": line_no, "match": match.group(0), "context": line.strip()[:500]})
    suffix = Path(path).suffix.lower()
    symbols = extract_python_symbols(text) if suffix in PY_EXT else extract_web_symbols(text, suffix)
    claims = extract_claim_candidates(path, text)
    return {"numeric_literals": numeric, "alpha_references": alpha, "alpha_identifiers": alpha_identifiers, "claim_candidates": claims, "symbols": symbols}


def audit_repo(config: dict, workspace: Path) -> dict:
    directory = (workspace / config["directory"]).resolve()
    if not directory.is_dir():
        raise RuntimeError(f"Checked-out repository directory missing: {config['directory']}")
    commit_sha = subprocess.run(
        ["git", "-C", str(directory), "rev-parse", "HEAD"],
        check=True, capture_output=True, text=True,
    ).stdout.strip()
    raw_tree = subprocess.run(
        ["git", "-C", str(directory), "ls-tree", "-r", "-z", "HEAD"],
        check=True, capture_output=True,
    ).stdout
    entries = [item for item in raw_tree.split(b"\0") if item]
    files, gitlinks, missing_paths, fetch_errors = [], [], [], []

    for entry in entries:
        metadata, raw_path = entry.split(b"\t", 1)
        mode, object_type, sha = metadata.decode("ascii").split()
        path = raw_path.decode("utf-8", errors="surrogateescape")
        if object_type == "commit" or mode == "160000":
            gitlinks.append({"path": path, "sha": sha})
            continue
        if object_type != "blob":
            continue

        local_path = directory / path
        record = {"path": path, "sha": sha, "mode": mode, "type": object_type}
        try:
            if mode == "120000":
                raw = os.readlink(local_path).encode("utf-8", errors="surrogateescape")
            else:
                if not local_path.is_file():
                    missing_paths.append(path)
                    record.update({"content_class": "missing_worktree_file", "semantic_scan": "incomplete"})
                    files.append(record)
                    continue
                raw = local_path.read_bytes()
            record["size_bytes"] = len(raw)
            suffix = Path(path).suffix.lower()
            if suffix in BINARY_EXT:
                record.update({"content_class": "binary_by_extension", "semantic_scan": "not_applicable"})
            elif not raw:
                record.update({"content_class": "empty_text", "semantic_scan": "complete", **scan_text(path, "")})
            else:
                try:
                    source = raw.decode("utf-8")
                except UnicodeDecodeError:
                    record.update({"content_class": "binary", "semantic_scan": "not_applicable"})
                else:
                    record.update({"content_class": "text", "semantic_scan": "complete", **scan_text(path, source)})
            files.append(record)
        except Exception as exc:
            fetch_errors.append({"path": path, "error": f"{type(exc).__name__}: {exc}"})

    files.sort(key=lambda item: item["path"])
    text_files = [item for item in files if item.get("content_class") in {"text", "empty_text"}]
    numeric_count = sum(len(item.get("numeric_literals", [])) for item in files)
    alpha_count = sum(len(item.get("alpha_references", [])) for item in files)
    alpha_identifier_count = sum(len(item.get("alpha_identifiers", [])) for item in files)
    claim_count = sum(len(item.get("claim_candidates", [])) for item in files)
    symbol_counts = {
        "functions": sum(len(item.get("symbols", {}).get("functions", [])) for item in files),
        "types": sum(len(item.get("symbols", {}).get("types", item.get("symbols", {}).get("classes", []))) for item in files),
        "react_component_candidates": sum(len(item.get("symbols", {}).get("react_component_candidates", [])) for item in files),
        "html_ids": sum(len(item.get("symbols", {}).get("html_ids", [])) for item in files),
        "html_classes": sum(len(item.get("symbols", {}).get("html_classes", [])) for item in files),
        "css_class_selectors": sum(len(item.get("symbols", {}).get("css_class_selectors", [])) for item in files),
    }
    gitmodules_present = (directory / ".gitmodules").is_file()
    structural_findings = []
    if gitlinks and not gitmodules_present:
        structural_findings.append({
            "code": "GITLINKS_WITHOUT_GITMODULES",
            "severity": "warning",
            "message": "Tracked gitlinks exist but .gitmodules is absent; submodule URLs cannot be inferred safely.",
            "paths": [item["path"] for item in gitlinks],
        })
    return {
        "repository": config["repository"],
        "label": config["label"],
        "is_fork": config["is_fork"],
        "parent_repository": config["parent_repository"],
        "license_spdx": config["license_spdx"],
        "default_branch": config["default_branch"],
        "commit_sha": commit_sha,
        "tree_truncated": False,
        "blob_count": len(files),
        "text_file_count": len(text_files),
        "binary_or_nontext_count": len(files) - len(text_files),
        "numeric_literal_count": numeric_count,
        "alpha_reference_count": alpha_count,
        "alpha_identifier_count": alpha_identifier_count,
        "claim_candidate_count": claim_count,
        "symbol_counts": symbol_counts,
        "gitmodules_present": gitmodules_present,
        "gitlinks": gitlinks,
        "structural_findings": structural_findings,
        "incomplete_paths": missing_paths,
        "fetch_errors": fetch_errors,
        "files": files,
    }
def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default="uro_a0_inventory.json")
    args = parser.parse_args()
    workspace = Path(os.environ.get("GITHUB_WORKSPACE", ".")).resolve()
    reports = [audit_repo(config, workspace) for config in REPOSITORIES]
    complete = all(not report["incomplete_paths"] and not report["fetch_errors"] for report in reports)
    payload = {
        "schema_version": "uro-a0-inventory.v1",
        "execution_context": {
            "commit_sha": os.environ.get("GITHUB_SHA"),
            "ref": os.environ.get("GITHUB_REF"),
            "workflow": os.environ.get("GITHUB_WORKFLOW"),
        },
        "scope": "all tracked Git blobs from the checked-out Nexus and Heretic snapshots; all UTF-8 text scanned; binary blobs inventoried",
        "complete": complete,
        "repositories": reports,
    }
    output = Path(args.output)
    with output.open("x", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    summary = {
        "complete": complete,
        "output": str(output),
        "repositories": [{
            "repository": report["repository"],
            "commit_sha": report["commit_sha"],
            "blob_count": report["blob_count"],
            "text_file_count": report["text_file_count"],
            "binary_or_nontext_count": report["binary_or_nontext_count"],
            "numeric_literal_count": report["numeric_literal_count"],
            "alpha_reference_count": report["alpha_reference_count"],
            "alpha_identifier_count": report["alpha_identifier_count"],
            "claim_candidate_count": report["claim_candidate_count"],
            "symbol_counts": report["symbol_counts"],
            "gitlinks": report["gitlinks"],
            "structural_findings": report["structural_findings"],
            "incomplete_paths": report["incomplete_paths"],
            "fetch_errors": report["fetch_errors"],
        } for report in reports],
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if complete else 1
if __name__ == "__main__":
    raise SystemExit(main())
