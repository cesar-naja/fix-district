import { randomUUID } from "node:crypto";
import { Timestamp } from "firebase-admin/firestore";
import { beforeEach, describe, expect, it } from "vitest";
import { LIST_LIMIT } from "@/lib/repairs/schema";
import {
  RepairAccessError,
  RepairValidationError,
  REPAIRS_COLLECTION,
  createRepairStore,
  repairIdFor,
  type Actor,
} from "@/lib/repairs/store";
import { clearEmulator, rawRepairDocs, sleep, testDb } from "../helpers/emulator";

const customerA: Actor = { userId: "user_customer_a", role: "customer" };
const customerB: Actor = { userId: "user_customer_b", role: "customer" };
const technician: Actor = { userId: "user_technician", role: "technician" };

const input = {
  deviceType: "laptop",
  brand: "Lenovo",
  model: "ThinkPad T14",
  description: "It will not boot past the logo screen since yesterday.",
};

const store = () => createRepairStore(testDb());

beforeEach(clearEmulator);

describe("creating requests", () => {
  it("saves a request owned by the authenticated customer with server-assigned status and time", async () => {
    const before = Date.now();
    const { id, created } = await store().createForCustomer(customerA, input, randomUUID());
    expect(created).toBe(true);

    const docs = await rawRepairDocs();
    expect(docs).toHaveLength(1);
    const { data } = docs[0];
    expect(docs[0].id).toBe(id);
    expect(data).toMatchObject({
      ownerId: customerA.userId,
      status: "submitted",
      deviceType: "laptop",
      brand: "Lenovo",
      model: "ThinkPad T14",
      description: input.description,
    });
    expect(data.createdAt).toBeInstanceOf(Timestamp);
    // Assigned by the server clock, within a sane window of "now".
    expect(Math.abs(data.createdAt.toMillis() - before)).toBeLessThan(60_000);
    expect(Object.keys(data).sort()).toEqual([
      "brand",
      "createdAt",
      "description",
      "deviceType",
      "model",
      "ownerId",
      "status",
    ]);
  });

  it("ignores client-supplied owner, status, timestamp, and role", async () => {
    await store().createForCustomer(
      customerA,
      {
        ...input,
        ownerId: customerB.userId,
        status: "completed",
        createdAt: new Date("1999-01-01"),
        role: "technician",
        id: "x".repeat(40),
      },
      randomUUID(),
    );
    const [{ data }] = await rawRepairDocs();
    expect(data.ownerId).toBe(customerA.userId);
    expect(data.status).toBe("submitted");
    expect(data.createdAt.toDate().getFullYear()).not.toBe(1999);
    expect(data.role).toBeUndefined();
  });

  it("rejects invalid input on the server and writes nothing", async () => {
    for (const bad of [
      {},
      { ...input, deviceType: "toaster" },
      { ...input, brand: "" },
      { ...input, description: "short" },
      { ...input, description: "x".repeat(1001) },
      null,
      "string",
    ]) {
      await expect(
        store().createForCustomer(customerA, bad, randomUUID()),
      ).rejects.toBeInstanceOf(RepairValidationError);
    }
    expect(await rawRepairDocs()).toHaveLength(0);
  });

  it("rejects a missing or malformed request key", async () => {
    for (const key of [undefined, "", "not-a-uuid", "../../etc"]) {
      await expect(
        store().createForCustomer(customerA, input, key),
      ).rejects.toBeInstanceOf(RepairValidationError);
    }
    expect(await rawRepairDocs()).toHaveLength(0);
  });

  it("only customers can create; technicians and fake actors cannot", async () => {
    await expect(
      store().createForCustomer(technician, input, randomUUID()),
    ).rejects.toBeInstanceOf(RepairAccessError);
    await expect(
      store().createForCustomer({ userId: "", role: "customer" }, input, randomUUID()),
    ).rejects.toBeInstanceOf(RepairAccessError);
    await expect(
      store().createForCustomer(
        { userId: "u", role: "admin" as never },
        input,
        randomUUID(),
      ),
    ).rejects.toBeInstanceOf(RepairAccessError);
    expect(await rawRepairDocs()).toHaveLength(0);
  });
});

describe("duplicate submissions", () => {
  it("returns the original request when the same key is submitted again", async () => {
    const key = randomUUID();
    const first = await store().createForCustomer(customerA, input, key);
    const second = await store().createForCustomer(customerA, input, key);
    expect(second).toEqual({ id: first.id, created: false });
    expect(await rawRepairDocs()).toHaveLength(1);
  });

  it("keeps the original data when a retry arrives with different text", async () => {
    const key = randomUUID();
    await store().createForCustomer(customerA, input, key);
    await store().createForCustomer(customerA, { ...input, brand: "Changed" }, key);
    const docs = await rawRepairDocs();
    expect(docs).toHaveLength(1);
    expect(docs[0].data.brand).toBe("Lenovo");
  });

  it("saves only once when many identical submissions race", async () => {
    const key = randomUUID();
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        store().createForCustomer(customerA, input, key),
      ),
    );
    expect(results.filter((r) => r.created)).toHaveLength(1);
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(await rawRepairDocs()).toHaveLength(1);
  });

  it("treats a new key as a new request", async () => {
    await store().createForCustomer(customerA, input, randomUUID());
    await store().createForCustomer(customerA, input, randomUUID());
    expect(await rawRepairDocs()).toHaveLength(2);
  });

  it("scopes keys to the customer: B reusing A's key never touches A's request", async () => {
    const key = randomUUID();
    const a = await store().createForCustomer(customerA, input, key);
    const b = await store().createForCustomer(
      customerB,
      { ...input, brand: "Dell" },
      key,
    );
    expect(b.created).toBe(true);
    expect(b.id).not.toBe(a.id);
    expect(a.id).toBe(repairIdFor(customerA.userId, key));
    const docs = await rawRepairDocs();
    expect(docs).toHaveLength(2);
    expect(docs.find((d) => d.id === a.id)?.data.brand).toBe("Lenovo");
  });

  it("refuses to treat someone else's document as a retry", async () => {
    // Simulate a (practically impossible) ID collision with another owner.
    const key = randomUUID();
    const id = repairIdFor(customerA.userId, key);
    await testDb().collection(REPAIRS_COLLECTION).doc(id).set({ ownerId: "user_other" });
    await expect(
      store().createForCustomer(customerA, input, key),
    ).rejects.toBeInstanceOf(RepairAccessError);
  });
});

describe("customer reads and isolation", () => {
  it("lists only the customer's own requests, newest first", async () => {
    const first = await store().createForCustomer(customerA, { ...input, brand: "First" }, randomUUID());
    await sleep(25);
    await store().createForCustomer(customerB, { ...input, brand: "OtherCustomer" }, randomUUID());
    await sleep(25);
    const second = await store().createForCustomer(customerA, { ...input, brand: "Second" }, randomUUID());

    const mine = await store().listForCustomer(customerA);
    expect(mine.items.map((r) => r.brand)).toEqual(["Second", "First"]);
    expect(mine.items.map((r) => r.id)).toEqual([second.id, first.id]);
    expect(mine.items.every((r) => r.status === "submitted")).toBe(true);
    expect(mine.hasMore).toBe(false);

    const theirs = await store().listForCustomer(customerB);
    expect(theirs.items.map((r) => r.brand)).toEqual(["OtherCustomer"]);
  });

  it("returns an empty list (not an error) for a customer with no requests", async () => {
    expect(await store().listForCustomer(customerA)).toEqual({
      items: [],
      hasMore: false,
    });
  });

  it("lets a customer open their own request", async () => {
    const { id } = await store().createForCustomer(customerA, input, randomUUID());
    const detail = await store().getForCustomer(customerA, id);
    expect(detail).toMatchObject({
      id,
      brand: "Lenovo",
      description: input.description,
      status: "submitted",
    });
  });

  it("gives customer B the same answer for A's request as for one that does not exist", async () => {
    const { id } = await store().createForCustomer(customerA, input, randomUUID());
    const guessed = repairIdFor(customerA.userId, randomUUID());

    const otherUsers = await store().getForCustomer(customerB, id);
    const nonexistent = await store().getForCustomer(customerB, guessed);
    expect(otherUsers).toBeNull();
    expect(nonexistent).toBeNull();
    expect(otherUsers).toEqual(nonexistent);
  });

  it("returns null for malformed or path-like IDs without querying", async () => {
    await store().createForCustomer(customerA, input, randomUUID());
    for (const bad of ["", "abc", "../repairRequests", "a/b", "A".repeat(40), " ".repeat(40)]) {
      expect(await store().getForCustomer(customerA, bad)).toBeNull();
    }
  });

  it("does not expose the owner ID or other storage fields", async () => {
    const { id } = await store().createForCustomer(customerA, input, randomUUID());
    const list = await store().listForCustomer(customerA);
    const detail = await store().getForCustomer(customerA, id);
    expect(Object.keys(list.items[0]).sort()).toEqual([
      "brand",
      "createdAt",
      "deviceType",
      "id",
      "model",
      "status",
    ]);
    expect(Object.keys(detail!).sort()).toEqual([
      "brand",
      "createdAt",
      "description",
      "deviceType",
      "id",
      "model",
      "status",
    ]);
    expect(JSON.stringify([list, detail])).not.toContain(customerA.userId);
  });

  it("denies customers every technician operation", async () => {
    const { id } = await store().createForCustomer(customerA, input, randomUUID());
    await expect(store().listQueue(customerA)).rejects.toBeInstanceOf(RepairAccessError);
    await expect(store().getForTechnician(customerA, id)).rejects.toBeInstanceOf(
      RepairAccessError,
    );
  });
});

describe("technician reads", () => {
  it("shows every customer's requests in the queue, newest first", async () => {
    await store().createForCustomer(customerA, { ...input, brand: "A1" }, randomUUID());
    await sleep(25);
    await store().createForCustomer(customerB, { ...input, brand: "B1" }, randomUUID());
    await sleep(25);
    await store().createForCustomer(customerA, { ...input, brand: "A2" }, randomUUID());

    const queue = await store().listQueue(technician);
    expect(queue.items.map((r) => r.brand)).toEqual(["A2", "B1", "A1"]);
  });

  it("returns an empty queue (not an error) when nothing was submitted", async () => {
    expect(await store().listQueue(technician)).toEqual({ items: [], hasMore: false });
  });

  it("lets a technician open any request, and returns null for unknown ones", async () => {
    const { id } = await store().createForCustomer(customerB, input, randomUUID());
    expect(await store().getForTechnician(technician, id)).toMatchObject({
      id,
      description: input.description,
    });
    expect(await store().getForTechnician(technician, "f".repeat(40))).toBeNull();
    expect(await store().getForTechnician(technician, "../x")).toBeNull();
  });

  it("denies technicians the customer-only operations", async () => {
    const { id } = await store().createForCustomer(customerA, input, randomUUID());
    await expect(store().listForCustomer(technician)).rejects.toBeInstanceOf(
      RepairAccessError,
    );
    await expect(store().getForCustomer(technician, id)).rejects.toBeInstanceOf(
      RepairAccessError,
    );
  });
});

describe("persistence and bounds", () => {
  it("survives a fresh store instance (a reload) and shows in both views", async () => {
    const { id } = await store().createForCustomer(customerA, input, randomUUID());

    // A brand-new store over the same database models a reload / new process.
    const reloaded = createRepairStore(testDb());
    expect((await reloaded.listForCustomer(customerA)).items.map((r) => r.id)).toEqual([id]);
    expect((await reloaded.listQueue(technician)).items.map((r) => r.id)).toEqual([id]);
    expect(await reloaded.getForCustomer(customerA, id)).not.toBeNull();
    expect(await reloaded.getForTechnician(technician, id)).not.toBeNull();
  });

  it("never reads more than LIST_LIMIT requests and reports that more exist", async () => {
    const db = testDb();
    const total = LIST_LIMIT + 5;
    const base = Date.now();
    for (let start = 0; start < total; start += 20) {
      const batch = db.batch();
      for (let i = start; i < Math.min(start + 20, total); i++) {
        batch.set(db.collection(REPAIRS_COLLECTION).doc(repairIdFor("bulk", String(i))), {
          ownerId: customerA.userId,
          deviceType: "phone",
          brand: `Brand ${i}`,
          model: "M",
          description: "bulk record for the limit test",
          status: "submitted",
          createdAt: Timestamp.fromMillis(base + i * 1000),
        });
      }
      await batch.commit();
    }

    const mine = await store().listForCustomer(customerA);
    expect(mine.items).toHaveLength(LIST_LIMIT);
    expect(mine.hasMore).toBe(true);
    // Newest first: the most recently created record leads.
    expect(mine.items[0].brand).toBe(`Brand ${total - 1}`);

    const queue = await store().listQueue(technician);
    expect(queue.items).toHaveLength(LIST_LIMIT);
    expect(queue.hasMore).toBe(true);
  });

  it("surfaces malformed stored data as an error instead of hiding it", async () => {
    await testDb().collection(REPAIRS_COLLECTION).doc("a".repeat(40)).set({
      ownerId: customerA.userId,
      createdAt: Timestamp.now(),
      // brand/model/status missing
    });
    await expect(store().listForCustomer(customerA)).rejects.toThrow();
  });
});