"""The settings of a project (v0.3.0, feature A): one small file, only what differs from the default.

`<project>/.mlviz/settings.json` is a flat JSON object `{"look.scale": 115, "agent.mode": "direct"}`. A value equal to
its default is removed from the file; a key this version does not know, or a value it cannot use, is ignored but kept
in the file (an older or newer tool wrote it). A file that cannot be read means all defaults and a warning; it is only
overwritten when a value is changed. The screen (`web/src/settings/`) reads and changes the values through the API;
the backend reads the ones it needs through `SettingsStore.get`.

`SCHEMA` knows every setting that holds a value (the screen also has action rows, which hold none): kind, default and
the range or the options. Where the options depend on the project (`runs.feature`, `runs.metric`, `ana.template`) any
non-empty text is accepted and the user of the value falls back to the default for a text it does not know.
"""

from __future__ import annotations

import json
import os
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .project import Project

STATE_DIR = ".mlviz"
FILE = "settings.json"


@dataclass(frozen=True)
class Spec:
    key: str
    kind: str  # enum | choice (options depend on the project) | bool | num | text
    default: Any
    options: tuple[str, ...] = ()
    min: int | None = None
    max: int | None = None
    step: int = 1
    #: environment variable the setting overrides (the row says so when both exist)
    env: str | None = None

    def clean(self, value: Any) -> Any:
        """The value in the form it is stored in, or ValueError if it cannot be this setting's value."""
        if self.kind == "bool":
            if isinstance(value, bool):
                return value
        elif self.kind == "num":
            if isinstance(value, (int, float)) and not isinstance(value, bool) and self.min <= value <= self.max:
                if (value - self.min) % self.step == 0:
                    return int(value)
        elif self.kind == "enum":
            if isinstance(value, str) and value in self.options:
                return value
        elif self.kind == "choice":
            if isinstance(value, str) and value.strip():
                return value
        elif self.kind == "text":
            if isinstance(value, str) and len(value) <= 4000:
                return value
        raise ValueError(f"{self.key}: ungültiger Wert {value!r}")


def _enum(key, default, *options, **kw) -> Spec:
    return Spec(key, "enum", default, tuple(options), **kw)


SPECS: tuple[Spec, ...] = (
    _enum("look.density", "comfortable", "comfortable", "compact"),
    Spec("look.scale", "num", 100, min=85, max=125, step=5),
    _enum("look.decimal", "de", "de", "en"),
    _enum("look.time", "rel", "rel", "abs"),
    Spec("look.motion", "bool", True),
    Spec("runs.feature", "choice", "auto"),
    Spec("runs.metric", "choice", "yaml"),
    _enum("runs.descOpen", "open", "open", "closed"),
    Spec("runs.overview", "bool", True),
    Spec("runs.notifyMac", "bool", True),
    Spec("runs.errWarn", "num", 5, min=1, max=50, step=1),
    Spec("runs.stallMin", "num", 30, min=10, max=240, step=10),
    _enum("ana.width", "auto", "auto", "half", "full"),
    Spec("ana.template", "choice", "last"),
    _enum("exp.theme", "light", "light", "dark"),
    _enum("exp.scale", "2", "1", "2", "3"),
    Spec("exp.footer", "bool", True),
    Spec("exp.folder", "text", "{deliverables}/{datum} {titel}/"),
    Spec("exp.name", "text", "{nr}_{widget}.png"),
    _enum("agent.mode", "mixed", "direct", "mixed", "confirm"),
    Spec("agent.debug", "bool", False),
    _enum("agent.voiceLang", "de", "de", "en", "auto"),
    _enum("agent.voiceModel", "small", "small", "medium"),
    Spec("agent.voiceReview", "bool", True),
    Spec("agent.voiceTerms", "text", ""),
    Spec("agent.cacheWarn", "num", 50, min=10, max=200, step=10),
    Spec("agent.quota", "bool", True),
    Spec("agent.claude", "text", "", env="MLVIZ_CLAUDE"),
)
SCHEMA: dict[str, Spec] = {s.key: s for s in SPECS}
DEFAULTS: dict[str, Any] = {s.key: s.default for s in SPECS}


class SettingsStore:
    def __init__(self, project: Project):
        self.path = project.root / STATE_DIR / FILE
        self._lock = threading.RLock()

    # --- reading ---------------------------------------------------------------------------------
    def _read(self) -> tuple[dict[str, Any], str | None]:
        """Everything in the file (also keys and values this version cannot use) and a warning if it cannot be read."""
        try:
            raw = self.path.read_text(encoding="utf-8")
        except FileNotFoundError:
            return {}, None
        except OSError as e:
            return {}, f"Die Einstellungsdatei ließ sich nicht lesen ({e.strerror or e})."
        try:
            data = json.loads(raw)
        except ValueError:
            return {}, "Die Einstellungsdatei ist kein gültiges JSON. Es gelten die Standardwerte, bis eine Einstellung geändert wird."
        if not isinstance(data, dict):
            return {}, "Die Einstellungsdatei hat nicht die erwartete Form. Es gelten die Standardwerte, bis eine Einstellung geändert wird."
        return data, None

    def overrides(self) -> dict[str, Any]:
        """The values that differ from the default and that this version can use."""
        data, _ = self._read()
        out = {}
        for key, value in data.items():
            spec = SCHEMA.get(key)
            if spec is None:
                continue
            try:
                clean = spec.clean(value)
            except ValueError:
                continue
            if clean != spec.default:
                out[key] = clean
        return out

    def warning(self) -> str | None:
        return self._read()[1]

    def get(self, key: str) -> Any:
        """The value of a setting (the default when the file has none or an unusable one)."""
        if key not in SCHEMA:
            raise KeyError(key)
        return self.overrides().get(key, SCHEMA[key].default)

    def explicit(self, key: str) -> bool:
        return key in self.overrides()

    # --- changing ---------------------------------------------------------------------------------
    def change(self, set_: dict[str, Any] | None = None, unset: list[str] | None = None) -> dict[str, Any]:
        """Sets and resets values in one write. Raises ValueError (nothing is written) for an unknown key or an unusable value."""
        set_ = set_ or {}
        unset = unset or []
        cleaned: dict[str, Any] = {}
        for key, value in set_.items():
            spec = SCHEMA.get(key)
            if spec is None:
                raise ValueError(f"Die Einstellung {key} gibt es nicht.")
            cleaned[key] = spec.clean(value)
        for key in unset:
            if key not in SCHEMA:
                raise ValueError(f"Die Einstellung {key} gibt es nicht.")
        with self._lock:
            data, _ = self._read()  # a file that cannot be read is replaced now: a value was changed
            for key in unset:
                data.pop(key, None)
            for key, value in cleaned.items():
                if value == SCHEMA[key].default:
                    data.pop(key, None)
                else:
                    data[key] = value
            self._write(data)
        return self.overrides()

    def _write(self, data: dict[str, Any]) -> None:
        if not data:
            self.path.unlink(missing_ok=True)
            return
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(dict(sorted(data.items())), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        os.replace(tmp, self.path)

    def raw(self) -> dict[str, Any]:
        """The whole file as it is (for an export that must not lose what this version does not know)."""
        return self._read()[0]

    # --- what the screen needs --------------------------------------------------------------------
    def payload(self, project: Project) -> dict[str, Any]:
        from . import __version__

        return {
            "values": self.overrides(),
            "defaults": DEFAULTS,
            "warning": self.warning(),
            "file": f"{STATE_DIR}/{FILE}",
            "project_path": str(project.root),
            "version": __version__,
            #: settings that override an environment variable: the row says so
            "env": {s.key: s.env for s in SPECS if s.env and os.environ.get(s.env)},
        }
