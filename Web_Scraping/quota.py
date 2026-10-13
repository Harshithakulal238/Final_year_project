"""Tracks cumulative Groq token spend against the account's daily cap, so
remaining budget is visible at any moment instead of being discovered by
hitting a wall mid-run (which is what happened on 2026-08-24 — see
extract.py's DailyQuotaExhaustedError for what happens if the cap IS hit
despite a pre-flight check having passed, e.g. because actual usage ran
ahead of estimate).

WHY A ROLLING WINDOW, NOT "SINCE MIDNIGHT"
--------------------------------------------
Confirmed live from Groq's own 429 error body (see extract.py's
_parse_tpd_error): near-simultaneous calls on 2026-08-24 reported wildly
different "please try again in" durations (22s up to 3m12s) for the same
account. That's only consistent with each request's remaining budget being
computed against a trailing 24h window of actual usage, not a fixed
calendar-day reset — so usage_last_24h() sums the last 24 hours from now,
not "since midnight."

The log (config.QUOTA_LOG_PATH) is JSON-lines, one line per Groq call
attempt, including 0-token entries for calls rejected before any generation
happened — so the audit trail survives regardless of whether a given call
actually succeeded.
"""

import json
import os
import time
from datetime import datetime, timezone

import config

ROLLING_WINDOW_SECONDS = 24 * 60 * 60


def log_usage(total_tokens: int, purpose: str = "chat_completion") -> None:
    os.makedirs(os.path.dirname(config.QUOTA_LOG_PATH), exist_ok=True)
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "total_tokens": total_tokens,
        "purpose": purpose,
    }
    with open(config.QUOTA_LOG_PATH, "a", encoding="utf-8") as f:
        f.write(json.dumps(entry) + "\n")


def _read_log() -> list:
    if not os.path.exists(config.QUOTA_LOG_PATH):
        return []
    entries = []
    with open(config.QUOTA_LOG_PATH, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entries.append(json.loads(line))
            except json.JSONDecodeError:
                continue  # tolerate a partially-written last line from a killed process
    return entries


def usage_last_24h() -> int:
    cutoff = time.time() - ROLLING_WINDOW_SECONDS
    total = 0
    for entry in _read_log():
        try:
            ts = datetime.fromisoformat(entry["timestamp"]).timestamp()
        except (KeyError, ValueError):
            continue
        if ts >= cutoff:
            total += entry.get("total_tokens", 0)
    return total


def remaining_daily_budget() -> int:
    return max(0, config.DAILY_TOKEN_CAP - usage_last_24h())


def estimated_tokens_per_call() -> float:
    """Prefers the actual observed average from recent real calls over the
    documented fallback estimate — accuracy improves the more this pipeline
    actually runs, instead of relying on a static guess forever."""
    recent = [e.get("total_tokens", 0) for e in _read_log()
              if e.get("purpose") == "chat_completion" and e.get("total_tokens", 0) > 0]
    if not recent:
        return config.ESTIMATED_TOKENS_PER_CALL_DEFAULT
    return sum(recent) / len(recent)


def oldest_entry_age_seconds() -> float:
    """Seconds until the oldest entry currently counted in the rolling
    window ages out of it — a lower bound on when ANY budget next frees up.
    Not a guarantee that enough frees up for a specific run; just the
    earliest possible moment more than zero does."""
    cutoff = time.time() - ROLLING_WINDOW_SECONDS
    oldest_in_window = None
    for entry in _read_log():
        try:
            ts = datetime.fromisoformat(entry["timestamp"]).timestamp()
        except (KeyError, ValueError):
            continue
        if ts >= cutoff and (oldest_in_window is None or ts < oldest_in_window):
            oldest_in_window = ts
    if oldest_in_window is None:
        return 0.0
    return max(0.0, (oldest_in_window + ROLLING_WINDOW_SECONDS) - time.time())
