# State formats

The organization's state lives in its repository. YAML is for anything a script reads; Markdown is for anything only people and agents read. `scripts/validate.ts` enforces everything marked as a rule here, so scripts and agents agree.

Dates are `YYYY-MM-DD`; timestamps are ISO 8601 in UTC (`2026-10-26T06:00:00Z`). Budgets are in agent-minutes, because a session's wall-clock limit is the one budget the runner can enforce; costs are recorded in USD when OMP reports them.

## Who writes what

| Path | Written by | How changes land |
| --- | --- | --- |
| `ops/charter.md` | Human only | Protected |
| `ops/policy.yaml` | Human only | Protected |
| `scoreboard/` | Human only | Protected |
| `.github/` | Human only | Protected |
| `ops/goals.yaml` | Manager proposes | Proposal branch; human merges |
| `ops/procedures/` | Manager proposes | Proposal branch; human merges |
| `ops/backlog.yaml` | Manager | Committed by the session |
| `ops/register.yaml` | Manager and runner | Committed by the session |
| `ops/contracts/` | Manager | Committed by the session |
| `ops/progress.md` | Manager and runner | Committed by the session; append-only |
| `ops/incidents/` | Manager and runner | Committed by the session; never deleted |
| `ops/reports/` | Manager and reviewer | Committed by the session |
| `docs/adr/` | Manager and workers | Committed by the session, or on the worker's branch |

Each session commits in its own worktree. The runner validates everything since the session's base commit and publishes it to the state branch: `state_branch`, or `fallback_branch` when that push is refused, for example by branch protection. On the fallback branch the runner merges main into the branch before each loop, and keeps working from it until a human merges it into main and deletes it. Approval paths never go to the state branch: the runner moves them to their own proposal branch off main, `manager/proposal-<loop>-<stamp>`, and names it in the progress log. The human approves by merging it and rejects by deleting it. Only git is used; whether anyone opens a pull request for a branch is up to them.

**Rules:** a session that changes a protected path, or anything outside `ops/` and `docs/adr/`, is rejected: work belongs to workers. In `shadow` mode, a session may change only `ops/reports/` and `ops/progress.md`. In `dispatch` mode, `ops/goals.yaml` may not change.

## `ops/policy.yaml`

```yaml
mode: shadow                  # shadow | dispatch | propose
main_branch: main
state_branch: main            # where the manager commits its own files
fallback_branch: manager/state  # used when a push to state_branch is refused
loops:
  triage:  { max_time: 10m }
  daily:   { max_time: 20m }
  weekly:  { max_time: 30m }
  monthly: { max_time: 45m }
  # optional per loop: model: <omp model or role>
budgets:
  daily_dispatch_minutes: 240   # total worker max_time started per day
  approval_threshold_minutes: 120  # larger items need human approval
limits:
  max_concurrent_work: 5
  stale_work_days: 2
  backlog_aging_weeks: 4
  max_open_goals: 5
review:
  model: null                 # a different model for report review; null skips review
worker:
  model: null
```

Schedules (daily time, weekly day, monthly day) live in the scheduler, such as cron.

## `ops/goals.yaml`

```yaml
goals:
  - id: G-001
    title: Cut lead time for approved work
    metric: lead_time_hours    # an id in scoreboard/metrics.yaml
    target: { op: "<=", value: 48 }
    deadline: 2026-12-31
    owner: manager             # manager | human
    status: active             # proposed | active | met | missed | closed
    evidence: Lead time averaged 96 hours over the last 4 weeks (scoreboard 2026-10-20)
    cost_minutes: 600          # proposals: estimated work to reach it
    displaces: null            # proposals: what it pushes back
```

**Rules:** ids are unique and match `G-` plus digits. `op` is one of `<`, `<=`, `>`, `>=`, `==`. `metric` exists in `scoreboard/metrics.yaml` when that file exists. Every goal has `evidence`. Proposed goals also have `cost_minutes` and `displaces`. Active plus proposed goals number at most `max_open_goals`.

## `ops/backlog.yaml`

```yaml
items:
  - id: B-0001
    title: Flaky checkout test blocks merges
    source: request:42         # request:<id> | branch:<name> | incident:<file> | scoreboard:<metric> | human | improver | manager
    evidence: Failed 6 of the last 20 test runs on main
    goal: G-001                # or null
    size_minutes: 45
    score: { impact: 3, evidence: 3, cost: 2, urgency: 2, total: 10 }  # each 0 to 3
    status: candidate          # candidate | approved | dispatched | done | dropped
    approval: goal             # pending | goal | human
    created: 2026-10-26
    reason: null               # why it was dropped or approved by a human
```

**Rules:** ids are unique and match `B-` plus digits. `status: approved` or `dispatched` needs `approval` of `goal` or `human`. `approval: goal` needs `goal` to name an active goal and `size_minutes` at or under `approval_threshold_minutes`. Larger items need `approval: human`, which the manager records only from a merged change or a human-applied `approved` label on the source issue. `dropped` needs a `reason`.

## `ops/register.yaml`

```yaml
items:
  - id: W-0001
    backlog: B-0001
    title: Fix flaky checkout test
    status: running            # ready | running | review | merged | failed | stalled | cancelled
    contract: ops/contracts/W-0001.md
    branch: work/W-0001
    max_time_minutes: 60
    created: 2026-10-26T06:05:00Z
    started: 2026-10-26T06:06:00Z   # set by the runner
    finished: null
    base: null                 # commit the worker started from, set by the runner
    head: null                 # branch head on origin, set by reconciliation
    cost_usd: null
    attempts: 1
    notes: null
    mismatches: {}             # set by reconciliation: kind -> count
```

**Rules:** ids are unique and match `W-` plus digits; `backlog` names an existing backlog item with `approval` of `goal` or `human`; the contract file exists; `running` items have `started`; running plus ready items number at most `max_concurrent_work`; minutes of items started or ready today sum to at most `daily_dispatch_minutes`.

The manager sets `ready`, `cancelled` and `failed`, and edits `notes`. The runner and reconciliation set `running`, `review`, `merged` and `stalled`, from ground truth. A mismatch of the same kind on the same item twice becomes a backlog item. The runner rewrites this file when it changes it, so comments in it are not kept.

## `ops/contracts/<W-id>.md`

The contract a worker receives, in the node harness's shape:

```
## Contract
Goal and usage: inputs, outputs, and how the result will be used
Checks: acceptance checks, written before dispatch
Constraints: patterns to follow; files the worker owns; out of scope
Assumptions: including expected future direction
```

The runner adds the branch name and tells the worker to start commit messages with the item id and push the branch. How the branch is proposed for review is the worker's call, following the project's normal practice.

## `ops/progress.md`

Append-only. Each session adds one entry at the end:

```
## 2026-10-26 daily

- Reconciled: W-0003 marked stalled (no live session, no pushed work).
- Dispatched: W-0004 (B-0012, 60 min). Today: 120 of 240 minutes.
- Next session: W-0003 stalled twice; cancelled, cause added as B-0015.
```

**Rule:** the file's previous contents are an unchanged prefix of its new contents.

## `ops/incidents/<YYYY-MM-DD>-<slug>.md`

```
# <title>

Status: open                   # open | resolved
Opened: 2026-10-26
Resolved:

## What happened
## Impact
## Actions
## Follow-ups
```

**Rules:** files are never deleted; `Status:` is `open` or `resolved`; a resolved incident has a `Resolved:` date.

## `ops/reports/<YYYY-MM-DD>-<loop>.md`

Free-form Markdown from the loop. The reviewer writes `<same name>.review.md` beside it.

## `scoreboard/metrics.yaml`

Human-owned. The manager reads it.

```yaml
metrics:
  - id: lead_time_hours
    description: Hours from backlog approval to merged change, median over 4 weeks
    command: scoreboard/lead-time.sh   # prints a number
```

If the human's tooling writes `scoreboard/results.yaml` (`results: { <metric id>: { value: 42, at: 2026-10-26 } }`), loops read it instead of running commands.
