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
