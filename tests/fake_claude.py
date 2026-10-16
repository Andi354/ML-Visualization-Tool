#!/usr/bin/env python3
"""Stand-in for `claude` in the tests (MLVIZ_CLAUDE): answers like `claude -p ... --output-format stream-json`.

Special words in the message: [error] ends with a usage-limit error, [sleep] waits (for the stop test),
[blocks] answers in two blocks, [silent] prints nothing and fails. Every call is appended to $FAKE_CLAUDE_LOG
(one JSON line with the arguments) so a test can look at what was run. FAKE_CLAUDE_LOGGED_OUT=1 is a missing login.
"""

import json
import os
import sys
import time
import uuid

args = sys.argv[1:]
log = os.environ.get("FAKE_CLAUDE_LOG")
if log:
    with open(log, "a") as f:
        f.write(json.dumps({"args": args, "cwd": os.getcwd()}) + "\n")


def out(o):
    print(json.dumps(o), flush=True)


if args[:2] == ["auth", "status"]:
    logged = not os.environ.get("FAKE_CLAUDE_LOGGED_OUT")
    print(json.dumps({"loggedIn": logged}))
    sys.exit(0 if logged else 1)

prompt = args[args.index("-p") + 1]
session = args[args.index("--resume") + 1] if "--resume" in args else str(uuid.uuid4())
out({"type": "system", "subtype": "init", "session_id": session})
out(
    {
        "type": "rate_limit_event",
        "rate_limit_info": {"unifiedWindows": {"five_hour": {"utilization": 0.24}, "seven_day": {"utilization": 0.65}}},
    }
)
if prompt == "/compact":
    out({"type": "system", "subtype": "compact_boundary", "session_id": session, "compact_metadata": {"trigger": "manual", "pre_tokens": 51617, "post_tokens": 2010}})
    out({"type": "result", "subtype": "success", "is_error": False, "result": "", "usage": {"input_tokens": 0}})
    sys.exit(0)
if "[silent]" in prompt:
    print("boom: something broke", file=sys.stderr)
    sys.exit(1)
if "[sleep]" in prompt:
    time.sleep(60)
tokens = 1000 + 10 * len(prompt)
usage = {"input_tokens": 2, "cache_creation_input_tokens": 0, "cache_read_input_tokens": tokens - 2, "output_tokens": 5}


def say(text):
    out({"type": "assistant", "message": {"role": "assistant", "content": [{"type": "text", "text": text}], "usage": usage}, "parent_tool_use_id": None})


if "[error]" in prompt:
    out({"type": "result", "subtype": "success", "is_error": True, "result": "Usage limit reached", "usage": usage})
    sys.exit(1)
last = prompt.splitlines()[-1]
if "[blocks]" in prompt:
    say("Erster Teil.")
    time.sleep(0.2)
    say("Zweiter Teil.")
else:
    say(f"Antwort auf: {last}")
out({"type": "result", "subtype": "success", "is_error": False, "result": "ok", "usage": usage, "modelUsage": {"fake": {"contextWindow": 200000}}})
