#!/usr/bin/env python3
"""Parse Cypress JSON-reporter output and emit failures as GitHub annotations.

Used in CI where raw logs are not retrievable by tooling; annotations surface
through the checks API so failure details are readable anywhere.
"""
import json
import sys


def esc(s: str) -> str:
    return s.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A").replace(":", "%3A")


def walk_suite(suite: dict, failures: list, passed: list):
    for test in suite.get("tests", []):
        state = test.get("state")
        title_parts = test.get("title")
        if isinstance(title_parts, list):
            title = " › ".join(str(p) for p in title_parts)
        else:
            title = str(title_parts)
        if state == "failed":
            err = ((test.get("err") or {}).get("message") or "unknown error").split("\n")
            code_frame = ""
            failures.append((title, err[0][:400], code_frame))
        elif state == "passed":
            passed.append(title)
    for child in suite.get("suites", []):
        walk_suite(child, failures, passed)


def main() -> None:
    raw = open(sys.argv[1]).read()
    # The JSON reporter prints one JSON document; find it defensively.
    start = raw.find('{"runs"')
    data = json.loads(raw[start:]) if start >= 0 else json.loads(raw)

    failures: list = []
    passed: list = []
    for run in data.get("runs", []):
        spec = (run.get("spec") or {}).get("name", "spec")
        if run.get("error"):
            failures.append((f"[{spec}] spec load error", str(run["error"])[:400], ""))
        for suite in run.get("suites", []):
            walk_suite(suite, failures, passed)

    print(f"SUMMARY passed={len(passed)} failed={len(failures)}")
    for i, (title, message, _frame) in enumerate(failures[:10]):
        print(f"::error title={esc(title)[:120]}::{esc(message)[:600]}")
    if len(failures) > 10:
        print(f"::error title=more failures::{len(failures) - 10} additional failures not shown")


if __name__ == "__main__":
    main()
