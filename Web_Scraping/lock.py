"""PID-based mutual exclusion so two Groq-calling scripts can't run at once.

WHY THIS EXISTS
------------------
On 2026-08-24, a background verify_title_match.py run (launched, then
believed killed) was still alive when a second, foreground attempt started —
both made Groq calls concurrently against the same already-near-exhausted
daily quota, doubling the waste. This lock closes that specific hole: any
script that calls Groq acquires config.LOCK_PATH first and refuses to start
if another process already holds it and is still alive.

One lock shared across every Groq-calling script (not per-script), because
the resource being protected — the daily token quota — is shared, not
script-local. pipeline.py and verify_title_match.py must not run
concurrently with EACH OTHER either, not just with copies of themselves.

The lock file's content (PID|script_name|start_time) is also the answer to
"what's currently running and what's its PID" — read it directly
(`cat cache/groq.lock` or equivalent) rather than hunting through logs, which
is what made the stray process hard to identify quickly on 2026-08-24.
"""

import os
import subprocess
import time

import config


class AlreadyRunningError(RuntimeError):
    pass


def _pid_alive(pid: int) -> bool:
    """Windows-specific liveness check (this environment) via `tasklist`,
    since os.kill(pid, 0) doesn't have POSIX signal-0 semantics on Windows.
    On any failure to check, assumes alive — a false "still running" just
    means a manual override is needed; a false "not running" would let two
    runs collide, which is the exact failure this module exists to prevent."""
    try:
        result = subprocess.run(
            ["tasklist", "/FI", f"PID eq {pid}", "/NH"],
            capture_output=True, text=True, timeout=5,
        )
        return str(pid) in result.stdout
    except Exception:
        return True


def acquire(script_name: str) -> int:
    """Returns this process's PID on success. Raises AlreadyRunningError if
    another live process already holds the lock. A lock file left behind by
    a process that no longer exists (e.g. force-killed, so its `finally`
    never ran) is detected as stale via _pid_alive() and safely taken over —
    this is deliberate: a taskkill /F on 2026-08-24 would otherwise have left
    a permanent false "still running" lock with no way to clear it except by
    hand."""
    if os.path.exists(config.LOCK_PATH):
        with open(config.LOCK_PATH, encoding="utf-8") as f:
            content = f.read().strip()
        old_pid = None
        try:
            old_pid_str, old_script, old_started = content.split("|", 2)
            old_pid = int(old_pid_str)
        except ValueError:
            old_script, old_started = "unknown", "unknown"
        if old_pid is not None and _pid_alive(old_pid):
            raise AlreadyRunningError(
                f"Another Groq-calling run is already in progress: PID {old_pid} "
                f"({old_script}, started {old_started}). Refusing to start a second one "
                f"against the same shared daily quota. If you're certain it's stale: "
                f"taskkill /PID {old_pid} /F"
            )
        # Lock file's PID is dead — stale, safe to take over.

    os.makedirs(os.path.dirname(config.LOCK_PATH), exist_ok=True)
    pid = os.getpid()
    with open(config.LOCK_PATH, "w", encoding="utf-8") as f:
        f.write(f"{pid}|{script_name}|{time.strftime('%Y-%m-%dT%H:%M:%S')}")
    print(f"[lock] acquired by PID {pid} ({script_name}) -> {config.LOCK_PATH}")
    return pid


def release() -> None:
    if os.path.exists(config.LOCK_PATH):
        os.remove(config.LOCK_PATH)
        print("[lock] released")
