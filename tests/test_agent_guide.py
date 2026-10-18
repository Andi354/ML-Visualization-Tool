"""The help of the agent (`agent_guide.md`) stays in step with the code.

A new, renamed or removed tool, another rule for the modes, a new mark or dataset for own widgets: each one makes a
test here fail until the guide says the same. That is the point of these tests.
"""

import re
from pathlib import Path

import pytest

from mlviz import agent_guide, agent_tools, own_data, own_widgets

KIND_WORD = {agent_tools.READ: "lesen", agent_tools.NAV: "Ansicht", agent_tools.CHANGE: "ändern"}
#: backticked words in the guide that look like a tool name but are none
NOT_TOOLS = {"pred_len"}


def table(section: str) -> list[list[str]]:
    """The rows of the first table in a section, cells without the backticks."""
    rows = [line for line in agent_guide.sections()[section][1].splitlines() if line.startswith("|")]
    cells = [[c.strip().strip("`") for c in row.strip("|").split("|")] for row in rows]
    return [r for r in cells[2:]]  # header and separator out


def test_the_guide_has_the_topics_the_agent_is_told_about():
    assert list(agent_guide.sections()) == ["faehigkeiten", "werkzeuge", "ansichten", "widgets", "eigene-widgets", "modi", "anweisungen", "rueckgaengig"]
    assert all(title and text for title, text in agent_guide.sections().values())


def test_the_tool_table_lists_exactly_the_tools_with_their_kind():
    rows = {name: kind for name, kind, _ in table("werkzeuge")}
    assert set(rows) == set(agent_tools.TOOLS), "a tool is missing in the guide or the guide names one that is gone"
    for name, kind in rows.items():
        assert kind == KIND_WORD[agent_tools.TOOLS[name].kind], f"{name}: the kind in the guide is not the one in the code"


def test_tools_named_in_the_text_exist():
    named = set(re.findall(r"`([a-z]+(?:_[a-z]+)+)`", agent_guide.GUIDE.read_text(encoding="utf-8")))
    assert named - set(agent_tools.TOOLS) - NOT_TOOLS == set()


def test_the_mode_table_says_what_needs_a_click():
    rows = {mode: cells for mode, *cells in table("modi")}
    words = {"direct": "Direkt", "mixed": "Gemischt", "confirm": "Bestätigen"}
    for mode, label in words.items():
        expected = ["fragt" if agent_tools.needs_confirmation(mode, kind) else "sofort" for kind in (agent_tools.READ, agent_tools.NAV, agent_tools.CHANGE)]
        assert rows[label] == expected, f"{label}: the guide differs from needs_confirmation"


def test_the_rules_for_own_widgets_match_the_code():
    text = agent_guide.sections()["eigene-widgets"][1]
    for word in (*own_widgets.MARKS, *own_data.SOURCES, *own_widgets.SCOPES, *own_widgets.WIDTHS, *own_widgets._FORBIDDEN_TOP):
        assert f"`{word}`" in text, f"{word} is not in the guide"
    assert f"{own_data.ROW_CAP:,}".replace(",", " ") in text


def test_every_mode_and_scope_of_the_tools_is_explained_in_the_views():
    text = agent_guide.sections()["ansichten"][1]
    for scope in own_widgets.SCOPES:
        assert f"`{scope}`" in text


# --- reading ----------------------------------------------------------------------------------------
def test_without_a_topic_help_lists_the_topics():
    out = agent_guide.read(None)
    assert all(f"`{key}`" in out for key in agent_guide.sections())
    assert agent_guide.read("  ") == out


def test_a_topic_comes_back_with_its_title_and_text():
    out = agent_guide.read("Modi")  # case does not matter
    assert out.startswith("# Modi und Bestätigungen") and "Bestätigen" in out


def test_an_unknown_topic_names_the_known_ones():
    with pytest.raises(ValueError) as e:
        agent_guide.read("nix")
    assert "faehigkeiten" in str(e.value) and "modi" in str(e.value)


def test_help_is_a_silent_backend_read_for_every_mode():
    tool = agent_tools.TOOLS["help"]
    assert tool.kind == agent_tools.READ and tool.side == "backend" and tool.silent
    assert not any(agent_tools.needs_confirmation(m, tool.kind) for m in ("direct", "mixed", "confirm"))


def test_the_guide_is_part_of_the_package():
    assert agent_guide.GUIDE.is_file() and agent_guide.GUIDE.parent.name == "mlviz"


def test_the_states_of_a_widget_named_in_the_guide_are_the_ones_the_tiles_report():
    source = (Path(__file__).resolve().parents[1] / "web" / "src" / "widgets" / "status.ts").read_text(encoding="utf-8")
    union = re.search(r"export type WidgetState =([^;]+);", source).group(1)
    states = re.findall(r'"(\w+)"', union)
    assert states and set(states) == {"loading", "ok", "error", "unavailable", "gone"}
    text = agent_guide.sections()["widgets"][1]
    for state in states:
        assert f"`{state}`" in text, f"the state {state} of a widget is not in the guide"


def test_the_system_prompt_tells_the_agent_to_report_widgets_with_a_problem():
    from mlviz import agent_run

    assert "`widgets`" in agent_run.SYSTEM_PROMPT and "Fehler" in agent_run.SYSTEM_PROMPT and "unavailable" in agent_run.SYSTEM_PROMPT


def test_a_tool_that_always_asks_is_named_in_the_modes_and_its_topic_exists():
    always = [name for name, tool in agent_tools.TOOLS.items() if tool.always_confirm]
    assert always == ["propose_note", "set_instructions"]
    modes = agent_guide.sections()["modi"][1]
    for name in always:
        assert f"`{name}`" in modes and "in jedem Modus" in modes


def test_the_instructions_topic_names_the_file_the_limit_and_the_rule_for_changes():
    from mlviz import agent_store

    text = agent_guide.sections()["anweisungen"][1]
    assert ".mlviz/agent_instructions.md" in text and str(agent_store.MAX_INSTRUCTIONS) in text and "ausdrücklich" in text
