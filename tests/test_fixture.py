import json

import pandas as pd

from mlviz.fixture import RUNS, make_project, run_folder


def test_generator_is_deterministic(tmp_path):
    a, b = make_project(tmp_path / "a"), make_project(tmp_path / "b")
    f = run_folder(RUNS[3]) + "/cells.parquet"
    pd.testing.assert_frame_equal(pd.read_parquet(a / "runs" / f), pd.read_parquet(b / "runs" / f))


def test_one_run_has_more_than_200_groups(demo_project):
    summary = pd.read_csv(demo_project / "runs" / run_folder(RUNS[1]) / "summary.csv")
    assert len(summary) > 200


def test_meta_json_carries_what_the_tool_reads(demo_project):
    meta = json.loads((demo_project / "runs" / run_folder(RUNS[3]) / "meta.json").read_text())
    assert {"axes", "replicates", "primary_metric", "epoch", "plan", "counts", "migrated"} <= meta.keys()
    assert meta["ended"]
