import { randomBytes } from "node:crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { SEEDED_REQUESTS_PER_WORKER, type E2EConfig } from "../config/env";
import { DEVICE_VALUE, repairInput, type RepairFormInput } from "./data";
import { E2ESafetyError, assertEmulatorOnly } from "./safety";

/**
 * Test-side access to the Firestore emulator, and nothing else.
 *
 * Safety properties:
 *  - Created only after assertEmulatorOnly (loopback host, "demo-" project).
 *  - Builds its own Firebase Admin app from a project ID alone. It never reads
 *    FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY and passes no credential, so
 *    it cannot authenticate to a real project.
 *  - Sets FIRESTORE_EMULATOR_HOST itself, so the SDK talks only to the emulator.
 *  - Deletes only documents owned by a given test user. It never calls the
 *    emulator-wide wipe endpoint.
 *
 * The collection name and stored fields mirror lib/repairs/store.ts. They are
 * declared here (not imported) because that module is server-only, and so a
 * change to the app's storage shape fails these tests loudly instead of being
 * followed silently.
 */

const COLLECTION = "repairRequests";
const APP_NAME = "e2e-emulator";

export type SeedOptions = {
  /** The Clerk user ID that owns the request. */
  ownerId: string;
  marker: string;
  overrides?: Partial<RepairFormInput>;
};

export type StoredRepair = {
  id: string;
  deviceType: unknown;
  brand: unknown;
  model: unknown;
  description: unknown;
  status: unknown;
  createdAt: string | null;
};

/** Resolves when the emulator answers; otherwise explains how to start it. */
export async function assertEmulatorReachable(hostPort: string): Promise<void> {
  try {
    const response = await fetch(`http://${hostPort}/`, {
      signal: AbortSignal.timeout(3000),
    });
    if (response.ok) return;
  } catch {
    // fall through to the explanation below
  }
  throw new E2ESafetyError(
    "The Firestore emulator is not reachable. Run `npm run test:e2e` (starts it), or `npm run emulators:e2e` in another terminal.",
  );
}

export function createEmulatorData(
  config: Pick<E2EConfig, "emulatorHost" | "firebaseProjectId">,
  budget: number = SEEDED_REQUESTS_PER_WORKER,
) {
  assertEmulatorOnly(config.emulatorHost, config.firebaseProjectId);
  process.env.FIRESTORE_EMULATOR_HOST = config.emulatorHost;

  // Project ID only, no credential (same as lib/firebase/admin.ts in emulator
  // mode). Offline, the SDK may log a harmless "MetadataLookupWarning" while it
  // looks for credentials it does not need.
  const app =
    getApps().find((existing) => existing.name === APP_NAME) ??
    initializeApp({ projectId: config.firebaseProjectId }, APP_NAME);
  const collection = getFirestore(app).collection(COLLECTION);
  /** IDs seeded by this instance and not yet deleted: the per-worker budget. */
  const live = new Set<string>();

  async function deleteOwnedBy(ownerId: string): Promise<number> {
    const snapshot = await collection.where("ownerId", "==", ownerId).get();
    if (snapshot.empty) return 0;
    const batch = collection.firestore.batch();
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
      live.delete(doc.id);
    }
    await batch.commit();
    return snapshot.size;
  }

  return {
    /**
     * Writes one repair request directly, as a precondition. Fails if this
     * worker already holds its budget of seeded requests, so parallel workers
     * can never push each other out of the technician queue's newest-50 window.
     */
    async seedRepair({ ownerId, marker, overrides }: SeedOptions): Promise<string> {
      if (live.size >= budget) {
        throw new E2ESafetyError(
          `This worker already holds ${budget} seeded requests. Delete some or seed fewer; the shared technician queue only shows the newest 50.`,
        );
      }
      const input = repairInput(marker, overrides);
      const id = randomBytes(20).toString("hex");
      await collection.doc(id).create({
        ownerId,
        deviceType: DEVICE_VALUE[input.deviceType],
        brand: input.brand,
        model: input.model,
        description: input.description,
        status: "submitted",
        createdAt: Timestamp.now(),
      });
      live.add(id);
      return id;
    },

    deleteOwnedBy,

    /** What is stored for one owner. For assertions and failure snapshots. */
    async repairsOwnedBy(ownerId: string): Promise<StoredRepair[]> {
      const snapshot = await collection.where("ownerId", "==", ownerId).get();
      return snapshot.docs.map((doc) => {
        const data = doc.data();
        const createdAt: unknown = data.createdAt;
        return {
          id: doc.id,
          deviceType: data.deviceType,
          brand: data.brand,
          model: data.model,
          description: data.description,
          status: data.status,
          createdAt: createdAt instanceof Timestamp ? createdAt.toDate().toISOString() : null,
        };
      });
    },

    /** Total stored requests. Used to detect an emulator polluted by earlier runs. */
    async totalRepairs(): Promise<number> {
      const result = await collection.count().get();
      return result.data().count;
    },
  };
}

export type EmulatorData = ReturnType<typeof createEmulatorData>;
