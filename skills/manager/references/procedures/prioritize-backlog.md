# Prioritize the backlog

Score each item from 0 to 3 on each axis and record the scores in `score`.

| Axis | 0 | 3 |
| --- | --- | --- |
| impact | Serves no active goal | Directly moves an active goal's metric |
| evidence | Hunch | Measured from a tool or the scoreboard |
| cost | Over the approval threshold | A small fraction of a day's dispatch budget |
| urgency | Can wait a month | Blocks other work or is an open incident |

1. `total` is the sum. Order by total, then by age.
2. Rescore only items whose evidence, goal or cost changed; note why.
3. Items older than `backlog_aging_weeks` with total under 6: drop with a reason, unless a goal depends on them.
4. An item that was dropped and has come back is noted in the weekly report; it may signal a missing goal.
5. Mark `approved` with `approval: goal` only when the item serves an active goal and is within the approval threshold. Otherwise leave it `candidate` and list it in the report for the human.
