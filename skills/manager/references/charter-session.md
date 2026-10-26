# Charter session

Run once per organization, interactively with the human, after the repository has been created from the template and the human-only setup is done. It is the only session where you write `ops/charter.md`, `ops/policy.yaml` and `scoreboard/`, because the human is present and approves each file before it is committed.

## Before starting

Confirm with the human, and stop if any is missing:

- [ ] The repository was created from the template and has `ops/`, `scoreboard/` and `.github/`.
- [ ] `omp`, `gh`, git and Bun 1.2.21 or later are installed, and `gh auth status` succeeds with a fine-grained token scoped to the organization's repositories.
- [ ] Branch protection is on for the main branch, requiring code-owner review. Without it, nothing stops the manager from merging its own proposals.
- [ ] Spending limits are set with the model provider.
- [ ] The human has chosen where loops run: an always-on machine with cron, or GitHub Actions.

These are human steps. Do not do them for the human, even if you could.

## 1. Charter

Ask, one topic at a time, and write `ops/charter.md` from the answers:

- **Mission:** what the organization exists to do, in one or two sentences.
- **Scope:** what is in and out.
- **Never:** what the organization must never do: actions, spending, communications, data handling.
- **The human:** who approves, and how to reach them.

Read it back. The human edits until it is right.

## 2. Scoreboard

Agree 3 to 5 metrics that measure outcomes, not activity. Start from these and adapt:

| Software shop | Research group |
| --- | --- |
| Lead time from approved item to merged change | Experiments completed per week |
| Change failure rate | Share of findings independently verified |
| Open incidents and time to resolve | Open questions answered |
| Goals hit on time | Goals hit on time |
| Cost per merged change | Cost per verified finding |

For each, write an entry in `scoreboard/metrics.yaml` and a script that computes it from ground truth (`gh`, git, CI), and run it once to show the human a real number. A metric you cannot compute yet is left out, not estimated.

## 3. Policy

Walk through `ops/policy.yaml` from `state-formats.md`. Leave `mode: shadow`. Budgets depend on what the organization does and can afford; ask rather than suggest. Set `review.model` to a model different from the one loops run on.

## 4. First goals

Propose 1 to 3 goals from the charter and the scoreboard's first numbers, in the goal format, with evidence and targets. The human chooses. Write them with `status: active`.

## 5. Commit and smoke test

1. The human reviews the diff; commit it on a branch and open a pull request for them to merge.
2. After the merge, run one daily loop in shadow mode: `bun <skill dir>/scripts/run-loop.ts daily`.
3. Check with the human that it reconciled, validated and wrote a report and a progress entry, and that the report's plan is sensible.
4. Then the human turns on the schedule.
