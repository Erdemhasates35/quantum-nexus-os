import unittest
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from repo_audit import classify, markdown_report, summarize_tree

class RepositoryTreeTests(unittest.TestCase):
    def test_tree_finds_manifests_workflows_and_extensions(self):
        payload={"truncated":False,"tree":[{"path":"pyproject.toml","type":"blob"},{"path":"src/main.py","type":"blob"},{"path":".github/workflows/ci.yml","type":"blob"},{"path":"README.md","type":"blob"},{"path":"src","type":"tree"}]}
        result=summarize_tree(payload)
        self.assertEqual(result["blob_count"],4)
        self.assertEqual(result["manifests"],["pyproject.toml"])
        self.assertEqual(result["workflows"],[".github/workflows/ci.yml"])
        self.assertFalse(result["tree_truncated"])
    def test_truncated_tree_is_explicit(self):
        self.assertTrue(summarize_tree({"truncated":True,"tree":[]})["tree_truncated"])
    def test_fork_is_reference_only(self):
        self.assertEqual(classify({"fork":True,"archived":False}),"owned_fork_reference_only")
    def test_archived_takes_precedence(self):
        self.assertEqual(classify({"fork":True,"archived":True}),"archived")
    def test_nonfork_is_candidate_not_authorship_proof(self):
        self.assertEqual(classify({"fork":False,"archived":False}),"owned_nonfork_candidate")
    def test_markdown_discloses_limitations(self):
        report=markdown_report("owner",[{"full_name":"owner/repo","fork":False,"archived":False,"default_branch":"main","tree":{"blob_count":1,"manifests":[],"workflows":[],"tree_truncated":False}}],"2026-11-13T00:00:00Z")
        self.assertIn("source semantics",report)
        self.assertIn("GET-only",report)
        self.assertIn("owner/repo",report)

if __name__ == "__main__": unittest.main()
