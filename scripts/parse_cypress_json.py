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
    raw = open(sys.argv[1]).read() if len(sys.argv) > 1 else ""
    if not raw.strip():
        print("::error title=cypress-json::Output file empty or missing")
        return
    # The JSON reporter prints one JSON document; tolerate surrounding noise.
    data = None
    start = raw.find('{"runs"')
    if start >= 0:
        try:
            data, _ = json.JSONDecoder().raw_decode(raw[start:])
        except Exception as e:
            data = None
            print(f"::warning title=parser::raw_decode failed: {e}")
    if data is None:
        # Regex fallback: pull failure messages out of the raw output.
        import re
        msgs = re.findall(r'"state"\s*:\s*"failed".{0,800}?"message"\s*:\s*"(.*?)(?<!\\)"', raw, re.S)
        titles = re.findall(r'"fullTitle"\s*:\s*"(.{0,200}?)"', raw)
        print(f"SUMMARY parse=fallback failed={len(msgs)}")
        for i, m in enumerate(msgs[:10]):
            title = titles[i] if i < len(titles) else f"failure {i + 1}"
            flat = m.replace("\n", " ")[:500]
            print(f"::error title={esc(title)[:120]}::{esc(flat)}")
        return

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
