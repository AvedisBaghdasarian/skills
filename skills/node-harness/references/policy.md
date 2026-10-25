# Harness policy defaults

Every number the harness uses is named here. To change one for a project, create `.harness/policy.md` in the project with the same names; its values win. Runtime limits are enforced by the agent harness's own settings (see `setup-omp.md`) and are listed here so all numbers live in one view.

## Policy parameters

| Name | Default | Meaning |
| --- | --- | --- |
| split threshold | 10 agent-minutes | At or under this, implement directly |
| minimum child size | 3 agent-minutes | Smallest child worth the cost of a contract |
| procedure-first trigger | 20 similar instances | Fan out a writing procedure at or above this |
| pilot instances | 3, at least one awkward | Instances a procedure is tried on before fanning out |
| research starting width | 8 | Agents in a reading fan-out at first |
| research maximum width | 25 | Upper limit for a reading fan-out |
| synthesis group size | 5 | Returns reduced together in each synthesis stage |
| typical children per division | 3 to 5 | More suggests a bad split |

## Runtime limits (set in harness settings)

| Name | Default | OMP setting |
| --- | --- | --- |
| maximum recursion depth | 2 | `task.maxRecursionDepth` |
| maximum concurrent subagents | 25 | `task.maxConcurrency` |
| soft request budget | 200 | `task.softRequestBudget` |
| hard wall clock per spawn | off; set per run | `task.maxRuntimeMs` |

## Executable-contract policy

Default: executable checks wherever test tooling exists, prose acceptance criteria otherwise. The top-level node may change this for a run and records why, because model-judged criteria are less reliable than executable ones.

## Estimate anchors

Nodes estimate against these rather than from scratch. Replace the placeholder with up to 5 worked examples from real runs, and refresh them as calibration data comes in: if actual runtimes keep exceeding estimates, update the anchors and, if needed, the split threshold.

| Task | Estimated | Actual |
| --- | --- | --- |
| (add examples from real runs) | | |
