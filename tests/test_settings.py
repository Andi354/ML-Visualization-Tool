import json

import pytest
from fastapi.testclient import TestClient

from mlviz.fixture import make_project
from mlviz.server import create_app
from mlviz.settings import DEFAULTS, SCHEMA, SPECS, SettingsStore


@pytest.fixture
def store(tmp_path):
    from types import SimpleNamespace

    return SettingsStore(SimpleNamespace(root=tmp_path))


@pytest.fixture
def client(tmp_path):
    return TestClient(create_app(make_project(tmp_path)))


def test_every_setting_has_a_usable_default():
    for spec in SPECS:
        assert spec.clean(spec.default) == spec.default
    assert set(DEFAULTS) == set(SCHEMA)


def test_without_a_file_the_defaults_apply(store):
    assert store.overrides() == {} and store.get("look.scale") == 100 and store.warning() is None


def test_only_values_that_differ_from_the_default_are_stored(store):
    store.change({"look.scale": 110, "look.motion": True})
    assert json.loads(store.path.read_text()) == {"look.scale": 110}
    store.change({"look.scale": 100})
    assert not store.path.exists()  # nothing left: no file


def test_a_bad_value_changes_nothing(store):
    store.change({"look.scale": 110})
    with pytest.raises(ValueError):
        store.change({"look.density": "compact", "look.scale": 300})
    with pytest.raises(ValueError):
        store.change({"no.such": 1})
    assert store.overrides() == {"look.scale": 110}


def test_unset_resets_to_the_default(store):
    store.change({"look.scale": 110, "agent.mode": "direct"})
    store.change(unset=["look.scale"])
    assert store.overrides() == {"agent.mode": "direct"}


def test_unknown_keys_and_unusable_values_are_ignored_but_kept(store):
    store.path.parent.mkdir(parents=True)
    store.path.write_text(json.dumps({"future.key": 1, "look.scale": "huge", "agent.mode": "confirm"}))
    assert store.overrides() == {"agent.mode": "confirm"}
    store.change({"look.density": "compact"})
    assert json.loads(store.path.read_text())["future.key"] == 1


def test_an_unreadable_file_warns_and_gives_defaults_until_a_change(store):
    store.path.parent.mkdir(parents=True)
    store.path.write_text("{oops")
    assert store.overrides() == {} and "JSON" in store.warning()
    store.change({"look.density": "compact"})
    assert store.warning() is None and store.overrides() == {"look.density": "compact"}


def test_the_api_reads_changes_and_resets(client):
    got = client.get("/api/settings").json()
    assert got["values"] == {} and got["defaults"]["agent.mode"] == "mixed" and got["file"] == ".mlviz/settings.json"
    got = client.put("/api/settings", json={"set": {"look.scale": 115}}).json()
    assert got["values"] == {"look.scale": 115}
    assert client.put("/api/settings", json={"set": {"look.scale": 5}}).status_code == 400
    assert client.put("/api/settings", json={"unset": ["look.scale"]}).json()["values"] == {}


def test_the_mode_of_the_agent_lives_in_the_settings(client):
    client.put("/api/agent/mode", json={"mode": "confirm"})
    assert client.get("/api/settings").json()["values"]["agent.mode"] == "confirm"
    assert client.get("/api/agent").json()["mode"] == "confirm"


def test_delete_all_chats(client):
    client.post("/api/agent/chats", json={})
    client.post("/api/agent/chats", json={})
    assert client.delete("/api/agent/chats").json() == {"deleted": 2}
    assert client.get("/api/agent").json()["chats"] == []


def test_the_defaults_match_the_ones_of_the_screen():
    """`web/tests/settings.test.ts` compares the catalog of the screen with the same file."""
    from pathlib import Path

    expected = json.loads((Path(__file__).parent / "settings_defaults.json").read_text())
    assert DEFAULTS == expected
