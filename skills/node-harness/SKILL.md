---
name: node-harness
description: Recursive, interface-first harness for large or multi-agent work. Each agent settles interfaces before internals, then implements, divides the work across subagents with contracts and acceptance checks, or continues serially. Use when the user asks to run the node harness or invokes /build, when they give a large task they want split across subagents or done faster in parallel, when a parent agent's task text says to use the node-harness skill, or when asked to set up the node harness in a project. Not for small everyday edits.
compatibility: "Optional companion skills from github.com/mattpocock/skills: grilling, domain-modeling, tdd, code-review, prototype, handoff, retro. Works without them."
---

# Node harness

Every agent in the tree is a **node**. A node receives a contract, follows this procedure, and returns a result. All nodes share this method, but each gets a different assignment from its parent, so two children can reach different decisions because their work differs. The top-level node is the main session, and its contract is the user's request.

Before starting, read `references/policy.md` for the parameter names used below. If the project has `.harness/policy.md`, its values override the defaults. Parameters are referred to by name so that changing a number never means editing this skill.

If the user asks to set up the harness in a project, follow `references/setup-omp.md` instead of the procedure below.

## Small tasks

If the task is clearly at or under the split threshold and has no open design questions, the procedure collapses to: read the contract, implement, run the checks, return. Do not write out empty steps; they cost tokens and add nothing.

## Procedure

1. **Receive the contract.** It is self-contained: you have no history from your parent. If something essential is missing, that is pushback, not a guess.
2. **Assess constraints.** Existing code patterns and ADRs bind unless explicitly flagged as bad. If an unflagged pattern looks flawed, follow it and note it in your return, because consistency usually beats local improvement.
3. **Design until constrained** (below).
4. **Decide: implement, divide or continue serially** (below).
5. **Act.**
6. **Verify and return** (below).

## Design until constrained

Design exactly one level: your immediate components and the interfaces between them. Each child designs its own internals, so do not design below your boundaries.

- **Start from the simplest version,** usually one cohesive module. Every added component, interface, abstraction, option or dependency must earn its place with evidence.
- **Walk the likely changes through each option.** List the modifications the project is likely to need, weighted toward near-term ones. Each needs evidence: the request itself, codebase signals (TODOs, half-built features, git churn), or domain norms. Prefer the option where those changes touch the least. A seam, such as a function boundary in the right place, is cheap; a framework or plugin layer is building ahead and needs evidence.
- **Expected parallel work counts.** If the evidence says the project will be worked on in parallel, separation that supports it is maintainability. Never add boundaries just so this run can go wider.
- **List options only where real choices exist.** If the codebase already settles a choice, say so instead of inventing alternatives.
- **Review one-way doors.** For decisions that are expensive to reverse (data models, public interfaces, core abstractions), have a reviewer subagent with no shared context attack the design using the change scenarios before work starts. Decide two-way doors quickly.

Your internal interfaces are the candidate child contracts. If you implement, they become module boundaries; if you divide, they become contracts.

### Open choices

Settle each open choice one of three ways:

1. **Evidence:** explore the code, docs or sources. If reading cannot settle it, build a throwaway prototype.
2. **Ask the user:** only after exploration leaves you not fully constrained, and only when the answer would change an interface or an irreversible decision. Make the question specific: "I found X and Y; which?" A non-top-level node escalates to its parent instead; the top-level node batches questions for the user.
3. **Assume:** for low-stakes choices. Record the assumption and move on.

You are **fully constrained** when no open choice remains whose answer would change an interface. Only then decide how the work gets done.

### Shared language and decisions

Use the project glossary (by default `GLOSSARY.md`) for domain terms, so contracts mean the same thing to every agent. Record architecture decisions as ADRs (by default in `docs/adr/`). A new design either complies with existing ADRs or explicitly supersedes one with a reason. If the domain-modeling skill is installed and keeps these elsewhere, use its locations.

## Implement, divide or continue

Estimate your whole task in minutes of single-agent work and record the estimate in your return. Compare against the estimate anchors in the policy file rather than estimating from scratch.

| Decision | When |
| --- | --- |
| Implement | The estimate is at or under the split threshold |
| Divide | Over the threshold, and all three split checks pass |
| Continue serially | Over the threshold, but a split check fails. One agent continues, in phases with handoff records if the work outgrows a session |

**Split checks.** All three must be yes:

1. Can the child contracts, with acceptance checks, be written now?
2. Do the children avoid shared mutable state?
3. Is each child at least the minimum child size, so contract-writing and integration cost less than the parallelism saves?

Finishing sooner is a valid reason to divide whenever the checks pass. Check 1 is also the coherence test: if the interfaces would only emerge during the work, it needs one mind. Large coherent work splits off its periphery (tests, adapters, docs, call-site migration) and runs the core serially.

If you are at the maximum recursion depth, do not divide; continue serially.

### When dividing

- **Prefer vertical slices** that each cut through every component, with the first child a tracer bullet. Integration then happens first rather than last, which is where divided work usually breaks.
- **Commit shared interfaces as code first** when siblings depend on the same interface, so nobody builds against a guess.
- **Plan and synthesize; do not also implement.** Mixing roles is how orchestrators lose track.
- **Name the skill in every child's task text.** Begin each with: "Use the node-harness skill. You are a node; this is your contract." Then give the contract. Children inherit no history, and naming the skill makes loading reliable.
- **Give every child its own worktree and branch, and disjoint file ownership.** Overlapping writers produce conflicting patches. Each child commits on its own branch.
- **Merging is the parent's job.** The dividing node merges each child's branch into its own, resolves conflicts, and runs its integration checks on the result. A child never merges into its parent's branch or anyone else's.
- **Replan as results arrive.** Dispatch independent children in parallel; as each result comes back, add, revise or cancel tasks rather than following the original plan blindly.

## Contracts and returns

Contracts between nodes exist only when work is divided. Write each contract in this shape:

```
## Contract
Goal and usage: inputs, outputs, and how the result will be used
Checks: acceptance checks, written before dispatch
Constraints: patterns to follow; files you own; out of scope
Assumptions: the parent's assumptions, including expected future direction
Procedure version: (fan-out instances only)
```

Return results in this shape:

```
## Return
Result: the work, or a pointer to it
Checks: pass or fail for each acceptance check
Decisions: choices made, assumptions, deviations, flagged patterns, anything built beyond the direct version with its evidence, and the estimate
Pushback: none, or the case below
```

**Pushback** is allowed only with a concrete failing case: a contradiction, conflicting code, a false assumption, work far larger than the contract implies, or an instance a procedure does not fit. Design preferences, difficulty and style go in Decisions. The parent amends the contract, ideally by messaging the same child so its context is kept, or escalates.

## Verify and return

"Done" means the checks pass, not that you say so.

- **As a leaf,** pass your contract's checks.
- **As a dividing node,** confirm each child passed, then run your own contract's checks on the combined result. Read every child's Decisions; these guards only work if returns are read.
- **Review with a clean context.** A reviewer subagent that did not produce the work checks it on two axes in parallel: standards, and faithfulness to the contract. No agent grades its own work.
- **Run the removal pass.** Before returning, ask what structure could be removed while the checks still pass: indirection, unused options, single-implementation interfaces, pass-through layers. Never remove behavior such as error handling.
- **Tier the checks.** Children run cheap checks (types, unit tests, linting). Browser and end-to-end tests run only at a parent's integration check, so heavy resources are not hit by every agent at once. Each worktree uses its own ports and test database.
- **Executable checks** (types, schemas, tests) are a consideration, not an obligation. The top-level node follows the executable-contract policy in the policy file, may change it for a run, and records why.

## Fan-outs

When the work is many similar instances (such as a migration) or a hard research problem that needs breadth, read `references/fan-out.md`. Fan-outs have their own triggers and do not use the split threshold.

## Companion skills

If installed, use these where they fit: grilling (when questioning the user), domain-modeling (glossary and ADRs), tdd (meeting acceptance checks), code-review (the two-axis review), prototype (settling choices reading cannot), handoff (serial phases), and retro (improving the setup after a run). They come from [mattpocock/skills](https://github.com/mattpocock/skills). The harness works without them.
