"""Shared steps for the browser tests."""

from mlviz.fixture import RUNS, run_folder


def folder(experiment: str, nth: int = 0) -> str:
    return [run_folder(r) for r in RUNS if r["experiment"] == experiment][nth]


def open_run(page, run_id: str) -> None:
    """Open a run in its own tab the way a user does: Läufe, view Issues, issue, "Öffnen"."""
    page.get_by_test_id("area-runs").click()
    page.get_by_test_id("tab-pinned").click()
    page.get_by_test_id("view-issues").click()
    issue = next((r["issue"] for r in RUNS if run_folder(r) == run_id), None) or "—"
    page.locator(f'[data-testid="issue-item"][data-issue="{issue}"]').click()
    page.locator(f'[data-testid="exp-run"][data-run="{run_id}"] [data-testid="open"]').click()


def png_bytes(color=(200, 40, 40), size=16) -> bytes:
    """A small valid PNG (for the images sent to the agent)."""
    import struct
    import zlib

    raw = b"".join(b"\x00" + bytes(color) * size for _ in range(size))

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")
