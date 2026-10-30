import { getAdminFirestore } from "@/lib/firebase/admin";
import { REPAIRS_COLLECTION } from "@/lib/repairs/store";

/**
 * Integration tests run only against the local Firestore emulator
 * (`npm test` starts it). They refuse to run otherwise, so they can never
 * touch a real project.
 */
export function emulatorHost(): string {
  const host = process.env.FIRESTORE_EMULATOR_HOST;
  if (!host) {
    throw new Error(
      "FIRESTORE_EMULATOR_HOST is not set. Run integration tests with `npm test`, which starts the Firestore emulator.",
    );
  }
  return host;
}

export function testDb() {
  emulatorHost();
  return getAdminFirestore();
}

/** Deletes everything in the emulator so each test starts empty. */
export async function clearEmulator(): Promise<void> {
  const host = emulatorHost();
  const response = await fetch(
    `http://${host}/emulator/v1/projects/demo-fix-district/databases/(default)/documents`,
    { method: "DELETE" },
  );
  if (!response.ok) throw new Error(`Could not clear emulator (${response.status})`);
}

export async function rawRepairDocs() {
  const snapshot = await testDb().collection(REPAIRS_COLLECTION).get();
  return snapshot.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));