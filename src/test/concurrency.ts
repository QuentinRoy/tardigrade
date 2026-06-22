import { type ControlledTransaction, type Kysely, sql } from "kysely";
import type { DB } from "#db/generated/db.ts";

const LOCK_WAIT_POLL_INTERVAL_MS = 20;
const LOCK_WAIT_TIMEOUT_MS = 5000;

export type ForcedInterleavingResult<FirstResult, SecondResult> = {
	firstResult: FirstResult;
	secondResult: SecondResult;
};

// Forces a deterministic lock-wait interleaving between two writers contending
// for the same row. `first` runs to completion but stays uncommitted; `second`
// is started without being awaited and is only allowed to finish once it is
// observed blocking on Postgres's lock manager. This makes the contended
// interleaving fire on every run instead of depending on scheduling luck.
export async function runForcedInterleaving<FirstResult, SecondResult>(
	db: Kysely<DB>,
	{
		first,
		second,
	}: {
		first: (tx: ControlledTransaction<DB>) => Promise<FirstResult>;
		second: (tx: ControlledTransaction<DB>) => Promise<SecondResult>;
	},
): Promise<ForcedInterleavingResult<FirstResult, SecondResult>> {
	const tx1 = await db.startTransaction().execute();
	const firstResult = await first(tx1);

	const tx2 = await db.startTransaction().execute();
	const pidResult = await sql<{
		pid: number;
	}>`select pg_backend_pid() as "pid"`.execute(tx2);
	const pid = pidResult.rows[0]?.pid;

	if (pid == null) {
		throw new Error("Expected pg_backend_pid() to return a row.");
	}

	const secondPromise = second(tx2);
	await waitUntilBlockedOnLock(db, pid);

	await tx1.commit().execute();
	const secondResult = await secondPromise;
	await tx2.commit().execute();

	return { firstResult, secondResult };
}

function delay(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

function rejectAfter(ms: number, message: string): Promise<never> {
	return delay(ms).then(() => {
		throw new Error(message);
	});
}

// `isCancelled` is polled rather than the loop being interrupted directly:
// `Promise.race` in `waitUntilBlockedOnLock` below abandons whichever promise
// loses, it doesn't cancel it, so without this check the loop would keep
// querying `pg_stat_activity` forever after a timeout.
async function pollUntilBlockedOnLock(
	db: Kysely<DB>,
	pid: number,
	isCancelled: () => boolean,
): Promise<void> {
	while (!isCancelled()) {
		const { rows } = await sql<{ waitEventType: string | null }>`
			select wait_event_type as "waitEventType"
			from pg_stat_activity
			where pid = ${pid}
		`.execute(db);

		if (rows[0]?.waitEventType === "Lock") {
			return;
		}

		await delay(LOCK_WAIT_POLL_INTERVAL_MS);
	}
}

async function waitUntilBlockedOnLock(
	db: Kysely<DB>,
	pid: number,
): Promise<void> {
	let cancelled = false;

	try {
		await Promise.race([
			pollUntilBlockedOnLock(db, pid, () => cancelled),
			rejectAfter(
				LOCK_WAIT_TIMEOUT_MS,
				`Timed out waiting for backend ${pid} to block on a Postgres lock.`,
			),
		]);
	} finally {
		cancelled = true;
	}
}
