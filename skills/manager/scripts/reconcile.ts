#!/usr/bin/env bun
// Compares the register with ground truth from git and the worker sessions.
// Usage: bun reconcile.ts [--org <dir>] [--fix]
// Without --fix, prints the mismatches. With --fix, corrects the register, logs to
// the progress file, and turns a mismatch that repeats into a backlog item.
//
// A work item's branch tells its story: pushed with commits beyond its base means the
// worker delivered; reachable from main (or a commit on main starting with the item's
// id, for squash merges) means merged. Run `git fetch` first; run-loop.ts does.
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
	appendProgress,
	args,
	loadBacklog,
	loadPolicy,
	loadRegister,
	nextId,
	now,
	orgRoot,
	pidAlive,
	run,
	runtimeDir,
	saveBacklog,
	saveRegister,
	today,
	type Policy,
	type WorkItem,
} from "./lib";

/** Whether the worker process for an item is still running. */
export function sessionAlive(org: string, item: WorkItem): boolean {
	const file = join(runtimeDir(org, "sessions"), `${item.id}.json`);
	if (!existsSync(file)) return false;
	const { pid } = JSON.parse(readFileSync(file, "utf8")) as { pid: number };
	return pidAlive(pid);
}

/** Removes a finished worker's worktree and session record, once its process has exited. */
function removeFinishedWorker(org: string, w: WorkItem) {
	const file = join(runtimeDir(org, "sessions"), `${w.id}.json`);
	if (!existsSync(file)) return;
	const { pid, tree } = JSON.parse(readFileSync(file, "utf8")) as { pid: number; tree: string };
	if (pidAlive(pid)) return;
	run(["git", "worktree", "remove", "--force", tree], org);
	rmSync(file);
}

const rev = (org: string, ref: string) => {
	const r = run(["git", "rev-parse", "--verify", "-q", `${ref}^{commit}`], org);
	return r.code === 0 ? r.stdout.trim() : null;
};
const isAncestor = (org: string, a: string, b: string) => run(["git", "merge-base", "--is-ancestor", a, b], org).code === 0;

/** Whether the item's work reached main: by merge or fast-forward, or by a squash commit naming its id. */
function mergedIntoMain(org: string, policy: Policy, w: WorkItem, head: string | null): boolean {
	const main = `origin/${policy.main_branch}`;
	if (head && head !== w.base && isAncestor(org, head, main)) return true;
	const since = w.base ? [`${w.base}..${main}`] : [main];
	// Workers start commit messages with the item id; the manager's own commits start with "manager:".
	return run(["git", "log", "--format=%H", "-E", `--grep=^${w.id}:`, ...since], org).stdout.trim() !== "";
}

export interface Reconciliation {
	notes: string[];
	changed: boolean;
}

export function reconcile(org: string, fix: boolean): Reconciliation {
	const policy = loadPolicy(org);
	const register = loadRegister(org);
	const backlog = loadBacklog(org);
	const notes: string[] = [];
	let changed = false;
	let backlogChanged = false;
	const staleMs = policy.limits.stale_work_days * 86_400_000;

	const set = (w: WorkItem, status: string, why: string) => {
		notes.push(`${w.id}: ${w.status} -> ${status} (${why})`);
		w.status = status;
		changed = true;
	};
	const mismatch = (w: WorkItem, kind: string, status: string, why: string) => {
		set(w, status, `mismatch: ${why}`);
		w.mismatches = { ...w.mismatches, [kind]: (w.mismatches?.[kind] ?? 0) + 1 };
		if (w.mismatches[kind] === 2) {
			const id = nextId("B", backlog.map(b => b.id));
			backlog.push({
				id,
				title: `Repeated mismatch on ${w.id}: ${kind}`,
				source: "manager",
				evidence: `Reconciliation found "${why}" twice for ${w.id} (${w.title}); the procedure that produced it is likely broken.`,
				goal: null,
				size_minutes: 30,
				status: "candidate",
				approval: "pending",
				created: today(),
				reason: null,
			});
			backlogChanged = true;
			notes.push(`${w.id}: ${kind} repeated; added ${id} to the backlog`);
		}
	};

	for (const w of register) {
		if (["merged", "failed", "cancelled"].includes(w.status)) removeFinishedWorker(org, w);
		if (!["running", "review", "stalled"].includes(w.status)) continue;

		const head = rev(org, `origin/${w.branch}`);
		if (head && head !== w.head) {
			w.head = head;
			changed = true;
		}
		if (mergedIntoMain(org, policy, w, head ?? w.head ?? null)) {
			set(w, "merged", `work reached ${policy.main_branch}`);
			w.finished = now();
			continue;
		}

		const delivered = head !== null && head !== w.base;
		const alive = sessionAlive(org, w);
		if (alive) {
			if (w.status === "stalled") set(w, "running", "session is live");
			else if (w.started && Date.now() - Date.parse(w.started) > staleMs) notes.push(`${w.id}: running for more than stale_work_days`);
		} else if (delivered) {
			if (w.status !== "review") set(w, "review", `worker exited; branch ${w.branch} pushed at ${head.slice(0, 8)}`);
		} else if (w.status === "review") {
			mismatch(w, "review_without_branch", "stalled", `marked review but branch ${w.branch} has no pushed work`);
		} else if (w.status === "running") {
			mismatch(w, "no_session", "stalled", "marked running with no live session and no pushed work");
		}
	}

	if (fix && changed) {
		saveRegister(org, register);
		if (backlogChanged) saveBacklog(org, backlog);
		appendProgress(org, `${today()} reconcile`, notes.length ? notes : ["Recorded pushed branch heads."]);
	}
	return { notes, changed };
}

if (import.meta.main) {
	const { flags } = args(Bun.argv.slice(2));
	const org = orgRoot(typeof flags.org === "string" ? flags.org : process.cwd());
	const r = reconcile(org, flags.fix === true);
	console.log(r.notes.length ? r.notes.join("\n") : "register matches ground truth");
}
