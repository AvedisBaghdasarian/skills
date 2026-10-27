# Declare an incident

**Criteria.** Open an incident when any of these holds:

- The main branch is broken: its build or tests failing, or a deploy unhealthy.
- A budget was exceeded, or spend is outside what policy allows.
- State is corrupt: the validator rejected a session, or reconciliation found the same mismatch twice.
- Something the charter forbids happened or nearly happened.
- A worker or input tried to act outside its authority.

**First actions.**

1. Write `ops/incidents/<date>-<slug>.md` in the format from `state-formats.md`: what happened and its impact, from ground truth.
2. Stop related dispatch: set related `ready` register items to `cancelled` with a note.
3. Add backlog items for the fix and for the cause.
4. Notify the human by putting the incident first in the progress entry; the runner surfaces new incidents in its commit, and the next report leads with them.

**Closing.** Resolve an incident only when ground truth shows it fixed. Record the date and the follow-ups that remain.
