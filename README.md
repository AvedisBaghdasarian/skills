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
