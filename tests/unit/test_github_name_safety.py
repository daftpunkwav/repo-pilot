"""GitHub owner/repo 路径安全校验"""
from backend.tools.builtin import _parse_owner_repo, _safe_github_name


def test_safe_github_name_accepts_normal():
    assert _safe_github_name("daftpunkwav") == "daftpunkwav"
    assert _safe_github_name("repo-pilot.git") == "repo-pilot"


def test_safe_github_name_rejects_path_injection():
    assert _safe_github_name("../etc") is None
    assert _safe_github_name("foo/bar") is None
    assert _safe_github_name("a\\b") is None
    assert _safe_github_name("") is None
    assert _safe_github_name("bad name") is None


def test_parse_owner_repo_from_full_name():
    o, r = _parse_owner_repo(full_name="octocat/Hello-World")
    assert o == "octocat"
    assert r == "Hello-World"


def test_parse_owner_repo_rejects_traversal_full_name():
    o, r = _parse_owner_repo(full_name="../../etc/passwd")
    assert o is None and r is None
