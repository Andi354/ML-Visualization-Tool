"""Images for the agent (v0.2.3, feature L): kept in the project, named in the message, read by the agent with `Read`."""

import base64
import json
import struct
import zlib

import pytest
from fastapi.testclient import TestClient

from mlviz import agent_attachments
from mlviz.agent_attachments import AttachmentError, AttachmentStore
from mlviz.project import Project
from mlviz.server import create_app


def png(color=(200, 40, 40), size=8) -> bytes:
    raw = b"".join(b"\x00" + bytes(color) * size for _ in range(size))

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode()


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setenv("FAKE_CLAUDE_LOG", str(tmp_path / "calls.log"))
    return TestClient(create_app(tmp_path))


def upload(client, data=None, name="shot.png"):
    return client.post("/api/agent/attachments", json={"name": name, "data": b64(data if data is not None else png())})


def run(client, chat_id, text="", **extra):
    with client.stream("POST", f"/api/agent/chats/{chat_id}/run", json={"text": text, **extra}) as r:
        assert r.status_code == 200, r.read()
        return [json.loads(l[6:]) for l in r.iter_lines() if l.startswith("data: ")]


def new_chat(client):
    return client.post("/api/agent/chats", json={}).json()["id"]


def calls(client):
    f = client.app.state.project.root / "calls.log"
    return [json.loads(l) for l in f.read_text().splitlines() if '"-p"' in l]


# --- keeping ----------------------------------------------------------------------------------------
def test_an_image_is_kept_under_the_name_of_its_content(client):
    r = upload(client)
    assert r.status_code == 200
    kept = r.json()
    root = client.app.state.project.root
    assert kept["file"].endswith(".png") and len(kept["file"]) == 16 + 4
    assert (root / ".mlviz" / "attachments" / kept["file"]).read_bytes() == png()
    assert kept["name"] == "shot.png" and kept["size"] == len(png()) and kept["url"] == f"/api/agent/attachments/{kept['file']}"
    again = upload(client, name="other.png").json()
    assert again["file"] == kept["file"]  # the same image is kept once
    assert len(list((root / ".mlviz" / "attachments").iterdir())) == 1


def test_a_kept_image_is_served_with_its_type(client):
    kept = upload(client).json()
    r = client.get(kept["url"])
    assert r.status_code == 200 and r.headers["content-type"] == "image/png" and r.content == png()


@pytest.mark.parametrize(
    "data,kind",
    [(png(), "png"), (b"\xff\xd8\xff\xe0" + b"x" * 20, "jpg"), (b"GIF89a" + b"x" * 20, "gif"), (b"RIFF\x10\x00\x00\x00WEBPVP8 " + b"x" * 20, "webp")],
)
def test_the_kind_of_an_image_comes_from_its_first_bytes(client, data, kind):
    assert agent_attachments.sniff(data) == kind
    assert upload(client, data, name="whatever.txt").json()["file"].endswith("." + kind)


def test_something_that_is_no_image_is_refused(client):
    r = upload(client, b"<html><script>alert(1)</script></html>", name="bild.png")
    assert r.status_code == 400 and "kein Bild" in r.json()["detail"]
    assert not (client.app.state.project.root / ".mlviz" / "attachments").exists()


def test_a_big_or_empty_or_broken_upload_is_refused(client):
    big = png() + b"\0" * agent_attachments.MAX_BYTES
    assert upload(client, big).status_code == 400 and "MB" in upload(client, big).json()["detail"]
    assert upload(client, b"").status_code == 400
    assert client.post("/api/agent/attachments", json={"name": "x", "data": "***kein base64***"}).status_code == 400


def test_only_our_own_file_names_are_served(client):
    kept = upload(client).json()
    for bad in ("..%2Fagent.json", "x.png", "0123456789abcdef.exe", "0123456789abcdef.png"):
        assert client.get(f"/api/agent/attachments/{bad}").status_code == 404
    assert client.get(kept["url"]).status_code == 200


def test_a_name_with_line_breaks_stays_one_short_line(client):
    assert upload(client, name="a\nb\r\n" + "x" * 200).json()["name"].count("\n") == 0
    assert len(upload(client, name="x" * 200).json()["name"]) == 80


# --- sending ------------------------------------------------------------------------------------------
def test_the_message_names_the_image_files_and_the_chat_keeps_them(client):
    a, b = upload(client, png((1, 2, 3))).json(), upload(client, png((9, 9, 9))).json()
    cid = new_chat(client)
    snaps = run(client, cid, "Was siehst du?", images=[{"file": a["file"], "name": "eins.png"}, {"file": b["file"], "name": "zwei.png"}])
    (call,) = calls(client)
    prompt = call["args"][call["args"].index("-p") + 1]
    assert prompt.splitlines()[1:] == ["Was siehst du?", f"[Bild 1: .mlviz/attachments/{a['file']}]", f"[Bild 2: .mlviz/attachments/{b['file']}]"]
    user = snaps[-1]["chat"]["messages"][0]
    assert user["k"] == "user" and user["t"] == "Was siehst du?" and user["images"] == [{"file": a["file"], "name": "eins.png"}, {"file": b["file"], "name": "zwei.png"}]
    # the stand-in reads the file the way `Read` would: relative to the project folder
    answers = [m["t"] for m in snaps[-1]["chat"]["messages"] if m["k"] == "agent"]
    assert answers == [f"Bild 1: .mlviz/attachments/{a['file']} · {len(png((1, 2, 3)))} Bytes", f"Bild 2: .mlviz/attachments/{b['file']} · {len(png((9, 9, 9)))} Bytes"]


def test_a_message_can_be_only_an_image_and_the_chat_is_named_after_it(client):
    kept = upload(client).json()
    cid = new_chat(client)
    snaps = run(client, cid, "", images=[{"file": kept["file"], "name": "x.png"}])
    assert snaps[-1]["chat"]["title"] == "Bild"
    assert snaps[-1]["chat"]["messages"][0]["t"] == ""
    assert client.post(f"/api/agent/chats/{new_chat(client)}/run", json={"text": ""}).status_code == 400  # nothing at all is still an error


def test_a_message_with_text_names_the_chat_after_the_text(client):
    kept = upload(client).json()
    cid = new_chat(client)
    snaps = run(client, cid, "Schau mal", images=[{"file": kept["file"], "name": "x.png"}])
    assert snaps[-1]["chat"]["title"] == "Schau mal"


def test_an_image_that_is_not_kept_or_too_many_images_are_refused(client):
    cid = new_chat(client)
    r = client.post(f"/api/agent/chats/{cid}/run", json={"text": "x", "images": [{"file": "0123456789abcdef.png", "name": "x"}]})
    assert r.status_code == 400 and "gibt es nicht" in r.json()["detail"]
    r = client.post(f"/api/agent/chats/{cid}/run", json={"text": "x", "images": [{"file": "../../etc/passwd", "name": "x"}]})
    assert r.status_code == 400
    kept = upload(client).json()
    r = client.post(f"/api/agent/chats/{cid}/run", json={"text": "x", "images": [{"file": kept["file"], "name": "x"}] * 5})
    assert r.status_code == 400 and "Höchstens 4" in r.json()["detail"]
    assert client.get(f"/api/agent/chats/{cid}").json()["messages"] == []  # nothing was sent


def test_an_image_can_go_to_more_than_one_chat(client):
    kept = upload(client).json()
    for _ in range(2):
        snaps = run(client, new_chat(client), "Nochmal", images=[{"file": kept["file"], "name": "x.png"}])
        assert snaps[-1]["chat"]["messages"][0]["images"][0]["file"] == kept["file"]


def test_a_resend_gets_the_images_again_without_a_second_question(client):
    kept = upload(client).json()
    cid = new_chat(client)
    run(client, cid, "Was siehst du?", images=[{"file": kept["file"], "name": "x.png"}])
    run(client, cid, "Was siehst du?", resend=True, images=[{"file": kept["file"], "name": "x.png"}])
    prompts = [c["args"][c["args"].index("-p") + 1] for c in calls(client)]
    assert len(prompts) == 2 and all(f"[Bild 1: .mlviz/attachments/{kept['file']}]" in p for p in prompts)
    chat = client.get(f"/api/agent/chats/{cid}").json()
    assert [m["k"] for m in chat["messages"]].count("user") == 1


def test_the_system_prompt_says_where_the_images_of_the_user_are(client):
    from mlviz import agent_run

    assert "[Bild n: Pfad]" in agent_run.SYSTEM_PROMPT and "`Read`" in agent_run.SYSTEM_PROMPT


def test_the_store_checks_what_a_message_may_carry(tmp_path):
    store = AttachmentStore(Project.load(tmp_path))
    assert store.check(None) == [] and store.check([]) == []
    with pytest.raises(AttachmentError):
        store.check("kein Liste")
    with pytest.raises(AttachmentError):
        store.check(["x"])
