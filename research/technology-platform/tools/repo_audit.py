#!/usr/bin/env python3
"""Read-only GitHub repository metadata and default-branch tree inventory."""
from __future__ import annotations
import argparse, json, os, sys, time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

API = "https://api.github.com"
MANIFESTS = {"pyproject.toml","requirements.txt","requirements-dev.txt","Pipfile","poetry.lock","uv.lock","package.json","package-lock.json","pnpm-lock.yaml","yarn.lock","go.mod","go.sum","Cargo.toml","Cargo.lock","Gemfile","Gemfile.lock","composer.json","composer.lock","Dockerfile","docker-compose.yml","docker-compose.yaml","foundry.toml","hardhat.config.js","hardhat.config.ts","vercel.json","Makefile"}

class GitHubAPIError(RuntimeError):
    pass

def get_json(url: str, token: str) -> tuple[Any, dict[str, str]]:
    headers = {"Accept":"application/vnd.github+json","Authorization":f"Bearer {token}","User-Agent":"ErdemTechnologyPlatform-ReadOnly-Auditor/1.0","X-GitHub-Api-Version":"2022-11-28"}
    for attempt in range(4):
        try:
            with urlopen(Request(url, headers=headers), timeout=30) as response:
                return json.loads(response.read().decode("utf-8")), dict(response.headers.items())
        except HTTPError as exc:
            if exc.code in (403,429,500,502,503,504) and attempt < 3:
                delay = exc.headers.get("Retry-After", str(2 ** attempt))
                time.sleep(max(1, min(int(delay) if delay.isdigit() else 2 ** attempt, 60)))
                continue
            raise GitHubAPIError(f"HTTP {exc.code}: {url.split('?')[0]}") from None
        except (URLError, TimeoutError, json.JSONDecodeError) as exc:
            if attempt < 3:
                time.sleep(2 ** attempt)
                continue
            raise GitHubAPIError(f"request failed ({type(exc).__name__}): {url.split('?')[0]}") from None
    raise GitHubAPIError("retry budget exhausted")

def list_owned_repositories(owner: str, token: str) -> list[dict[str, Any]]:
    page, found = 1, []
    while True:
        query = urlencode({"affiliation":"owner","per_page":100,"page":page,"sort":"updated","direction":"desc"})
        payload, _ = get_json(f"{API}/user/repos?{query}", token)
        if not isinstance(payload, list):
            raise GitHubAPIError("unexpected repository-list response")
        if not payload:
            break
        found.extend(x for x in payload if x.get("owner",{}).get("login","").casefold() == owner.casefold())
        if len(payload) < 100:
            break
        page += 1
    return found

def summarize_tree(payload: dict[str, Any]) -> dict[str, Any]:
    paths = [x.get("path","") for x in payload.get("tree",[]) if x.get("type") == "blob"]
    manifests = sorted(p for p in paths if p.rsplit("/",1)[-1] in MANIFESTS)
    workflows = sorted(p for p in paths if p.startswith(".github/workflows/") and p.endswith((".yml",".yaml")))
    roots = sorted(p for p in paths if "/" not in p)
    extensions = {}
    for path in paths:
        suffix = Path(path.rsplit("/",1)[-1]).suffix.lower() or "[no-extension]"
        extensions[suffix] = extensions.get(suffix,0)+1
    return {"blob_count":len(paths),"root_files":roots,"manifests":manifests,"workflows":workflows,"extension_counts":dict(sorted(extensions.items())),"tree_truncated":bool(payload.get("truncated",False))}

def classify(record: dict[str, Any]) -> str:
    if record.get("archived"): return "archived"
    if record.get("fork"): return "owned_fork_reference_only"
    return "owned_nonfork_candidate"

def audit_repository(item: dict[str, Any], token: str) -> dict[str, Any]:
    parent, source = item.get("parent") or {}, item.get("source") or {}
    record = {"id":item.get("id"),"full_name":item.get("full_name"),"html_url":item.get("html_url"),"private":item.get("private"),"fork":item.get("fork"),"parent":parent.get("full_name"),"source":source.get("full_name"),"archived":item.get("archived"),"disabled":item.get("disabled"),"default_branch":item.get("default_branch"),"language":item.get("language"),"license_spdx":(item.get("license") or {}).get("spdx_id"),"size_kb":item.get("size"),"created_at":item.get("created_at"),"updated_at":item.get("updated_at"),"pushed_at":item.get("pushed_at"),"description":item.get("description"),"topics":item.get("topics") or [],"inspection":"metadata_only"}
    name, branch = record["full_name"], record["default_branch"]
    if not name or not branch:
        record["tree_error"] = "missing repository name or default branch"
        return record
    url = f"{API}/repos/{name}/git/trees/{branch.replace('/', '%2F')}?recursive=1"
    try:
        tree, _ = get_json(url, token)
        record["tree"] = summarize_tree(tree)
        record["inspection"] = "metadata_and_tree"
    except GitHubAPIError as exc:
        record["tree_error"] = str(exc)
    return record

def markdown_report(owner: str, records: list[dict[str, Any]], created: str) -> str:
    lines = [f"# Read-only repository inventory — {owner}","",f"- Snapshot: {created}",f"- Repositories returned: {len(records)}","- Method: paginated GitHub REST owner-affiliation listing and recursive default-branch trees.","- Scope: metadata and paths only; source semantics, runtime, deployment and secret values are not inspected.","- Safety: GET-only; no GitHub repository is modified; token values are never written.","","| Repository | Classification | Branch | Language | License | Files | Manifests | Workflows | Tree |","|---|---|---|---|---|---:|---:|---:|---|"]
    for r in sorted(records,key=lambda x:(x.get("full_name") or "").casefold()):
        t=r.get("tree",{})
        values=[r.get("full_name") or "",classify(r),r.get("default_branch") or "",r.get("language") or "",r.get("license_spdx") or "unknown",str(t.get("blob_count","—")),str(len(t.get("manifests",[]))),str(len(t.get("workflows",[]))),"truncated" if t.get("tree_truncated") else ("ok" if t else "unavailable")]
        lines.append("| "+" | ".join(v.replace("|","\\|").replace("\n"," ") for v in values)+" |")
    lines += ["","## Limitations","","- Non-fork status is not proof of authorship; commit history and provenance must be reviewed.","- Forks are reference-only and must not be modified under the portfolio policy.","- A tree inventory is not a source-code, dependency, security, test or deployment audit.","- Truncated trees require recursive subtree traversal; failed API requests remain explicit.", ""]
    return "\n".join(lines)

def run(owner: str, output: Path, token: str) -> tuple[int, Path, Path]:
    if output.exists():
        raise FileExistsError(f"refusing to overwrite existing output directory: {output}")
    output.mkdir(parents=True,exist_ok=False)
    items=list_owned_repositories(owner,token)
    records=[audit_repository(x,token) for x in items]
    created=datetime.now(timezone.utc).isoformat()
    payload={"schema_version":1,"owner":owner,"created_at":created,"repository_count":len(records),"records":records}
    jp,mp=output/"inventory.json",output/"inventory.md"
    with jp.open("x",encoding="utf-8") as f: json.dump(payload,f,ensure_ascii=False,indent=2); f.write("\n")
    with mp.open("x",encoding="utf-8") as f: f.write(markdown_report(owner,records,created))
    return len(records),jp,mp

def main(argv: list[str] | None=None) -> int:
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--owner",required=True)
    parser.add_argument("--output-dir")
    args=parser.parse_args(argv)
    token=os.environ.get("GITHUB_TOKEN") or os.environ.get("GH_TOKEN")
    if not token:
        print("ERROR: set GITHUB_TOKEN or GH_TOKEN; token is never printed.",file=sys.stderr); return 2
    stamp=datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    output=Path(args.output_dir or f"repo-audit-{args.owner}-{stamp}").expanduser()
    try: count,jp,mp=run(args.owner,output,token)
    except (GitHubAPIError,FileExistsError,OSError) as exc:
        print(f"ERROR: {exc}",file=sys.stderr); return 1
    print(f"Repositories inventoried: {count}")
    print(f"JSON evidence: {jp}")
    print(f"Markdown report: {mp}")
    print("Repository mutation: none (GET-only)")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
