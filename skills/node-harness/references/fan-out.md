# Fan-out

A fan-out is one parent and many workers whose shape is known before dispatch. It is where wide parallelism comes from; dividing an architecture rarely produces more than a handful of children. The parent gives each worker its own assignment. In Oh My Pi, run fan-outs with the `workflowz` keyword or the eval `workpool()` helper, since their graph is fixed in advance.

There are two flavors.

## Writing fan-out

For many similar instances of work, such as migrating call sites or converting files.

**Trigger:** at least the procedure-first trigger count of similar instances, or consistency across instances is required, or the user said the procedure will be reused. Otherwise just do the work; a procedure that runs once is overhead.

1. **Pilot.** One worker drafts the procedure and runs it on the pilot instances, including at least one deliberately awkward case. Easy pilots pass and then fail on the long tail.
2. **Approve.** The parent reviews the pilot results before anything fans out. This is where a wrong procedure is cheap to fix.
3. **Fan out.** Each instance worker gets the procedure as its contract, with the procedure version. A misfitting instance is expected pushback, not failure; many misfits mean the procedure is wrong.

Each instance records its procedure version, so a fix made mid-run shows which instances need redoing.

## Reading fan-out

For hard research problems, such as one in mathematics, that need breadth.

1. **Assign distinct angles.** Agents given the same prompt converge on the same obvious idea, so the parent assigns each a distinct area or approach: literature on a method, small cases, counterexample search, reduction to a known result, and so on. Mix models where possible.
2. **Scout independently.** Start at the research starting width. Agents do not share findings while scouting, which avoids everyone piling onto the first promising idea.
3. **Go deep.** Narrow to the 2 or 3 most promising directions. Sharing findings is allowed in this phase. Widen toward the research maximum width only where the coverage map shows gaps.
4. **Synthesize in stages.** Reduce returns in groups of the synthesis group size, then reduce the summaries. List contradictions for the user; never resolve them silently.

Research returns add, for each claim:

- **Status:** proved, computationally verified, conjectured, or heuristic. Mixing these levels is how research syntheses go wrong.
- **Evidence:** a proof sketch, the code that was run, or a source.

They also list **dead ends** and why each failed, because negative results are among the most useful outputs and agents underreport them unless asked.

Verify separately from discovery: provers and checkers are different agents, computational claims are rerun from their code, any "by a known result" claim is checked, and Lean is used where formalization is feasible.
