import { initializeApp } from "firebase/app";
import {
  collection,
  connectFirestoreEmulator,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  query,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRepairStore, repairIdFor } from "@/lib/repairs/store";
import { clearEmulator, emulatorHost, testDb } from "../helpers/emulator";

/**
 * Exercises firestore.rules as loaded by the emulator: an unauthenticated web
 * SDK client must be denied everything. (Firebase Admin, used by the app
 * server, bypasses these rules; that is why the server checks exist.)
 */
describe("Firestore client rules", () => {
  const app = initializeApp({ projectId: "demo-fix-district" }, "rules-client");
  const client = getFirestore(app);
  let id = "";

  beforeAll(async () => {
    const [host, port] = emulatorHost().split(":");
    connectFirestoreEmulator(client, host, Number(port));
    await clearEmulator();
    const store = createRepairStore(testDb());
    const key = "3f2b1c3e-9d0a-4c52-8a52-0a3f6a2f4b11";
    await store.createForCustomer(
      { userId: "user_a", role: "customer" },
      {
        deviceType: "phone",
        brand: "Apple",
        model: "iPhone",
        description: "Seed record for the rules test.",
      },
      key,
    );
    id = repairIdFor("user_a", key);
  });

  afterAll(async () => {
    await clearEmulator();
  });

  it("denies reading a repair request", async () => {
    await expect(getDoc(doc(client, "repairRequests", id))).rejects.toMatchObject({
      code: "permission-denied",
    });
  });

  it("denies listing and querying repair requests", async () => {
    await expect(getDocs(collection(client, "repairRequests"))).rejects.toMatchObject({
      code: "permission-denied",
    });
    await expect(
      getDocs(query(collection(client, "repairRequests"), limit(1))),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("denies creating and modifying repair requests", async () => {
    await expect(
      setDoc(doc(client, "repairRequests", "new-one"), {
        ownerId: "user_a",
        status: "submitted",
      }),
    ).rejects.toMatchObject({ code: "permission-denied" });
    await expect(
      updateDoc(doc(client, "repairRequests", id), { status: "completed" }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  it("denies any other collection by default", async () => {
    await expect(getDoc(doc(client, "somethingElse", "x"))).rejects.toMatchObject({
      code: "permission-denied",
    });
  });
});