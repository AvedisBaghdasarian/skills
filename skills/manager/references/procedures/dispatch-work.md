# Dispatch work

For one approved backlog item:

1. **Confirm approval:** `approval` is `goal` (an active goal, within the approval threshold) or `human`.
2. **Confirm budget:** running plus ready items stay within `max_concurrent_work`, and today's dispatched minutes plus this item's `max_time_minutes` stay within `daily_dispatch_minutes`.
3. **Check for overlap:** no running item owns the same files. If one does, wait.
4. **Write the contract** in `ops/contracts/<W-id>.md`, in the node harness's shape. The checks must be things a tool can confirm: tests, CI, a command's output. State the files the worker owns.
5. **Add the register item** with status `ready`, the next unused `W-` id, `branch: work/<W-id>`, and `max_time_minutes` from the item's size plus margin.
6. **Set the backlog item** to `dispatched`.

The runner starts the worker after your session and sets `running`.
