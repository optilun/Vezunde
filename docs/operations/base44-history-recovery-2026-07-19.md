# Base44 history recovery - 2026-07-19

## Incident

Base44 Version History referenced commit `827623f11ae6f020f0d93f9a2a56cc29bb7029c6` (`noop`). That commit was created on top of `e35fdf4f1ba3235103049c8823a3fb7653c2e5b1`, then `main` was rewritten to a different history line containing the real implementation commits.

GitHub comparison at recovery time:

- previous Base44 tip: `827623f11ae6f020f0d93f9a2a56cc29bb7029c6`;
- common ancestor: `e35fdf4f1ba3235103049c8823a3fb7653c2e5b1`;
- valid `main` tip before this recovery commit: `d877a76556ed3350bddec6c6960ed5d46a269e7e`;
- relation: histories diverged; the Base44 tip was one removed commit, while `main` contained 20 commits after the common ancestor.

## Recovery

This commit creates a new normal descendant of the valid `main` history so the GitHub-Base44 connection can create a fresh version from a reachable commit.

No application code, entity schema or production data is changed by this recovery.

## Rule

Do not force-push or reset `main` after Base44 has observed a commit. Use branches and pull requests only. Do not add temporary `noop` or placeholder commits directly to `main`.
