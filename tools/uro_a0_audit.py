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
TEXT_EXT = {
    ".py", ".pyi", ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".html",
    ".htm", ".css", ".scss", ".sass", ".less", ".sql", ".sh", ".bash",
    ".zsh", ".yml", ".yaml", ".toml", ".json", ".md", ".txt", ".log",
    ".sol", ".rs", ".go", ".java", ".kt", ".swift", ".c", ".h", ".cpp",
    ".hpp", ".m", ".mm", ".xml", ".svg", ".ini", ".cfg", ".conf",
    ".env", ".properties", ".graphql", ".proto", ".make", ".mk", ".lock",
}
REQUIRED_REPOS = {
    "Erdemhasates35/quantum-nexus-os": "Quantum Nexus OS",
    "Erdemhasates35/heretic": "Heretic fork/reference",
}


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
    patterns = [
        re.compile(r"\bfunction\s+([A-Za-z_$][\w$]*)\s*\("),
        re.compile(r"\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>"),
        re.compile(r"\b([A-Za-z_$][\w$]*)\s*:\s*(?:async\s*)?function\s*\("),
        re.compile(r"\b(?:pub\s+)?(?:async\s+)?fn\s+([A-Za-z_]\w*)\s*\("),
        re.compile(r"\bfunc\s+(?:\([^)]*\)\s*)?([A-Za-z_]\w*)\s*\("),
        re.compile(r"(?m)^\s*(?:static\s+)?(?:inline\s+)?(?:[\w:*&<>\[\]]+\s+)+([A-Za-z_]\w*)\s*\([^;{}]*\)\s*(?:const\s*)?\{"),
    ]
    seen_functions = set()
    for pattern in patterns:
        for match in pattern.finditer(text):
            line_no = text.count("\n", 0, match.start()) + 1
            key = (match.group(1), line_no)
            if key not in seen_functions:
                functions.append({"name": key[0], "line": line_no})
                seen_functions.add(key)
    type_pattern = re.compile(r"\b(?:class|struct|contract|interface|library|enum)\s+([A-Za-z_]\w*)")
    types = [{"name": m.group(1), "line": text.count("\n", 0, m.start()) + 1}
             for m in type_pattern.finditer(text)]
    ids = [{"value": m.group(1), "line": text.count("\n", 0, m.start()) + 1}
           for m in re.finditer(r'\bid\s*=\s*["\']([^"\']+)["\']', text)]
    classes = [{"value": m.group(1), "line": text.count("\n", 0, m.start()) + 1}
               for m in re.finditer(r'\bclass\s*=\s*["\']([^"\']+)["\']', text)]
    css_classes = [{"value": m.group(1), "line": text.count("\n", 0, m.start()) + 1}
                   for m in re.finditer(r"(?m)(?:^|[}\s])\.([A-Za-z_-][\w-]*)", text)]
    components = [{"name": name, "line": line}
                  for name, line in sorted(seen_functions) if name[:1].isupper()]
    return {
        "functions": sorted(functions, key=lambda x: (x["line"], x["name"])),
        "types": types,
        "react_component_candidates": components,
        "html_ids": ids,
        "html_classes": classes,
        "css_class_selectors": css_classes,
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


def fetch_blob(repo: str, entry: dict, token: str) -> dict:
    path, sha, size = entry["path"], entry["sha"], entry.get("size", 0)
    record = {"path": path, "sha": sha, "size_bytes": size, "mode": entry.get("mode"), "type": entry.get("type")}
    if Path(path).suffix.lower() in {".gz", ".pcap", ".png", ".jpg", ".jpeg", ".gif", ".ico", ".zip", ".tar", ".pdf", ".pyc", ".wasm", ".so", ".dll", ".exe", ".o", ".a", ".pack"}:
        record.update({"content_class": "binary_by_extension", "semantic_scan": "not_applicable"})
        return record
    blob = api_json(f"{API}/repos/{repo}/git/blobs/{sha}", token)
    encoded = blob.get("content", "")
    if size == 0:
        record.update({"content_class": "empty_text", "semantic_scan": "complete", **scan_text(path, "")})
        return record
    if blob.get("encoding") != "base64" or not encoded:
        record.update({"content_class": "unavailable", "semantic_scan": "incomplete", "scan_error": "blob content unavailable"})
        return record
    try:
        raw = base64.b64decode(encoded, validate=False)
        text = raw.decode("utf-8")
    except (ValueError, UnicodeDecodeError):
        record.update({"content_class": "binary", "semantic_scan": "not_applicable"})
        return record
    record["content_class"] = "text"
    record["semantic_scan"] = "complete"
    record.update(scan_text(path, text))
    return record


def audit_repo(repo: str, label: str, token: str) -> dict:
    metadata = api_json(f"{API}/repos/{repo}", token)
    branch = metadata["default_branch"]
    tree = api_json(f"{API}/repos/{repo}/git/trees/{quote(branch, safe='')}?recursive=1", token)
    blobs = [entry for entry in tree.get("tree", []) if entry.get("type") == "blob"]
    records = []
    errors = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        futures = {pool.submit(fetch_blob, repo, entry, token): entry["path"] for entry in blobs}
        for future in concurrent.futures.as_completed(futures):
            path = futures[future]
            try:
                records.append(future.result())
            except Exception as exc:
                errors.append({"path": path, "error": f"{type(exc).__name__}: {exc}"})
    records.sort(key=lambda item: item["path"])
    numeric_count = sum(len(item.get("numeric_literals", [])) for item in records)
    alpha_count = sum(len(item.get("alpha_references", [])) for item in records)
    text_count = sum(1 for item in records if item.get("content_class") == "text")
    incomplete = [item["path"] for item in records if item.get("semantic_scan") == "incomplete"]
    return {
        "repository": repo,
        "label": label,
        "is_fork": bool(metadata.get("fork", False)),
        "parent_repository": (metadata.get("parent") or {}).get("full_name"),
        "license_spdx": (metadata.get("license") or {}).get("spdx_id"),
        "default_branch": branch,
        "commit_sha": tree.get("sha"),
        "tree_truncated": bool(tree.get("truncated", False)),
        "blob_count": len(blobs),
        "gitlinks": [{"path": item.get("path"), "sha": item.get("sha")} for item in tree.get("tree", []) if item.get("type") == "commit" or item.get("mode") == "160000"],
        "gitmodules_present": any(item.get("path") == ".gitmodules" and item.get("type") == "blob" for item in tree.get("tree", [])),
        "structural_findings": ([{"code": "GITLINKS_WITHOUT_GITMODULES", "severity": "warning", "message": "Tracked gitlinks exist but .gitmodules is absent; submodule URLs cannot be inferred safely.", "paths": [item.get("path") for item in tree.get("tree", []) if item.get("type") == "commit" or item.get("mode") == "160000"]}] if any(item.get("type") == "commit" or item.get("mode") == "160000" for item in tree.get("tree", [])) and not any(item.get("path") == ".gitmodules" and item.get("type") == "blob" for item in tree.get("tree", [])) else []),
        "text_file_count": text_count,
        "binary_or_nontext_count": len(records) - text_count,
        "numeric_literal_count": numeric_count,
        "alpha_reference_count": alpha_count,
        "alpha_identifier_count": sum(len(item.get("alpha_identifiers", [])) for item in records),
        "claim_candidate_count": sum(len(item.get("claim_candidates", [])) for item in records),
        "incomplete_paths": incomplete,
        "fetch_errors": errors,
        "files": records,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", default="uro_a0_inventory.json")
    args = parser.parse_args()
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if not token:
        print("GITHUB_TOKEN or GH_TOKEN is required", file=sys.stderr)
        return 2
    reports = []
    for repo, label in REQUIRED_REPOS.items():
        reports.append(audit_repo(repo, label, token))
    complete = all(
        not report["tree_truncated"] and not report["incomplete_paths"] and not report["fetch_errors"]
        for report in reports
    )
    payload = {
        "schema_version": "uro-a0-inventory.v1",
        "execution_context": {"commit_sha": os.environ.get("GITHUB_SHA"), "ref": os.environ.get("GITHUB_REF"), "workflow": os.environ.get("GITHUB_WORKFLOW")},
        "scope": "all tracked blobs on each default branch; text files semantically scanned; binary files inventoried; the scanner execution ref is recorded separately",
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
            "incomplete_paths": report["incomplete_paths"],
            "fetch_errors": report["fetch_errors"],
        } for report in reports],
    }
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if complete else 1


if __name__ == "__main__":
    raise SystemExit(main())
