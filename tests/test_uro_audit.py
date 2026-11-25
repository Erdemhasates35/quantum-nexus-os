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
