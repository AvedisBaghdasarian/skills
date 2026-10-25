# Setting up the node harness in an Oh My Pi project

The skill alone gives every agent the method. Setup adds what a skill cannot carry: runtime limits, a `node` agent for structured returns, an entry command, and the shared project files. Run it once per project.

OMP changes quickly, and setting keys, frontmatter fields and command locations differ between versions. Before writing anything, check the installed version's documentation (in particular `docs/tools/task.md` and `docs/magic-keywords.md` in the OMP repository) and adjust the names below to match. Tell the user about anything that differs.

## 1. Runtime settings

Apply these as project settings, using the values from `.harness/policy.md` if it exists, otherwise from `policy.md`:

```
omp config set async.enabled true
omp config set task.maxConcurrency 25
omp config set task.maxRecursionDepth 2
omp config set task.softRequestBudget 200
omp config set task.isolation.mode auto
omp config set magicKeywords.orchestrate false
```

Async lets a dividing node replan as each child finishes. Disabling `orchestrate` matters: its hidden instruction delegates substantial work by default, which competes with implementing by default.

## 2. The node agent

Create `.omp/agents/node.md`:

```markdown
---
name: node
description: A node in the node harness. Receives a contract, follows the node-harness skill, and returns a structured result.
spawns: [node]
---

Use the node-harness skill. Follow its procedure for the contract in your task.
```

If the installed version supports an output schema in agent frontmatter, add one matching the Return shape in `SKILL.md` (result, checks, decisions, pushback) with strict validation, so OMP rejects malformed returns.

OMP has self-recursion prevention. If it stops `node` from spawning `node`, create tiered agents instead (`node-1` spawns `node-2`, and `node-2` spawns nothing), which also makes depth explicit.

## 3. The entry command

Create a project slash command named `build` in the location the installed version reads commands from:

```markdown
Use the node-harness skill. Act as the top-level node. Your contract is the user's request: $ARGUMENTS
```

The main session is not an agent file, so it needs this entry point to start as a node.

## 4. Project files

- `.harness/policy.md`: copy `policy.md` here so the project can tune its own numbers.
- `GLOSSARY.md`: domain terms with one-line definitions. Start it empty with a heading; agents add terms as they define them.
- `docs/adr/0001-record-architecture-decisions.md`: the first ADR, recording that this project uses ADRs.

Skip any that already exist, and if the domain-modeling skill already keeps a glossary or ADRs elsewhere, use those.

## 5. Smoke test

Run `/build` on a small real task. Check that:

- The node collapses the procedure for a small task instead of writing out every step.
- A return has the four parts: result, checks, decisions, pushback.
- A child can be spawned with the skill named in its task text (this also shows whether self-recursion prevention applies).
- The bundled `reviewer` agent works as a clean-context reviewer. If it does not, add a custom reviewer agent.
