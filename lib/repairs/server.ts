import "server-only";
import { connection } from "next/server";
import { requireRole } from "@/lib/auth/access";
import { FirebaseConfigError, getAdminFirestore } from "@/lib/firebase/admin";
import {
  createRepairStore,
  RepairValidationError,
  type Actor,
} from "@/lib/repairs/store";
import type { RepairDetail, RepairList } from "@/lib/repairs/types";

/**
 * The server operations that pages and actions call. Each one:
 *   1. resolves the signed-in user and role through lib/auth/access.ts
 *      (signed-out visitors are redirected, wrong roles get a 403), and
 *   2. passes that trusted identity, never anything from the request, to the
 *      data-access layer, which checks role and ownership again.
 *
 * Authentication failures are thrown by requireRole (redirect/forbidden) and
 * must not be caught. Data failures come back as { ok: false } so the UI can
 * show an error state instead of an empty list.
 *
 * Nothing here uses `use cache`, and the results are only rendered inside
 * request-time (dynamic) boundaries. Private repair data is never placed in a
 * shared cache.
 */

export type DataResult<T> = { ok: true; data: T } | { ok: false };

/**
 * Logs only the error type and code. Never the message, input, or credentials.
 * The one exception is FirebaseConfigError, whose messages are fixed text that
 * tells the developer which setting to fix.
 */
function logFailure(operation: string, error: unknown): void {
  if (error instanceof FirebaseConfigError) {
    console.error(`[repairs] ${operation} failed: ${error.message}`);
    return;
  }
  const name = error instanceof Error ? error.name : "UnknownError";
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "none";
  console.error(`[repairs] ${operation} failed (${name}, code ${code})`);
}

async function guarded<T>(
  operation: string,
  run: () => Promise<T>,
): Promise<DataResult<T>> {
  // Database reads are request-time work, never part of a prerender. This also
  // keeps the Firestore client (which uses random values) out of prerender passes.
  await connection();
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    logFailure(operation, error);
    return { ok: false };
  }
}

function store() {
  return createRepairStore(getAdminFirestore());
}

function actorFrom(access: { userId: string; role: Actor["role"] }): Actor {
  return { userId: access.userId, role: access.role };
}

export type SaveResult =
  | { ok: true; id: string; created: boolean }
  | { ok: false; reason: "invalid" | "unavailable" };

/** Customers only. The owner is the authenticated user, never a parameter. */
export async function saveRepairRequest(
  input: unknown,
  requestKey: unknown,
): Promise<SaveResult> {
  const actor = actorFrom(await requireRole("customer"));
  try {
    const saved = await store().createForCustomer(actor, input, requestKey);
    return { ok: true, ...saved };
  } catch (error) {
    if (error instanceof RepairValidationError) {
      return { ok: false, reason: "invalid" };
    }
    logFailure("save", error);
    return { ok: false, reason: "unavailable" };
  }
}

/** Customers only: their own requests, newest first. */
export async function loadMyRepairs(): Promise<DataResult<RepairList>> {
  const actor = actorFrom(await requireRole("customer"));
  return guarded("listMine", () => store().listForCustomer(actor));
}

/** Customers only: data is null when missing or not theirs (indistinguishable). */
export async function loadMyRepair(
  id: string,
): Promise<DataResult<RepairDetail | null>> {
  const actor = actorFrom(await requireRole("customer"));
  return guarded("getMine", () => store().getForCustomer(actor, id));
}

/** Technicians only: the repair queue, newest first. */
export async function loadRepairQueue(): Promise<DataResult<RepairList>> {
  const actor = actorFrom(await requireRole("technician"));
  return guarded("queue", () => store().listQueue(actor));
}

/** Technicians only: any request's details. */
export async function loadRepairForTechnician(
  id: string,
): Promise<DataResult<RepairDetail | null>> {
  const actor = actorFrom(await requireRole("technician"));
  return guarded("getForTechnician", () => store().getForTechnician(actor, id));
}
