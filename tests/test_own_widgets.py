"""Own widgets: validation, storage, datasets, results, API (feature E)."""

import copy

import pytest
from fastapi.testclient import TestClient

from mlviz import fixture, own_data, own_widgets
from mlviz.own_widgets import OwnWidgetError, OwnWidgetStore, validate
from mlviz.project import Project
from mlviz.server import create_app
from mlviz import widgets

R52 = fixture.run_folder(fixture.RUNS[3])
R52B = fixture.run_folder(fixture.RUNS[4])
EXAMPLE = fixture.run_folder(next(r for r in fixture.RUNS if r.get("extras")))

DEFN = {
    "name": "MAPE je Region",
    "question": "Wie verteilt sich der Fehler über die Regionen?",
    "scope": "one",
    "width": "half",
    "params": [{"name": "model", "label": "Modell", "options": ["rep-net", "ets", "sarima"], "default": "rep-net"}],
    "data": {"source": "channels", "filter": {"forecaster": "{{param.model}}"}},
    "spec": {
        "mark": "bar",
        "encoding": {
            "x": {"field": "channel", "type": "nominal", "title": "Region"},
            "y": {"aggregate": "mean", "field": "test_mape", "type": "quantitative"},
            "color": {"field": "channel", "type": "nominal"},
        },
    },
}


@pytest.fixture
def project(demo_project):
    return Project.load(demo_project)


def defn(**over):
    d = copy.deepcopy(DEFN)
    d.update(over)
    return d


# --- validation ------------------------------------------------------------------------------------
def test_a_good_description_is_valid():
    assert validate(DEFN) == []


@pytest.mark.parametrize(
    "change, fragment",
    [
        ({"name": ""}, "name"),
        ({"name": "x" * 61}, "name"),
        ({"name": "!!!"}, "name"),
        ({"question": ""}, "question"),
        ({"scope": "everything"}, "scope"),
        ({"width": "wide"}, "width"),
        ({"params": "model"}, "params"),
        ({"params": [{"name": "1bad", "options": ["a"], "default": "a"}]}, "params[0].name"),
        ({"params": [{"name": "m", "options": [], "default": "a"}]}, "options"),
        ({"params": [{"name": "m", "options": ["a"], "default": "b"}]}, "default"),
        ({"data": {"source": "everything"}}, "data.source"),
        ({"data": {"source": "cells", "filter": ["a"]}}, "data.filter"),
        ({"spec": "bar"}, "spec"),
        ({"spec": {"encoding": {}}}, "Mark"),
    ],
)
def test_invalid_descriptions_say_what_is_wrong(change, fragment):
    errors = validate(defn(**change))
    assert errors and any(fragment in e for e in errors), errors


def test_duplicate_param_names_and_unknown_param_references_are_refused():
    two = defn(params=[DEFN["params"][0], DEFN["params"][0]])
    assert any("doppelt" in e for e in validate(two))
    ghost = defn(data={"source": "cells", "filter": {"forecaster": "{{param.nope}}"}})
    assert any("param.nope" in e for e in validate(ghost))
    in_spec = copy.deepcopy(DEFN)
    in_spec["spec"]["encoding"]["y"]["field"] = "{{param.metric}}"
    assert any("param.metric" in e for e in validate(in_spec))


@pytest.mark.parametrize(
    "spec_change",
    [
        {"config": {"axis": {"labelFont": "Arial"}}},
        {"data": {"values": []}},
        {"datasets": {}},
        {"mark": {"type": "bar", "color": "#ff0000"}},
        {"mark": {"type": "bar", "fill": "red"}},
        {"title": {"text": "x", "font": "Arial"}},
        {"encoding": {"x": {"field": "channel", "axis": {"labelFontSize": 20}}}},
        {"encoding": {"color": {"field": "channel", "scale": {"scheme": "category10"}}}},
        {"encoding": {"color": {"field": "channel", "scale": {"range": ["red", "blue"]}}}},
        {"encoding": {"color": {"value": "#ff0000"}}},
        {"mark": "arc"},
        {"mark": "boxplot"},
    ],
)
def test_a_spec_that_sets_colours_fonts_data_or_unsupported_marks_is_refused(spec_change):
    spec = {**DEFN["spec"], **spec_change}
    assert validate(defn(spec=spec)), spec_change


def test_layers_are_checked_mark_by_mark():
    good = {"layer": [{"mark": "bar", "encoding": {}}, {"mark": "text", "encoding": {}}]}
    assert validate(defn(spec=good)) == []
    bad = {"layer": [{"mark": "bar", "encoding": {}}, {"mark": "arc", "encoding": {}}]}
    assert any("arc" in e for e in validate(defn(spec=bad)))


def test_a_field_based_colour_encoding_is_fine():
    assert validate(defn()) == [] and DEFN["spec"]["encoding"]["color"]["field"]


# --- storage ---------------------------------------------------------------------------------------
def test_keeping_writes_one_file_per_widget_below_the_state_folder(tmp_path):
    store = OwnWidgetStore(Project.load(tmp_path))
    saved = store.save(DEFN)
    assert saved["slug"] == "mape-je-region"
    assert (tmp_path / ".mlviz" / "widgets" / "mape-je-region.json").is_file()
    assert [d["name"] for d in store.list()] == ["MAPE je Region"]
    assert store.get("mape-je-region")["question"] == DEFN["question"]


def test_the_same_name_overwrites_and_another_name_adds(tmp_path):
    store = OwnWidgetStore(Project.load(tmp_path))
    store.save(DEFN)
    store.save(defn(question="Neue Frage?"))
    assert len(store.list()) == 1 and store.list()[0]["question"] == "Neue Frage?"
    store.save(defn(name="Zweites"))
    assert sorted(d["name"] for d in store.list()) == ["MAPE je Region", "Zweites"]


def test_umlauts_and_spaces_give_a_safe_file_name(tmp_path):
    store = OwnWidgetStore(Project.load(tmp_path))
    assert store.save(defn(name="Größe der Fehler / 90 Tage"))["slug"] == "groesse-der-fehler-90-tage"
    assert own_widgets.slugify("Äpfel & Birnen") == "aepfel-birnen"


def test_an_invalid_description_is_not_written(tmp_path):
    store = OwnWidgetStore(Project.load(tmp_path))
    with pytest.raises(OwnWidgetError) as e:
        store.save(defn(scope="x"))
    assert e.value.errors and not (tmp_path / ".mlviz").exists()


def test_delete_and_unsafe_or_unknown_slugs(tmp_path):
    store = OwnWidgetStore(Project.load(tmp_path))
    store.save(DEFN)
    store.delete("mape-je-region")
    assert store.list() == []
    for bad in ("../x", "A", "", "a/b", "x" * 80):
        with pytest.raises(KeyError):
            store.get(bad)
    with pytest.raises(KeyError):
        store.delete("nope")


def test_a_broken_or_invalid_file_is_left_out_of_the_list(tmp_path):
    store = OwnWidgetStore(Project.load(tmp_path))
    store.save(DEFN)
    (store.dir / "junk.json").write_text("{not json")
    (store.dir / "invalid.json").write_text('{"name": "x"}')
    assert [d["slug"] for d in store.list()] == ["mape-je-region"]


# --- datasets --------------------------------------------------------------------------------------
def rows(project, source, scope="one", **request):
    return own_data.rows_for(project, source, scope, {"run": R52, **request}, request.pop("flt", {}))


def test_cells_has_one_row_per_combination_with_mean_sd_and_n(project):
    r = own_data.rows_for(project, "cells", "one", {"run": R52}, {})
    assert len(r) == 5 and {x["forecaster"] for x in r} == {"rep-net", "sarima", "ets", "prophet", "snaive"}
    row = r[0]
    assert {"test_mape", "test_mape_sd", "n", "test_mse_missing"} <= row.keys()
    assert row["n"] == 6 and row["test_mape_sd"] > 0  # 3 seeds x 2 folds


def test_cells_means_equal_the_group_means_of_the_table(project):
    from mlviz.aggregate import run_table
    from mlviz.runs import get_run

    run = get_run(project, R52)
    table = run_table(run, project, {})
    expected = {t["params"]["forecaster"]: t["metrics"]["test_mape"]["mean"] for t in table["rows"]}
    got = {x["forecaster"]: x["test_mape"] for x in own_data.rows_for(project, "cells", "one", {"run": R52}, {})}
    assert got == pytest.approx(expected)


def test_channels_has_a_row_per_combination_and_channel(project):
    r = own_data.rows_for(project, "channels", "one", {"run": R52}, {})
    assert len(r) == 5 * 4 and {x["channel"] for x in r} == {"asia", "eu", "latam", "us"}


def test_curves_and_predictions_come_from_the_flat_tables(project):
    c = own_data.rows_for(project, "curves", "one", {"run": EXAMPLE}, {})
    assert {x["metric"] for x in c} == {"train_loss", "val_loss"} and {"epoch", "value", "forecaster"} <= c[0].keys()
    p = own_data.rows_for(project, "predictions", "one", {"run": EXAMPLE}, {"channel": "us", "forecaster": "rep-net"})
    assert {x["channel"] for x in p} == {"us"} and {"date", "y_pred", "y_true"} <= p[0].keys()


def test_runs_has_one_row_per_run_with_the_lauf_merkmal(project):
    r = own_data.rows_for(project, "runs", "project", {}, {})
    assert {"id", "name", "issue", "started", "epoch", "state", "cells", "errors", "pred_len", "run"} <= r[0].keys()
    assert len(r) == 8  # finished runs only
    assert {x["id"] for x in r}.isdisjoint({fixture.run_folder(next(x for x in fixture.RUNS if x.get("running")))})
    one = own_data.rows_for(project, "runs", "one", {"run": R52}, {})
    assert [x["id"] for x in one] == [R52] and "run" not in one[0]


def test_two_runs_carry_run_a_and_b_and_project_scope_the_run_id(project):
    r = own_data.rows_for(project, "cells", "two", {"runs": [R52, R52B]}, {})
    assert {x["run"] for x in r} == {"A", "B"} and len(r) == 10
    p = own_data.rows_for(project, "cells", "project", {"runs": [R52, R52B]}, {})
    assert {x["run"] for x in p} == {R52, R52B}


def test_the_filter_selects_equal_values_or_a_list_and_unknown_columns_are_an_error(project):
    one = own_data.rows_for(project, "cells", "one", {"run": R52}, {"forecaster": "ets"})
    assert [x["forecaster"] for x in one] == ["ets"]
    two = own_data.rows_for(project, "cells", "one", {"run": R52}, {"forecaster": ["ets", "snaive"]})
    assert {x["forecaster"] for x in two} == {"ets", "snaive"}
    with pytest.raises(LookupError, match="nope"):
        own_data.rows_for(project, "cells", "one", {"run": R52}, {"nope": 1})


def test_the_combination_chips_of_the_board_filter_the_rows_when_they_apply(project):
    r = own_data.rows_for(project, "channels", "one", {"run": R52, "combo": {"forecaster": "ets", "unknown": "x"}}, {})
    assert {x["forecaster"] for x in r} == {"ets"}


def test_sources_that_the_run_does_not_have_say_so(project):
    with pytest.raises(LookupError, match="keine Lernkurven"):
        own_data.rows_for(project, "curves", "one", {"run": R52}, {})
    with pytest.raises(LookupError, match="keine Vorhersagen"):
        own_data.rows_for(project, "predictions", "one", {"run": R52}, {})
    with pytest.raises(LookupError):
        own_data.rows_for(project, "cells", "one", {"run": "2020-01-01_0000_gone"}, {})
    with pytest.raises(LookupError):
        own_data.rows_for(project, "cells", "two", {"runs": [R52]}, {})


def test_too_many_rows_are_refused_with_the_advice_to_filter(project, monkeypatch):
    monkeypatch.setattr(own_data, "ROW_CAP", 3)
    with pytest.raises(LookupError, match="zu viele Zeilen"):
        own_data.rows_for(project, "channels", "one", {"run": R52}, {})


def test_rows_are_plain_json(project):
    import json

    json.dumps(own_data.rows_for(project, "cells", "one", {"run": R52}, {}), allow_nan=False)


# --- results ---------------------------------------------------------------------------------------
def test_a_result_has_rows_the_filled_spec_the_param_options_and_the_title(project):
    r = own_widgets.compute(project, DEFN, {"run": R52, "settings": {"model": "ets"}})
    assert r["title"] == "MAPE je Region" and r["options"] == {"model": ["rep-net", "ets", "sarima"]}
    assert {x["forecaster"] for x in r["data"]["rows"]} == {"ets"} and r["data"]["values"] == {"model": "ets"}


def test_params_fill_the_spec_and_the_filter_and_a_bad_value_falls_back_to_the_default(project):
    d = copy.deepcopy(DEFN)
    d["spec"]["encoding"]["y"]["title"] = "MAPE · {{param.model}}"
    ok = own_widgets.compute(project, d, {"run": R52, "settings": {"model": "ets"}})
    assert ok["data"]["spec"]["encoding"]["y"]["title"] == "MAPE · ets"
    bad = own_widgets.compute(project, d, {"run": R52, "settings": {"model": "gone"}})
    assert bad["data"]["values"] == {"model": "rep-net"}
    assert DEFN["spec"]["encoding"]["y"].get("title") is None  # the stored description is not changed


def test_title_and_subtitle_of_the_description_are_used_when_given(project):
    r = own_widgets.compute(project, defn(title="Fehler je Region", subtitle="MAPE, Mittel über Seeds"), {"run": R52})
    assert (r["title"], r["subtitle"]) == ("Fehler je Region", "MAPE, Mittel über Seeds")


def test_a_widget_that_cannot_be_drawn_says_why(project):
    r = own_widgets.compute(project, defn(scope="x"), {"run": R52})
    assert r["unavailable"].startswith("Widget kann nicht gezeichnet werden:") and "scope" in r["unavailable"]
    r = own_widgets.compute(project, defn(data={"source": "curves"}), {"run": R52})
    assert "keine Lernkurven" in r["unavailable"]
    r = own_widgets.compute(project, defn(data={"source": "cells", "filter": {"forecaster": "gone"}}), {"run": R52})
    assert "keine Daten" in r["unavailable"]


# --- API -------------------------------------------------------------------------------------------
@pytest.fixture
def client(tmp_path):
    from mlviz.fixture import make_project

    return TestClient(create_app(make_project(tmp_path)))


def test_api_keep_list_compute_delete(client):
    assert client.get("/api/own-widgets").json() == []
    kept = client.post("/api/own-widgets", json={"definition": DEFN})
    assert kept.status_code == 200 and kept.json()["key"] == "own:mape-je-region"
    listed = client.get("/api/own-widgets", params={"scope": "run"}).json()
    entry = listed[0]
    assert (entry["label"], entry["scopes"], entry["width"], entry["own"]) == ("MAPE je Region", ["run"], "half", True)
    assert entry["settings"] == [
        {"key": "model", "label": "Modell", "type": "seg", "options": [{"value": o, "label": o} for o in ("rep-net", "ets", "sarima")], "default": "rep-net"}
    ]
    assert entry["definition"]["name"] == "MAPE je Region"
    assert client.get("/api/own-widgets", params={"scope": "two-runs"}).json() == []
    w = client.post("/api/widgets/own:mape-je-region", json={"scope": "run", "run": R52, "settings": {"model": "ets"}}).json()
    assert w["key"] == "own:mape-je-region" and w["exportable"] and {x["forecaster"] for x in w["data"]["rows"]} == {"ets"}
    assert client.delete("/api/own-widgets/mape-je-region").json() == {"deleted": "mape-je-region"}
    assert client.get("/api/own-widgets").json() == []
    assert client.delete("/api/own-widgets/mape-je-region").status_code == 404
    assert client.post("/api/widgets/own:mape-je-region", json={"run": R52}).status_code == 404


def test_api_refuses_an_invalid_description_with_the_reasons(client):
    r = client.post("/api/own-widgets", json={"definition": defn(scope="x", spec={"mark": "arc"})})
    assert r.status_code == 400 and len(r.json()["detail"]["errors"]) >= 2
    v = client.post("/api/own-widgets/validate", json={"definition": DEFN}).json()
    assert v == {"errors": []}
    assert client.post("/api/own-widgets/validate", json={"definition": {"name": "x"}}).json()["errors"]


def test_api_draft_is_computed_without_being_kept(client):
    w = client.post("/api/widgets/own-draft", json={"scope": "run", "run": R52, "definition": DEFN, "settings": {}}).json()
    assert w["key"] == "own-draft" and w["data"]["rows"]
    assert client.get("/api/own-widgets").json() == []
    assert client.post("/api/widgets/own-draft", json={"run": R52}).status_code == 404


def test_own_widgets_are_not_part_of_the_builtin_catalog(client):
    client.post("/api/own-widgets", json={"definition": DEFN})
    assert all(not w["key"].startswith("own") for w in client.get("/api/widgets/catalog").json())
    assert not any(k.startswith("own") for k in widgets.REGISTRY)
