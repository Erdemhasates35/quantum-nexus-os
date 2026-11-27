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
        "snapshot_ref": "workflow_checkout",
        "is_fork": False,
        "parent_repository": None,
        "license_spdx": "MIT",
    },
    {
        "repository": "Erdemhasates35/heretic",
        "label": "Heretic fork/reference",
        "directory": "heretic-reference",
        "snapshot_ref": "refs/heads/master",
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
    """Return heuristic high-impact claims, not every prose line."""
    suffix = Path(path).suffix.lower()
    claims = []
    for line_no, line in enumerate(text.splitlines(), 1):
        stripped = line.strip()
        if not stripped or stripped.startswith(("#", "|---", "<!--")):
            continue
        candidate_text = stripped
        kind = "comment_or_assertion_candidate"
        if suffix in {".html", ".htm"}:
            candidate_text = re.sub(r"<[^>]*>", " ", stripped)
            candidate_text = re.sub(r"\s+", " ", candidate_text).strip()
            kind = "html_text_candidate"
        elif suffix in {".md", ".rst", ".txt"}:
            kind = "prose_statement"
        else:
            is_comment = bool(re.match(r"^\s*(?:#|//|/\*|\*|--|///|//!|<!--)", line))
            if not is_comment and not CLAIM_TERMS.search(stripped):
                continue
        if candidate_text and CLAIM_TERMS.search(candidate_text):
            claims.append({
                "line": line_no,
                "kind": kind,
                "tag": "[UNVERIFIED — heuristic claim candidate; evidence review required]",
                "context": candidate_text[:500],
            })
    return claims


def classify_path(path: str) -> str:
    """Classify provenance scope without claiming authorship."""
    parts = {part.casefold() for part in Path(path).parts}
    name = Path(path).name.casefold()
    suffix = Path(path).suffix.casefold()
    generated = {
        "node_modules", ".next", ".venv", "venv", "vendor", "dist",
        "build", "out", "target", "__pycache__", ".turbo", ".cache",
        "coverage", ".pytest_cache",
    }
    if parts & generated:
        return "generated_or_dependency"
    if "backup" in parts or "backups" in parts or name.endswith(("_backup", ".bak", ".old")):
        return "backup_or_archive"
    if parts & {"tests", "test"} or name.startswith(("test_", "tests_")):
        return "test_source_or_fixture"
    if parts & {".tools", "nexmon_csi", "third_party", "external", "vendor_src"}:
        return "reference_or_vendor_candidate"
    if "docs" in parts or suffix in {".md", ".rst"} or name in {"readme", "license", "notice"}:
        return "documentation_or_legal"
    if suffix in {".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".webp", ".woff", ".woff2", ".ttf", ".otf"}:
        return "asset"
    return "repository_source_or_config"


def iter_git_blob_contents(directory: Path, blob_entries: list[dict]):
    """Read exact committed bytes from Git's object database, not the worktree."""
    command = ["git", "-C", str(directory), "cat-file", "--batch"]
    process = subprocess.Popen(command, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if process.stdin is None or process.stdout is None or process.stderr is None:
        process.kill()
        raise RuntimeError("git cat-file batch pipes could not be opened")
    try:
        request = b"".join((entry["sha"] + "\n").encode("ascii") for entry in blob_entries)
        process.stdin.write(request)
        process.stdin.close()
        for expected in blob_entries:
            header = process.stdout.readline()
            if not header:
                raise RuntimeError(f"git cat-file returned no header for {expected['path']}")
            fields = header.decode("ascii", errors="strict").strip().split()
            if len(fields) != 3 or fields[1] != "blob":
                raise RuntimeError(f"unexpected git object header for {expected['path']}: {header!r}")
            actual_sha, _, size_text = fields
            if actual_sha != expected["sha"]:
                raise RuntimeError(f"Git blob SHA mismatch for {expected['path']}: {actual_sha}")
            size = int(size_text)
            raw = process.stdout.read(size)
            if len(raw) != size:
                raise RuntimeError(f"truncated Git blob read for {expected['path']}")
            if process.stdout.read(1) != b"\n":
                raise RuntimeError(f"Git blob framing error for {expected['path']}")
            yield expected, raw
        stderr = process.stderr.read().decode("utf-8", errors="replace")
        return_code = process.wait()
        if return_code != 0:
            raise RuntimeError(f"git cat-file failed with exit {return_code}: {stderr[:1000]}")
    except Exception:
        process.kill()
        process.wait()
        raise

def classify_numeric_literal(path: str, line: str) -> str:
    scope = classify_path(path)
    folded = line.casefold()
    if scope == "test_source_or_fixture":
        return "[SEMBOLIK — test fixture/assertion literal]"
    if scope == "backup_or_archive":
        return "[KALDIRILACAK — archived literal retained for provenance; not active configuration]"
    if scope == "documentation_or_legal" and ("0.00729735256" in folded or "scientific reference" in folded):
        return "[SEMBOLIK — documentation quotation of a physical reference literal; inspect the cited source location]"
    if "0.00729735256" in folded or "scientific reference" in folded:
        return "[GERÇEK — physical reference literal documented/displayed in source; not a trading input]"
    if scope == "generated_or_dependency":
        return "[GERÇEK — dependency/generated source literal; not a Nexus runtime measurement]"
    if scope == "reference_or_vendor_candidate":
        return "[GERÇEK — third-party/reference source literal; not a Nexus runtime measurement]"
    if scope == "documentation_or_legal":
        return "[GERÇEK — documentation literal; semantic meaning requires source review]"
    return "[GERÇEK — repository source literal; runtime meaning not implied]"


def classify_alpha_reference(path: str, line: str, matched_text: str, match_start: int) -> str:
    scope = classify_path(path)
    match_folded = matched_text.casefold()
    local_tail = line[match_start:match_start + 48].casefold()

    if scope == "test_source_or_fixture":
        return "[SEMBOLIK — test fixture for alpha/physical-reference parsing]"
    if match_folded == "fine-structure":
        return "[GERÇEK — physical concept mentioned; no execution use established]"
    if matched_text == "α" and re.match(r"α\s*=\s*0\.00729735256", local_tail):
        return "[GERÇEK — physical reference value displayed as text; not a trading input]"
    if re.match(r"(?:α|alpha)[_-](?:coupling|coupled|efficiency|telemetry)", local_tail):
        return "[KALDIRILACAK — legacy architecture namespace; source preserved]"
    return "[SEMBOLIK — parameter, branding, channel, or financial-domain term]"



def scan_text(path: str, text: str) -> dict:
    numeric, alpha, alpha_identifiers = [], [], []
    for line_no, line in enumerate(text.splitlines(), 1):
        for match in NUMBER_RE.finditer(line):
            numeric.append({
                "line": line_no,
                "literal": match.group(0),
                "tag": classify_numeric_literal(path, line),
                "context": line.strip()[:500],
            })
        for match in ALPHA_RE.finditer(line):
            alpha.append({
                "line": line_no,
                "match": match.group(0),
                "tag": classify_alpha_reference(path, line, match.group(0), match.start()),
                "context": line.strip()[:500],
            })
        for match in ALPHA_IDENTIFIER_RE.finditer(line):
            identifier = match.group(0).casefold()
            identifier_tag = (
                "[KALDIRILACAK — legacy alpha architecture identifier; source preserved]"
                if identifier.startswith(("alpha_coupl", "alpha_efficiency", "alpha_telemetry"))
                else "[SEMBOLIK — alpha-prefixed identifier; domain meaning requires schema/code review]"
            )
            alpha_identifiers.append({
                "line": line_no,
                "match": match.group(0),
                "tag": identifier_tag,
                "context": line.strip()[:500],
            })
    suffix = Path(path).suffix.lower()
    symbols = extract_python_symbols(text) if suffix in PY_EXT else extract_web_symbols(text, suffix)
    claims = extract_claim_candidates(path, text)
    return {
        "numeric_literals": numeric,
        "alpha_references": alpha,
        "alpha_identifiers": alpha_identifiers,
        "claim_candidates": claims,
        "symbols": symbols,
    }


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
    tree_entries = [item for item in raw_tree.split(b"\0") if item]
    blob_entries, gitlinks = [], []
    for entry in tree_entries:
        metadata, raw_path = entry.split(b"\t", 1)
        mode, object_type, sha = metadata.decode("ascii").split()
        path = raw_path.decode("utf-8", errors="surrogateescape")
        if object_type == "commit" or mode == "160000":
            gitlinks.append({"path": path, "sha": sha, "mode": mode})
        elif object_type == "blob":
            blob_entries.append({"path": path, "sha": sha, "mode": mode, "type": object_type})

    files, fetch_errors = [], []
    try:
        blob_iterator = iter_git_blob_contents(directory, blob_entries)
        for entry, raw in blob_iterator:
            path, sha, mode = entry["path"], entry["sha"], entry["mode"]
            record = {
                "path": path,
                "sha": sha,
                "mode": mode,
                "type": "blob",
                "content_source": "git_object_database",
                "scope_classification": classify_path(path),
                "size_bytes": len(raw),
            }
            try:
                if mode == "120000":
                    record.update({
                        "content_class": "symlink_target",
                        "semantic_scan": "not_applicable",
                        "symlink_target": raw.decode("utf-8", errors="replace"),
                    })
                elif Path(path).suffix.lower() in BINARY_EXT:
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
    except Exception as exc:
        fetch_errors.append({"path": "[git object stream]", "error": f"{type(exc).__name__}: {exc}"})

    files.sort(key=lambda item: item["path"])
    text_files = [item for item in files if item.get("content_class") in {"text", "empty_text"}]
    scope_counts = {}
    for item in files:
        key = item["scope_classification"]
        scope_counts[key] = scope_counts.get(key, 0) + 1
    numeric_count = sum(len(item.get("numeric_literals", [])) for item in files)
    alpha_count = sum(len(item.get("alpha_references", [])) for item in files)
    alpha_identifier_count = sum(len(item.get("alpha_identifiers", [])) for item in files)
    greek_alpha_count = sum(1 for item in files for ref in item.get("alpha_references", []) if "α" in ref.get("match", ""))
    standalone_alpha_word_count = sum(1 for item in files for ref in item.get("alpha_references", []) if ref.get("match", "").casefold() == "alpha")
    fine_structure_text_mention_count = sum(1 for item in files for ref in item.get("alpha_references", []) if "fine-structure" in ref.get("match", "").casefold())
    claim_count = sum(len(item.get("claim_candidates", [])) for item in files)
    symbol_counts = {
        "python_function_definitions": sum(len(item.get("symbols", {}).get("functions", [])) for item in files if Path(item["path"]).suffix.lower() in PY_EXT),
        "python_class_definitions": sum(len(item.get("symbols", {}).get("classes", [])) for item in files if Path(item["path"]).suffix.lower() in PY_EXT),
        "cross_language_function_candidates": sum(len(item.get("symbols", {}).get("functions", [])) for item in files if Path(item["path"]).suffix.lower() not in PY_EXT),
        "cross_language_type_candidates": sum(len(item.get("symbols", {}).get("types", [])) for item in files),
        "react_component_candidates": sum(len(item.get("symbols", {}).get("react_component_candidates", [])) for item in files),
        "html_ids": sum(len(item.get("symbols", {}).get("html_ids", [])) for item in files),
        "html_classes": sum(len(item.get("symbols", {}).get("html_classes", [])) for item in files),
        "css_class_selectors": sum(len(item.get("symbols", {}).get("css_class_selectors", [])) for item in files),
    }
    scoped_symbols = {}
    for scope in sorted({item["scope_classification"] for item in files}):
        scoped_files = [item for item in files if item["scope_classification"] == scope]
        scoped_symbols[scope] = {
            "python_functions": sum(len(item.get("symbols", {}).get("functions", [])) for item in scoped_files if Path(item["path"]).suffix.lower() in PY_EXT),
            "python_classes": sum(len(item.get("symbols", {}).get("classes", [])) for item in scoped_files if Path(item["path"]).suffix.lower() in PY_EXT),
            "cross_language_function_candidates": sum(len(item.get("symbols", {}).get("functions", [])) for item in scoped_files if Path(item["path"]).suffix.lower() not in PY_EXT),
            "cross_language_type_candidates": sum(len(item.get("symbols", {}).get("types", [])) for item in scoped_files),
            "claim_candidates": sum(len(item.get("claim_candidates", [])) for item in scoped_files),
        }
    python_parse_errors = [
        {"path": item["path"], "error": item["symbols"]["parse_error"]}
        for item in files
        if item.get("symbols", {}).get("parse_error")
    ]
    long_lines_skipped = sum(item.get("symbols", {}).get("long_lines_skipped", 0) for item in files)
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
        "snapshot_ref": (os.environ.get("GITHUB_REF", "workflow_checkout") if config["directory"] == "." else config["snapshot_ref"]),
        "commit_sha": commit_sha,
        "tree_truncated": False,
        "blob_count": len(files),
        "text_file_count": len(text_files),
        "binary_or_nontext_count": len(files) - len(text_files),
        "scope_counts": scope_counts,
        "numeric_literal_count": numeric_count,
        "alpha_reference_count": alpha_count,
        "alpha_identifier_count": alpha_identifier_count,
        "greek_alpha_count": greek_alpha_count,
        "standalone_alpha_word_count": standalone_alpha_word_count,
        "fine_structure_text_mention_count": fine_structure_text_mention_count,
        "claim_candidate_count": claim_count,
        "symbol_counts": symbol_counts,
        "symbol_counts_by_scope": scoped_symbols,
        "python_parse_errors": python_parse_errors,
        "long_lines_skipped_from_regex_symbol_extraction": long_lines_skipped,
        "gitmodules_present": gitmodules_present,
        "gitlinks": gitlinks,
        "structural_findings": structural_findings,
        "incomplete_paths": [],
        "fetch_errors": fetch_errors,
        "files": files,
    }

def build_console_summary(reports: list[dict], output_path: str, complete: bool) -> dict:
    return {
        "complete": complete,
        "output": output_path,
        "repositories": [{
            "repository": report["repository"],
            "commit_sha": report["commit_sha"],
            "blob_count": report["blob_count"],
            "text_file_count": report["text_file_count"],
            "binary_or_nontext_count": report["binary_or_nontext_count"],
            "numeric_literal_count": report["numeric_literal_count"],
            "alpha_reference_count": report["alpha_reference_count"],
            "alpha_identifier_count": report["alpha_identifier_count"],
            "greek_alpha_count": report["greek_alpha_count"],
            "standalone_alpha_word_count": report["standalone_alpha_word_count"],
            "fine_structure_text_mention_count": report["fine_structure_text_mention_count"],
            "claim_candidate_count": report["claim_candidate_count"],
            "symbol_counts": report["symbol_counts"],
            "gitlinks": report["gitlinks"],
            "structural_findings": report["structural_findings"],
            "incomplete_paths": report["incomplete_paths"],
            "fetch_errors": report["fetch_errors"],
        } for report in reports],
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
    summary = build_console_summary(reports, str(output), complete)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if complete else 1
if __name__ == "__main__":
    raise SystemExit(main())
