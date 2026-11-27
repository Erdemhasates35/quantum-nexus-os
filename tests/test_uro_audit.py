import importlib.util
from pathlib import Path

SPEC = importlib.util.spec_from_file_location(
    "uro_a0_audit", Path(__file__).parents[1] / "tools" / "uro_a0_audit.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


def test_numeric_and_alpha_literals_are_line_attributed():
    report = MODULE.scan_text("index.html", "const x = 0.00729735256;\n// α is legacy")
    assert report["numeric_literals"][0]["literal"] == "0.00729735256"
    assert report["numeric_literals"][0]["line"] == 1
    underscored = MODULE.scan_text("params.toml", "limit = 10_000")
    assert underscored["numeric_literals"][0]["literal"] == "10_000"
    assert report["alpha_references"][0]["match"] == "α"
    assert report["alpha_references"][0]["line"] == 2


def test_python_functions_and_classes_are_extracted():
    report = MODULE.scan_text("module.py", "class Engine:\n    def run(self):\n        return 7")
    assert any(item["name"] == "Engine" for item in report["symbols"]["classes"])
    assert any(item["name"] == "run" for item in report["symbols"]["functions"])


def test_html_ids_and_classes_are_extracted():
    report = MODULE.scan_text("page.html", '<div id="health" class="panel active"></div>')
    assert report["symbols"]["html_ids"][0]["value"] == "health"
    assert report["symbols"]["html_classes"][0]["value"] == "panel active"


def test_invalid_python_is_reported_not_silently_accepted():
    report = MODULE.scan_text("broken.py", "def broken(:\n pass")
    assert report["symbols"]["parse_error"].startswith("SyntaxError:")

def test_alpha_identifiers_are_separated_from_alpha_references():
    report = MODULE.scan_text("country.c", "char alpha2[2];\nalpha_observations = 1")
    assert report["alpha_references"] == []
    assert [item["match"] for item in report["alpha_identifiers"]] == ["alpha2", "alpha_observations"]

def test_markdown_claim_candidates_are_heuristic_not_every_line():
    report = MODULE.scan_text(
        "claims.md",
        "# Production claims\nOrdinary explanatory prose.\nThe system guarantees atomic execution.",
    )
    assert len(report["claim_candidates"]) == 1
    assert report["claim_candidates"][0]["line"] == 3
    assert report["claim_candidates"][0]["tag"].startswith("[UNVERIFIED")


def test_repository_path_scopes_are_separated():
    assert MODULE.classify_path("docs/design.md") == "documentation_or_legal"
    assert MODULE.classify_path("tests/test_engine.py") == "test_source_or_fixture"
    assert MODULE.classify_path("node_modules/pkg/index.js") == "generated_or_dependency"
    assert MODULE.classify_path("backups/engine.py") == "backup_or_archive"
    assert MODULE.classify_path("flashloan_engine/economics.py") == "repository_source_or_config"
    assert MODULE.classify_path("nexmon_csi/src/driver.c") == "reference_or_vendor_candidate"


def test_a0_reads_committed_git_blob_not_modified_worktree(tmp_path):
    import subprocess

    workspace = tmp_path
    repo_dir = workspace / "repo"
    repo_dir.mkdir()
    subprocess.run(["git", "init", "-q", str(repo_dir)], check=True)
    subprocess.run(["git", "-C", str(repo_dir), "config", "user.email", "uro-test@example.invalid"], check=True)
    subprocess.run(["git", "-C", str(repo_dir), "config", "user.name", "URO test"], check=True)

    source_path = repo_dir / "engine.py"
    source_path.write_text("def committed_value():\n    return 17\n", encoding="utf-8")
    subprocess.run(["git", "-C", str(repo_dir), "add", "engine.py"], check=True)
    subprocess.run(["git", "-C", str(repo_dir), "commit", "-qm", "committed snapshot"], check=True)

    source_path.write_text("def worktree_value():\n    return 999999\n", encoding="utf-8")
    config = {
        "repository": "local/test",
        "label": "local fixture",
        "directory": "repo",
        "snapshot_ref": "HEAD",
        "is_fork": False,
        "parent_repository": None,
        "license_spdx": "MIT",
    }
    report = MODULE.audit_repo(config, workspace)
    file_record = next(item for item in report["files"] if item["path"] == "engine.py")
    assert report["commit_sha"]
    assert file_record["content_source"] == "git_object_database"
    assert file_record["symbols"]["functions"][0]["name"] == "committed_value"
    assert file_record["numeric_literals"][0]["literal"] == "17"
    assert file_record["sha"] == subprocess.run(
        ["git", "-C", str(repo_dir), "rev-parse", "HEAD:engine.py"],
        check=True, capture_output=True, text=True,
    ).stdout.strip()


def test_solidity_contract_and_function_symbols_are_extracted():
    report = MODULE.scan_text("Engine.sol", "contract Engine { function execute() public {} }")
    assert any(item["name"] == "Engine" for item in report["symbols"]["types"])
    assert any(item["name"] == "execute" for item in report["symbols"]["functions"])


def test_rust_function_symbols_are_extracted():
    report = MODULE.scan_text("engine.rs", "pub async fn execute() {}")
    assert any(item["name"] == "execute" for item in report["symbols"]["functions"])

def test_alpha_coupled_branding_is_legacy_not_physical_constant():
    report = MODULE.scan_text("index.html", "Engine — α-Coupled")
    assert report["alpha_references"][0]["tag"].startswith("[KALDIRILACAK")


def test_numeric_literal_tags_distinguish_source_test_and_legacy_contexts():
    test_fixture = MODULE.scan_text("tests/test_costs.py", "expected = 0.25")
    assert test_fixture["numeric_literals"][0]["tag"].startswith("[SEMBOLIK")

    test_reference_fixture = MODULE.scan_text(
        "tests/test_parser.py",
        "expected_text = 'α = 0.00729735256'",
    )
    assert test_reference_fixture["numeric_literals"][0]["tag"].startswith("[SEMBOLIK")

    physical_reference = MODULE.scan_text(
        "index.html",
        "Fine-structure reference α = 0.00729735256; display only.",
    )
    assert physical_reference["numeric_literals"][0]["tag"].startswith("[GERÇEK")
    assert "not a trading input" in physical_reference["numeric_literals"][0]["tag"]

    archived = MODULE.scan_text("backups/old_config.py", "threshold = 0.42")
    assert archived["numeric_literals"][0]["tag"].startswith("[KALDIRILACAK")


def test_alpha_reference_tags_distinguish_physical_legacy_and_domain_terms():
    physical_mention = MODULE.scan_text(
        "docs/architecture.md",
        "The fine-structure constant is not an arbitrage threshold.",
    )
    assert "no execution use established" in physical_mention["alpha_references"][0]["tag"]

    test_fixture = MODULE.scan_text("tests/test_alpha.py", "expected_symbol = 'α'")
    assert test_fixture["alpha_references"][0]["tag"].startswith("[SEMBOLIK")

    legacy = MODULE.scan_text("docs/legacy.md", "The α-telemetry coupling is legacy.")
    assert legacy["alpha_references"][0]["tag"].startswith("[KALDIRILACAK")

    mixed_line = MODULE.scan_text(
        "docs/financial.md",
        "alpha_observations tracks financial alpha signals; fine-structure constant is not used.",
    )
    alpha_match = next(item for item in mixed_line["alpha_references"] if item["match"] == "alpha")
    physics_match = next(item for item in mixed_line["alpha_references"] if item["match"] == "fine-structure")
    assert alpha_match["tag"].startswith("[SEMBOLIK")
    assert physics_match["tag"].startswith("[GERÇEK")

    domain_term = MODULE.scan_text("supabase/schema.ts", 'kind: "alpha"')
    assert domain_term["alpha_references"][0]["tag"].startswith("[SEMBOLIK")


def test_alpha_identifiers_receive_semantic_tags():
    legacy = MODULE.scan_text("legacy.ts", "alpha_telemetry = true")
    financial = MODULE.scan_text("schema.sql", "alpha_observations")
    assert legacy["alpha_identifiers"][0]["tag"].startswith("[KALDIRILACAK")
    assert financial["alpha_identifiers"][0]["tag"].startswith("[SEMBOLIK")


def test_console_summary_uses_current_fine_structure_field_name():
    report = {
        "repository": "owner/repository",
        "commit_sha": "abc123",
        "blob_count": 1,
        "text_file_count": 1,
        "binary_or_nontext_count": 0,
        "numeric_literal_count": 0,
        "alpha_reference_count": 0,
        "alpha_identifier_count": 0,
        "greek_alpha_count": 0,
        "standalone_alpha_word_count": 0,
        "fine_structure_text_mention_count": 1,
        "claim_candidate_count": 0,
        "symbol_counts": {},
        "gitlinks": [],
        "structural_findings": [],
        "incomplete_paths": [],
        "fetch_errors": [],
    }
    summary = MODULE.build_console_summary([report], "inventory.json", True)
    projected = summary["repositories"][0]
    assert projected["fine_structure_text_mention_count"] == 1
    assert "fine_structure_reference_count" not in projected


def test_alpha_glyph_and_coupling_on_same_line_have_distinct_tags():
    report = MODULE.scan_text(
        "docs/legacy.md",
        "The v16 α glyph/footer, old α-Coupling documents remain.",
    )
    alpha = [item for item in report["alpha_references"] if item["match"] == "α"]
    assert len(alpha) == 2
    assert alpha[0]["tag"].startswith("[SEMBOLIK")
    assert alpha[1]["tag"].startswith("[KALDIRILACAK")


def test_physical_constant_display_tag_uses_local_alpha_match():
    report = MODULE.scan_text(
        "index.html",
        "α = 0.00729735256 is displayed as a scientific reference only.",
    )
    assert report["alpha_references"][0]["match"] == "α"
    assert report["alpha_references"][0]["tag"].startswith("[GERÇEK")
