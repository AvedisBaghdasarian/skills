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
