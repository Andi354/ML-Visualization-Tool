import pytest
from fastapi.testclient import TestClient

from mlviz import configview
from mlviz.configview import compact
from mlviz.fixture import RUNS, make_project, run_folder
from mlviz.project import Project
from mlviz.runs import get_run
from mlviz.server import create_app


@pytest.fixture(scope="module")
def project(demo_project):
    return Project.load(demo_project)


def run_of(project, experiment, nth=0):
    folders = [run_folder(r) for r in RUNS if r["experiment"] == experiment]
    return get_run(project, folders[nth])


@pytest.fixture(scope="module")
def cfg(project):
    return configview.run_config(project, run_of(project, "TIM-71_example"), {"forecaster": "ets", "lstm_layer": "1"})


def test_compact_values():
    assert compact(0.0005) == "5e-4" and compact(1.0e-3) == "1e-3" and compact(0.05) == "0.05"
    assert compact(20) == "20" and compact("a") == "a" and compact(0.0) == "0.0"


def test_grid_lists_every_swept_axis_with_all_values_and_the_combination_value(cfg):
    axes = {a["key"]: a for a in cfg["grid"]["axes"]}
    assert list(axes) == ["forecaster", "lstm_layer"]
    assert [v["label"] for v in axes["forecaster"]["values"]] == ["rep-net", "ets"]
    assert axes["forecaster"]["current"] == "ets" and axes["lstm_layer"]["current"] == "1"
    assert not axes["forecaster"]["paired"]


def test_replicates_are_listed_with_their_values(cfg):
    assert cfg["grid"]["replicates"] == [
        {"key": "shuffle_seed", "values": ["1", "2"]},
        {"key": "cv_fold", "values": ["0", "1"]},
    ]


def test_paired_axis_is_one_row_with_values_like_5e_4_dot_20(project):
    run = run_of(project, "TIM-45_g6_combined")
    c = configview.run_config(project, run, {"lr_epochs": "learning_rate=0.001, max_epochs=20"})
    pair = c["grid"]["axes"][0]
    assert pair["paired"] and pair["members"] == ["learning_rate", "max_epochs"]
    assert [v["display"] for v in pair["values"]] == ["5e-4 · 20", "5e-4 · 60", "1e-3 · 20"]
    assert pair["current"] == "learning_rate=0.001, max_epochs=20"
    train = next(b for b in c["blocks"] if b["name"] == "train")
    lr = next(e for e in train["entries"] if e["key"] == "learning_rate")
    assert lr["swept"] and lr["value"] == "0.001" and lr["values"] == ["0.0005", "0.001"]  # deduplicated


def test_blocks_are_in_config_order_without_the_grid_blocks(cfg):
    assert [b["name"] for b in cfg["blocks"]] == ["data", "model", "train", "run"]
    assert all(b["name"] not in ("sweep", "replicates") for b in cfg["blocks"])


def test_the_combination_is_applied_to_the_resolved_config(cfg):
    model = {e["key"]: e for e in next(b for b in cfg["blocks"] if b["name"] == "model")["entries"]}
    assert model["forecaster"]["value"] == "ets" and model["forecaster"]["swept"]
    assert model["forecaster"]["values"] == ["rep-net", "ets"]
    assert not model["encoding_size"]["swept"]


def test_entries_that_differ_from_the_base_config_are_marked_with_the_base_value(cfg):
    assert cfg["base_known"]
    model = {e["key"]: e for e in next(b for b in cfg["blocks"] if b["name"] == "model")["entries"]}
    assert model["forecaster"]["differs"] and model["forecaster"]["base"] == "rep-net"
    assert not model["lstm_layer"]["differs"]
    block = {b["name"]: b for b in cfg["blocks"]}
    assert block["model"]["differs"] == 1 and block["run"]["differs"] == 1 and block["data"]["differs"] == 0


def test_a_run_without_config_base_has_no_base_comparison(project):
    c = configview.run_config(project, run_of(project, "TIM-45_g6_combined"))
    assert not c["base_known"]
    assert all(not e["differs"] for b in c["blocks"] for e in b["entries"])


def test_without_a_combination_the_grid_has_no_current_value(project):
    c = configview.run_config(project, run_of(project, "TIM-52_best_30"))
    assert c["grid"]["axes"][0]["current"] is None


def test_yaml_lines_are_numbered_and_carry_markers(cfg):
    nums = [l["n"] for l in cfg["lines"]]
    assert nums == list(range(1, len(nums) + 1))
    swept = [l for l in cfg["lines"] if l.get("swept")]
    assert {l["text"] for l in swept} == {"lstm_layer: 1", "forecaster: ets"}
    assert next(l for l in swept if l["text"] == "forecaster: ets")["note"] == "weitere: rep-net"
    diff = next(l for l in cfg["lines"] if l.get("differs") and l["text"] == "predictions: all")
    assert diff["base"] == "none"
    rep = [l for l in cfg["lines"] if l.get("replicate")]
    assert {l["text"] for l in rep} == {"shuffle_seed: [1, 2]", "cv_fold: [0, 1]"}


def test_yaml_text_is_the_whole_resolved_config_and_parses_back(cfg):
    import yaml

    data = yaml.safe_load(cfg["yaml"])
    assert data["model"]["forecaster"] == "ets"
    assert list(data)[-2:] == ["sweep", "replicates"]
    assert data["data"]["pred_len"] == 30


def test_a_config_lacking_blocks_still_renders(project, tmp_path):
    root = make_project(tmp_path / "p")
    run = run_of(Project.load(root), "TIM-30_baselines_30")
    (run.path / "config.yaml").write_text("sweep: {forecaster: [a, b]}\n")
    c = configview.run_config(Project.load(root), get_run(Project.load(root), run.id))
    assert c["blocks"] == [] and c["lines"][0]["text"] == "sweep:"


def test_endpoint_with_combination_and_errors(demo_project):
    client = TestClient(create_app(demo_project))
    rid = run_folder(RUNS[6])
    ok = client.get(f"/api/runs/{rid}/config", params={"combo": '{"forecaster": "ets"}'})
    assert ok.status_code == 200 and ok.json()["grid"]["axes"][0]["current"] == "ets"
    assert client.get(f"/api/runs/{rid}/config", params={"combo": "{nope"}).status_code == 400
    assert client.get("/api/runs/2020-01-01_000000_gone/config").status_code == 404


def test_the_base_is_the_one_stored_in_the_run_not_todays_file(tmp_path):
    root = make_project(tmp_path / "p")
    rid = run_folder(RUNS[6])
    # the living base in configs/base/ changes after the run: the comparison must not follow it
    base_file = root / "configs" / "base" / "demo_daily.yaml"
    base_file.write_text(base_file.read_text().replace("encoding_size: 64", "encoding_size: 999"))
    project = Project.load(root)
    c = configview.run_config(project, get_run(project, rid))
    enc = next(e for b in c["blocks"] for e in b["entries"] if e["key"] == "encoding_size")
    assert not enc["differs"]
    # the stored base decides
    stored = root / "runs" / rid / "config.base.yaml"
    stored.write_text(stored.read_text().replace("encoding_size: 64", "encoding_size: 32"))
    c = configview.run_config(project, get_run(project, rid))
    enc = next(e for b in c["blocks"] for e in b["entries"] if e["key"] == "encoding_size")
    assert enc["differs"] and enc["base"] == "32"
