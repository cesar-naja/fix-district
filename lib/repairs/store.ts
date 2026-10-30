import "server-only";
import { createHash } from "node:crypto";
import { FieldValue, Timestamp, type Firestore } from "firebase-admin/firestore";
import type { Role } from "@/lib/auth/roles";
import {
  INITIAL_STATUS,
  LIST_LIMIT,
  isValidRepairId,
  isValidRequestKey,
  validateRepairInput,
  type DeviceType,
  type RepairInput,
} from "@/lib/repairs/schema";
import type { RepairDetail, RepairList, RepairSummary } from "@/lib/repairs/types";

/**
 * Data-access layer for repair requests (Firestore, via Firebase Admin).
 *
 * Every operation takes the authenticated actor and enforces role and
 * ownership itself, so callers cannot skip a check. Firebase Admin bypasses
 * Firestore security rules, which makes these checks the real access control.
 *
 * Application code should not import this file directly; use
 * lib/repairs/server.ts, which resolves the actor from Clerk. This file takes
 * the Firestore instance as a parameter so tests can run it on the emulator.
 */

export const REPAIRS_COLLECTION = "repairRequests";

/** The authenticated user, as resolved by lib/auth/access.ts. */
export type Actor = { userId: string; role: Role };

export class RepairAccessError extends Error {
  constructor(message = "Not allowed.") {
    super(message);
    this.name = "RepairAccessError";
  }
}

export class RepairValidationError extends Error {
  constructor() {
    super("Invalid repair request.");
    this.name = "RepairValidationError";
  }
}

export class RepairDataError extends Error {
  constructor() {
    super("Stored repair data is malformed.");
    this.name = "RepairDataError";
  }
}

function assertActor(actor: Actor, role: Role): void {
  if (
    !actor ||
    typeof actor.userId !== "string" ||
    actor.userId.length === 0 ||
    actor.role !== role
  ) {
    throw new RepairAccessError();
  }
}

/**
 * Deterministic document ID for one customer's one form submission. Because
 * the owner is part of the hash, a retry by the same customer maps to the same
 * document (no duplicate), and nobody can target another customer's document
 * by choosing a key.
 */
export function repairIdFor(userId: string, requestKey: string): string {
  return createHash("sha256")
    .update(`${userId}:${requestKey}`)
    .digest("hex")
    .slice(0, 40);
}

function isAlreadyExists(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error.code === 6 || error.code === "already-exists")
  );
}

function toSummary(id: string, data: FirebaseFirestore.DocumentData): RepairSummary {
  const createdAt: unknown = data.createdAt;
  if (
    !(createdAt instanceof Timestamp) ||
    typeof data.brand !== "string" ||
    typeof data.model !== "string" ||
    data.status !== INITIAL_STATUS ||
    typeof data.deviceType !== "string"
  ) {
    throw new RepairDataError();
  }
  // Explicit field-by-field copy: nothing else (e.g. ownerId) can leak through.
  return {
    id,
    deviceType: data.deviceType as DeviceType,
    brand: data.brand,
    model: data.model,
    status: data.status,
    createdAt: createdAt.toDate().toISOString(),
  };
}

function toDetail(id: string, data: FirebaseFirestore.DocumentData): RepairDetail {
  if (typeof data.description !== "string") throw new RepairDataError();
  return { ...toSummary(id, data), description: data.description };
}

export function createRepairStore(db: Firestore) {
  const collection = db.collection(REPAIRS_COLLECTION);

  function toList(docs: FirebaseFirestore.QueryDocumentSnapshot[]): RepairList {
    const page = docs.slice(0, LIST_LIMIT);
    return {
      items: page.map((doc) => toSummary(doc.id, doc.data())),
      hasMore: docs.length > LIST_LIMIT,
    };
  }

  return {
    /**
     * Saves a customer's request for themselves. Owner, status, and timestamp
     * are assigned here; nothing in `input` can set them. Calling again with the
     * same `requestKey` returns the original request instead of a duplicate.
     */
    async createForCustomer(
      actor: Actor,
      input: unknown,
      requestKey: unknown,
    ): Promise<{ id: string; created: boolean }> {
      assertActor(actor, "customer");
      if (!isValidRequestKey(requestKey)) throw new RepairValidationError();

      // Re-validated here so no caller can bypass the rules by skipping the action.
      const result = validateRepairInput(
        (typeof input === "object" && input !== null ? input : {}) as Partial<
          Record<keyof RepairInput, unknown>
        >,
      );
      if (!result.ok) throw new RepairValidationError();

      const id = repairIdFor(actor.userId, requestKey);
      const ref = collection.doc(id);

      try {
        await ref.create({
          ownerId: actor.userId,
          deviceType: result.data.deviceType,
          brand: result.data.brand,
          model: result.data.model,
          description: result.data.description,
          status: INITIAL_STATUS,
          createdAt: FieldValue.serverTimestamp(),
        });
        return { id, created: true };
      } catch (error) {
        if (!isAlreadyExists(error)) throw error;
        // A retry of an already-saved submission. Confirm it is really ours.
        const existing = await ref.get();
        if (existing.data()?.ownerId !== actor.userId) throw new RepairAccessError();
        return { id, created: false };
      }
    },

    /** The customer's own requests, newest first, at most LIST_LIMIT. */
    async listForCustomer(actor: Actor): Promise<RepairList> {
      assertActor(actor, "customer");
      const snapshot = await collection
        .where("ownerId", "==", actor.userId)
        .orderBy("createdAt", "desc")
        .limit(LIST_LIMIT + 1)
        .get();
      return toList(snapshot.docs);
    },

    /**
     * One of the customer's own requests. Returns null both when the request
     * does not exist and when it belongs to someone else, so the two cases are
     * indistinguishable to the caller.
     */
    async getForCustomer(actor: Actor, id: string): Promise<RepairDetail | null> {
      assertActor(actor, "customer");
      if (!isValidRepairId(id)) return null;
      const doc = await collection.doc(id).get();
      const data = doc.data();
      if (!doc.exists || !data || data.ownerId !== actor.userId) return null;
      return toDetail(doc.id, data);
    },

    /** The repair queue for technicians, newest first, at most LIST_LIMIT. */
    async listQueue(actor: Actor): Promise<RepairList> {
      assertActor(actor, "technician");
      const snapshot = await collection
        .orderBy("createdAt", "desc")
        .limit(LIST_LIMIT + 1)
        .get();
      return toList(snapshot.docs);
    },

    /** Any request, for technicians. Null when it does not exist. */
    async getForTechnician(actor: Actor, id: string): Promise<RepairDetail | null> {
      assertActor(actor, "technician");
      if (!isValidRepairId(id)) return null;
      const doc = await collection.doc(id).get();
      const data = doc.data();
      if (!doc.exists || !data) return null;
      return toDetail(doc.id, data);
    },
  };
}

export type RepairStore = ReturnType<typeof createRepairStore>;
