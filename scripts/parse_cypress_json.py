#!/usr/bin/env python3
"""Parse Cypress JSON-reporter output and emit failures as GitHub annotations.

`npx cypress run --reporter json` prints stdout noise plus ONE mocha-style JSON
document per spec file, concatenated. This parser decodes every document in the
stream, aggregates failures/passes, and emits each failure as a `::error`
workflow command (annotation) so results are readable via the checks API where
raw CI logs are not fetchable. Falls back to regex extraction if nothing parses.
"""
import json
import sys


def esc(s: str) -> str:
    return s.replace("%", "%25").replace("\r", "%0D").replace("\n", "%0A")


def test_title(test: dict) -> str:
    t = test.get("title")
    if isinstance(t, list):
        return " › ".join(str(p) for p in t)
    if t:
        return str(t)
    return test.get("fullTitle") or test.get("id") or "unknown test"


def test_error(test: dict) -> str:
    err = test.get("err") or {}
    if err.get("message"):
        return str(err["message"])
    attempts = test.get("attempts") or []
    for attempt in reversed(attempts):
        aerr = attempt.get("error") or {}
        if aerr.get("message"):
            return str(aerr["message"])
    if test.get("displayError"):
        return str(test["displayError"])
    return "unknown error"


def collect_from_runs(data: dict, failures: list, passed: list) -> None:
    """Cypress-native shape: runs[].tests[] flat per spec."""
    for run in data.get("runs", []):
        spec = (run.get("spec") or {}).get("name", "spec")
        if run.get("error"):
            failures.append((f"[{spec}] spec error", str(run["error"])[:400]))
        for test in run.get("tests", []):
            state = test.get("state")
            if state == "failed":
                failures.append((test_title(test), test_error(test)[:400]))
            elif state == "passed":
                passed.append(test_title(test))


def walk_suites(suite: dict, failures: list, passed: list) -> None:
    for test in suite.get("tests", []):
        state = test.get("state")
        if state == "failed":
            failures.append((test_title(test), test_error(test)[:400]))
        elif state == "passed":
            passed.append(test_title(test))
    for child in suite.get("suites", []):
        walk_suites(child, failures, passed)


def collect_mocha(data: dict, failures: list, passed: list) -> None:
    """Mocha JSON reporter shape: top-level failures/passes arrays (+ suites)."""
    for f in data.get("failures", []):
        err = f.get("err") or {}
        title = f.get("fullTitle") or f.get("title") or "unknown"
        message = str(err.get("message") or "unknown error")
        if (title, message[:400]) not in failures:
            failures.append((title, message[:400]))
    for p in data.get("passes", []):
        title = p.get("fullTitle") or p.get("title") or "passed"
        if title not in passed:
            passed.append(title)
    if not failures and not passed:
        for suite in data.get("suites", []):
            walk_suites(suite, failures, passed)


def decode_documents(raw: str) -> list:
    decoder = json.JSONDecoder()
    docs = []
    idx = raw.find("{")
    while idx >= 0:
        try:
            doc, end = decoder.raw_decode(raw[idx:])
            docs.append(doc)
            idx = raw.find("{", idx + end)
        except Exception:
            idx = raw.find("{", idx + 1)
    return docs


def main() -> None:
    raw = open(sys.argv[1]).read() if len(sys.argv) > 1 else ""
    if not raw.strip():
        print("::error title=cypress-json::Output file empty or missing")
        return

    docs = decode_documents(raw)
    if not docs:
        import re
        msgs = re.findall(r'"state"\s*:\s*"failed".{0,800}?"message"\s*:\s*"(.*?)(?<!\\)"', raw, re.S)
        titles = re.findall(r'"fullTitle"\s*:\s*"(.{0,200}?)"', raw)
        print(f"SUMMARY parse=fallback failed={len(msgs)}")
        for i, m in enumerate(msgs[:10]):
            title = titles[i] if i < len(titles) else f"failure {i + 1}"
            flat = m.replace("\\n", " ")[:500]
            print(f"::error title={esc(title)[:120]}::{esc(flat)}")
        return

    failures: list = []
    passed: list = []
    for data in docs:
        if not isinstance(data, dict):
            continue
        if "runs" in data:
            collect_from_runs(data, failures, passed)
        else:
            collect_mocha(data, failures, passed)

    print(f"SUMMARY passed={len(passed)} failed={len(failures)}")
    for title, message in failures[:10]:
        print(f"::error title={esc(title)[:120]}::{esc(message)[:600]}")
    if len(failures) > 10:
        print(f"::error title=more-failures::{len(failures) - 10} additional failures not shown")


if __name__ == "__main__":
    main()
