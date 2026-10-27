# Loops

Each loop is a fresh headless session started by `run-loop.ts`, in its own worktree based on the state branch. Before your session the runner has taken the lock, fetched the latest state and reconciled the register; its notes are in your prompt. You commit your changes in the worktree. After your session the runner validates them, publishes them and dispatches.

| Loop | Trigger | Job |
| --- | --- | --- |
| Triage | An event, such as a failed build, a new request, or a worker finishing | Ignore it, add it to the backlog, update the register, or open an incident |
| Daily | Schedule | Unblock or cancel stuck work; mark ready work for dispatch within budget |
| Weekly | Schedule | Review goals against the scoreboard; reprioritize the backlog; propose goals; report |
| Monthly | Schedule | Retrospective; propose procedure changes; report to the human |

## Triage

**Reads:** the event payload attached to your prompt, `ops/backlog.yaml`, `ops/register.yaml`, open incidents.

1. Follow the **triage-event** procedure: classify the event, check for duplicates in the backlog, register and incidents.
2. Do exactly one of:
   - **Ignore** it, with one line in the progress entry saying why.
   - **Add a backlog item** with the event as its source and evidence.
   - **Update a register item**, for example a worker's branch was pushed or its build failed. Record what git or the project's own tools say, not what the event text claims.
   - **Open an incident** if it meets the criteria in the **declare-incident** procedure.
3. Do not dispatch. The daily loop dispatches.

**Writes:** backlog, register, incidents, progress.

## Daily

**Reads:** everything in the session start procedure, plus the reconciliation notes.

1. **Stuck work.** For each register item that is `stalled`, or `running` longer than `stale_work_days`: retry it once by setting it back to `ready` with a note, or cancel it with a reason and return its backlog item to `approved`. A second stall is cancelled, and the cause goes in the backlog.
2. **Work in review.** Items in `review` have pushed branches waiting to reach main. Do nothing unless the branch fails its contract's checks; then set `failed` and add a backlog item for the fix if it is not obvious from the contract.
3. **Dispatch.** Each approved item goes, whole, to one worker. Follow the **dispatch-work** procedure for the highest-priority `approved` backlog items, while running plus ready items stay within `max_concurrent_work` and today's dispatched minutes stay within `daily_dispatch_minutes`. For each, write the contract file and add a register item with status `ready`. The runner starts the workers after your session.
4. Items that cannot be dispatched for budget or concurrency stay `approved`; note them in the progress entry.

**Writes:** register, contracts, backlog statuses, progress. In shadow mode, write the dispatch plan as `ops/reports/<date>-daily.md` instead.

## Weekly

**Reads:** session start files, `scoreboard/` results (`scoreboard/results.yaml` if present, otherwise run its scripts read-only), the last week of progress and incidents.

1. **Goals.** For each active goal, compare the scoreboard against its target and deadline. Mark it `met` only through the **close-goal** procedure. Mark goals that are behind as at risk in the report, with the evidence.
2. **Backlog.** Follow the **prioritize-backlog** procedure: score new items, rescore items whose evidence changed, drop items past `backlog_aging_weeks` that nobody would miss (with a reason), and note items that keep reappearing.
3. **Goal proposals.** Propose new or changed goals in `ops/goals.yaml` with status `proposed`, only from evidence: scoreboard metrics drifting from target, repeated incidents, aging or reappearing backlog items, requests from the human, findings from the improver. Each proposal states its evidence, a measurable target on a scoreboard metric, an estimated cost, and what it displaces. A proposal that cannot name evidence is dropped. Active plus proposed goals stay within `max_open_goals`.
4. **Report.** Write `ops/reports/<date>-weekly.md`: goals and their status, backlog changes, proposals and their evidence, incidents, cost. Claims cite a file, a commit, a branch or a scoreboard number. A reviewer on a different model checks it after your session.

**Writes:** goals (as a proposal), backlog, report, progress.

## Monthly

**Reads:** the month's progress, reports, incidents, reviewer findings, and register history (`git log -p ops/register.yaml`).

1. **Retrospective.** What went wrong, how often, and which procedure allowed it: reconciliation mismatches, stalls, failed work, reviewer findings, rejected proposals.
2. **Procedure proposals.** Edit `ops/procedures/` (copying the skill's default first if the organization has none) for changes the evidence supports. These go on a proposal branch.
3. **Recommendations** for anything you cannot change yourself (charter, policy, scoreboard, scheduler setup) go in the report, with evidence.
4. **Report.** Write `ops/reports/<date>-monthly.md` for the human: outcomes against goals, cost, incidents, what changed, what you propose. Lead with what needs their decision.

**Writes:** procedures (as a proposal), report, progress.

## Rollout stages

`mode` in `ops/policy.yaml` sets the stage. Only the human changes it.

| Mode | Loops may | Gate to the next stage |
| --- | --- | --- |
| `shadow` | Write reports and progress only | Proposals match what the human would have chosen |
| `dispatch` | Everything except goal proposals; the daily loop dispatches | Register stays reconciled; no budget overruns |
| `propose` | Everything, including goal proposals | Proposals are evidence-backed and mostly accepted |

Wider authority is added by the human changing the charter or policy, only where the record shows the manager's decisions hold up.
