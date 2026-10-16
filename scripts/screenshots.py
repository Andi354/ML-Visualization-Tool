"""Writes screenshots of the main views for the pull request: `python scripts/screenshots.py <out-dir>`.

Uses the synthetic demo project and a fixed clock; needs the built frontend and Chromium.
"""

import glob
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tests"))
os.environ["MLVIZ_NOW"] = "2026-10-15T12:00:00"

import ds_store_stub  # noqa: E402

ds_store_stub.install()  # until the ds-store package is installed

from browser.conftest import serve  # noqa: E402
from browser.helpers import folder  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

from mlviz.fixture import make_project  # noqa: E402


def main(out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    root = make_project(tempfile.mkdtemp())
    with serve(root) as url, sync_playwright() as p:
        exe = sorted(glob.glob(os.environ.get("PLAYWRIGHT_BROWSERS_PATH", "") + "/chromium-*/chrome-linux/chrome"))
        b = p.chromium.launch(executable_path=exe[-1]) if exe else p.chromium.launch()
        pg = b.new_page(viewport={"width": 1440, "height": 1000})
        pg.goto(url)
        pg.wait_for_selector("[data-testid=newest]")
        pg.get_by_test_id("toggle-timeline").click()
        pg.screenshot(path=out / "01-runs-list.png")
        pg.get_by_test_id("view-issues").click()
        pg.screenshot(path=out / "02-runs-issues.png")
        pg.get_by_test_id("view-list").click()
        pg.locator(f'[data-run="{folder("TIM-71_example")}"] .run-name').click()
        pg.locator("[data-testid=exp-view]:visible [data-testid=exp-row]").first.wait_for()
        pg.screenshot(path=out / "03-experiment.png")
        pg.locator("[data-testid=exp-view]:visible [data-testid=exp-row]").first.click()
        pg.locator("[data-testid=exp-view]:visible [data-testid=widget-title]").first.wait_for()
        pg.wait_for_timeout(1000)
        pg.screenshot(path=out / "04-detail-panel.png")
        pg.get_by_test_id("area-analysis").click()
        pg.get_by_test_id("analysis-view-run").click()
        pg.get_by_test_id("run-select").select_option(folder("TIM-52_best_30", 1))
        pg.wait_for_load_state("networkidle")
        pg.wait_for_timeout(800)
        pg.screenshot(path=out / "05-analysis-run.png")
        pg.get_by_test_id("save-deliverable").click()
        d = pg.get_by_test_id("save-dialog")
        d.get_by_test_id("image-check").nth(0).check()
        d.get_by_test_id("image-check").nth(1).check()
        d.get_by_test_id("combine").click()
        pg.wait_for_timeout(800)
        pg.screenshot(path=out / "06-save-dialog.png")
        d.get_by_test_id("dialog-close").click()
        pg.get_by_test_id("analysis-view-two").click()
        pg.get_by_test_id("run-a").select_option(folder("TIM-52_best_30", 1))
        pg.get_by_test_id("run-b").select_option(folder("TIM-52_best_90"))
        pg.wait_for_load_state("networkidle")
        pg.wait_for_timeout(800)
        pg.screenshot(path=out / "07-analysis-two-runs.png")
        pg.get_by_test_id("analysis-view-project").click()
        pg.wait_for_load_state("networkidle")
        pg.wait_for_timeout(800)
        pg.screenshot(path=out / "08-analysis-project.png")
        b.close()


if __name__ == "__main__":
    main(Path(sys.argv[1]))
