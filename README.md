# Skills

A collection of agent skills. Each folder under `skills/` is self-contained.

## Install

```
npx skills add AvedisBaghdasarian/skills
```

Or copy a single skill folder into your agent's skills directory.

## Skills

### node-harness

A recursive, interface-first harness for large or multi-agent work. Every agent settles interfaces before internals, then implements, divides the work across subagents with contracts and acceptance checks, or continues serially. Includes a fan-out pattern for migrations and research, and a one-time setup for Oh My Pi.

- Run it: `/build <task>` after setup, or ask your agent to use the node-harness skill.
- Set it up in a project: ask your agent to set up the node harness.
- Tune it: every number lives in `.harness/policy.md` in your project.

#### Companion skills

node-harness uses these if they are installed and works without them. All are from [mattpocock/skills](https://github.com/mattpocock/skills) (MIT). Install them separately.

| Skill | Used for | Path |
| --- | --- | --- |
| grilling | Questioning the user | [`skills/productivity/grilling`](https://github.com/mattpocock/skills/tree/main/skills/productivity/grilling) |
| domain-modeling | Glossary and ADRs | [`skills/engineering/domain-modeling`](https://github.com/mattpocock/skills/tree/main/skills/engineering/domain-modeling) |
| tdd | Meeting acceptance checks | [`skills/engineering/tdd`](https://github.com/mattpocock/skills/tree/main/skills/engineering/tdd) |
| code-review | The two-axis review | [`skills/engineering/code-review`](https://github.com/mattpocock/skills/tree/main/skills/engineering/code-review) |
| prototype | Settling choices reading cannot | [`skills/engineering/prototype`](https://github.com/mattpocock/skills/tree/main/skills/engineering/prototype) |
| handoff | Serial phases | [`skills/productivity/handoff`](https://github.com/mattpocock/skills/tree/main/skills/productivity/handoff) |
| retro | Improving the setup after a run | [`skills/engineering/retro`](https://github.com/mattpocock/skills/tree/main/skills/engineering/retro) |

### manager

Runs an ongoing operation, such as a software shop or a research group, from records in its own repository. Short headless loops (triage, daily, weekly, monthly) reconcile state with ground truth, prioritize work, propose goals, and dispatch work to node-harness workers. The human approves anything consequential by merging the manager's pull requests.

- Requires: Bun 1.2.21 or later, git, an authenticated `gh`, `omp`, and the node-harness skill from this repository. No npm packages.
- Set it up: create the organization's repository, do the human-only setup in `skills/manager/references/charter-session.md`, then ask your agent to hold the manager's charter session.
- Run a loop: `bun skills/manager/scripts/run-loop.ts daily` from the organization's repository, on a schedule from cron or GitHub Actions. Triage takes `--event <payload.json>`.
- Tune it: every number lives in the organization's `ops/policy.yaml`, which only the human edits.
