import base64

import pytest
from fastapi.testclient import TestClient

from mlviz import deliverables
from mlviz.fixture import RUNS, make_project, run_folder
from mlviz.project import Project
from mlviz.runs import get_run
from mlviz.server import create_app

PNG_BYTES = b"\x89PNG\r\n\x1a\n" + b"\x00" * 16
B64 = base64.b64encode(PNG_BYTES).decode()
RID = run_folder(RUNS[3])


@pytest.fixture
def root(tmp_path):
    return make_project(tmp_path / "p")


@pytest.fixture
def client(root):
    return TestClient(create_app(root))


def post(client, **over):
    body = {"target": "deliverables/2026-10-15 Test", "files": [{"name": "01_compare-table.png", "data": B64, "title": "Titel"}], **over}
    return client.post("/api/deliverables", json=body)


def test_images_are_written_below_the_target_with_a_readme(client, root):
    r = post(client, title="Mein Test", issue="TIM-52", runs=[RID])
    assert r.status_code == 200, r.text
    out = root / "deliverables" / "2026-10-15 Test"
    assert (out / "01_compare-table.png").read_bytes() == PNG_BYTES
    assert r.json() == {"path": "deliverables/2026-10-15 Test", "files": ["01_compare-table.png"], "configs": [], "readme": "README.md"}
    readme = (out / "README.md").read_text()
    assert "# Mein Test" in readme and "Issue: TIM-52" in readme and RID in readme and "| `01_compare-table.png` | Titel |" in readme


def test_a_data_url_prefix_is_accepted(client, root):
    r = post(client, files=[{"name": "a.png", "data": "data:image/png;base64," + B64}])
    assert r.status_code == 200 and (root / "deliverables" / "2026-10-15 Test" / "a.png").exists()


def test_the_readme_links_the_folder_to_its_issue_in_the_run_list(client, root):
    post(client, issue="TIM-52")
    from mlviz.linear import local_links

    assert local_links(Project.load(root), "TIM-52")["deliverable"] in (
        "deliverables/2026-10-15 Test", "deliverables/2026-10-09 Comparison TIM-52",
    )
    assert local_links(Project.load(root), "TIM-83")["deliverable"] is None


def test_configs_of_the_run_are_saved_with_the_images(client, root):
    r = post(client, configs=[RID])
    assert r.json()["configs"] == [f"configs/{RID}.yaml"]
    assert (root / "deliverables" / "2026-10-15 Test" / "configs" / f"{RID}.yaml").read_text() == (get_run(Project.load(root), RID).path / "config.yaml").read_text()


@pytest.mark.parametrize(
    "target",
    ["../outside", "/abs/path", "deliverables/../../x", "C:\\x", "", ".git/x", "deliverables/.hidden", "runs", "runs/sub"],
)
def test_targets_outside_the_project_or_in_runs_are_refused(client, root, target):
    r = post(client, target=target)
    assert r.status_code == 400, target
    assert not (root.parent / "outside").exists()


def test_file_names_cannot_leave_the_target(client, root):
    r = post(client, files=[{"name": "../../evil.png", "data": B64}, {"name": "ok.png", "data": B64}])
    assert r.status_code == 200
    out = root / "deliverables" / "2026-10-15 Test"
    assert sorted(p.name for p in out.glob("*.png")) == ["evil.png", "ok.png"]
    assert not (root / "evil.png").exists()


@pytest.mark.parametrize("name,expected", [("a b.png", "a b.png"), ("x/y.png", "y.png"), ("bild", "bild.png"), ("a:b*c.png", "a_b_c.png"), ("..", "bild.png")])
def test_safe_name(name, expected):
    assert deliverables.safe_name(name) == expected


def test_only_real_png_data_is_accepted(client):
    assert post(client, files=[{"name": "a.png", "data": base64.b64encode(b"not a png").decode()}]).status_code == 400
    assert post(client, files=[{"name": "a.png", "data": "%%%"}]).status_code == 400
    assert post(client, files=[]).status_code == 400


def test_duplicate_file_names_are_refused(client):
    assert post(client, files=[{"name": "a.png", "data": B64}, {"name": "A.png", "data": B64}]).status_code == 400


def test_existing_files_are_not_overwritten_unless_asked(client, root):
    assert post(client).status_code == 200
    again = post(client)
    assert again.status_code == 409
    assert "01_compare-table.png" in again.json()["detail"]["conflicts"]
    (root / "deliverables" / "2026-10-15 Test" / "01_compare-table.png").write_bytes(b"old")
    assert post(client, overwrite=True).status_code == 200
    assert (root / "deliverables" / "2026-10-15 Test" / "01_compare-table.png").read_bytes() == PNG_BYTES


def test_folder_listing_hides_runs_and_hidden_folders(client, root):
    (root / ".git").mkdir()
    top = client.get("/api/folders").json()
    assert top["path"] == "" and top["parent"] is None
    assert "deliverables" in top["dirs"] and "runs" not in top["dirs"] and ".git" not in top["dirs"]
    sub = client.get("/api/folders", params={"path": "deliverables"}).json()
    assert sub["path"] == "deliverables" and sub["parent"] == "" and "2026-10-09 Comparison TIM-52" in sub["dirs"]
    deeper = client.get("/api/folders", params={"path": "deliverables/2026-10-09 Comparison TIM-52"}).json()
    assert deeper["parent"] == "deliverables"


@pytest.mark.parametrize("path", ["../x", "deliverables/../..", "/etc"])
def test_folder_listing_cannot_leave_the_project(client, path):
    assert client.get("/api/folders", params={"path": path}).status_code in (400, 404)
