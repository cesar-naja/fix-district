import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeRequireRole, signInAs, signedOut } from "../helpers/session";

vi.mock("@/lib/auth/access", () => ({
  requireRole: (role: "customer" | "technician") => fakeRequireRole(role),
}));

// connection() only works inside a Next.js request; here it is a no-op.
vi.mock("next/server", () => ({ connection: async () => {} }));

const adminHolder = vi.hoisted(() => ({ broken: false }));
vi.mock("@/lib/firebase/admin", async () => {
  const real = await vi.importActual<typeof import("@/lib/firebase/admin")>(
    "@/lib/firebase/admin",
  );
  return {
    ...real,
    getAdminFirestore: () => {
      if (adminHolder.broken) throw new Error("secret-ish connection detail");
      return real.getAdminFirestore();
    },
  };
});

import {
  loadMyRepair,
  loadMyRepairs,
  loadRepairForTechnician,
  loadRepairQueue,
  saveRepairRequest,
} from "@/lib/repairs/server";
import { clearEmulator, rawRepairDocs } from "../helpers/emulator";

const input = {
  deviceType: "tablet",
  brand: "Samsung",
  model: "Galaxy Tab S8",
  description: "The charging port no longer holds the cable firmly.",
};

beforeEach(async () => {
  await clearEmulator();
  signedOut();
  adminHolder.broken = false;
  vi.restoreAllMocks();
});

describe("signed-out visitors", () => {
  it("cannot read or write repair data through any server operation", async () => {
    // Seed one record as a real customer so there is something to leak.
    signInAs("user_a", "customer");
    const saved = await saveRepairRequest(input, randomUUID());
    expect(saved.ok).toBe(true);
    const id = saved.ok ? saved.id : "";

    signedOut();
    await expect(saveRepairRequest(input, randomUUID())).rejects.toThrow("NEXT_REDIRECT");
    await expect(loadMyRepairs()).rejects.toThrow("NEXT_REDIRECT");
    await expect(loadMyRepair(id)).rejects.toThrow("NEXT_REDIRECT");
    await expect(loadRepairQueue()).rejects.toThrow("NEXT_REDIRECT");
    await expect(loadRepairForTechnician(id)).rejects.toThrow("NEXT_REDIRECT");
    expect(await rawRepairDocs()).toHaveLength(1);
  });
});

describe("authenticated ownership", () => {
  it("assigns the owner from the session, never from input", async () => {
    signInAs("user_a", "customer");
    const result = await saveRepairRequest(
      { ...input, ownerId: "user_b", status: "done" },
      randomUUID(),
    );
    expect(result.ok).toBe(true);
    const [doc] = await rawRepairDocs();
    expect(doc.data.ownerId).toBe("user_a");
    expect(doc.data.status).toBe("submitted");
  });

  it("isolates customers: B cannot list or open A's request", async () => {
    signInAs("user_a", "customer");
    const saved = await saveRepairRequest(input, randomUUID());
    const id = saved.ok ? saved.id : "";

    signInAs("user_b", "customer");
    const list = await loadMyRepairs();
    expect(list).toEqual({ ok: true, data: { items: [], hasMore: false } });
    expect(await loadMyRepair(id)).toEqual({ ok: true, data: null });
    // Same answer for an ID that was never created.
    expect(await loadMyRepair("0".repeat(40))).toEqual({ ok: true, data: null });

    signInAs("user_a", "customer");
    const mine = await loadMyRepairs();
    expect(mine.ok && mine.data.items).toHaveLength(1);
  });

  it("rejects invalid input without writing", async () => {
    signInAs("user_a", "customer");
    expect(await saveRepairRequest({ ...input, brand: "" }, randomUUID())).toEqual({
      ok: false,
      reason: "invalid",
    });
    expect(await rawRepairDocs()).toHaveLength(0);
  });
});

describe("role enforcement on every operation", () => {
  it("lets technicians see the queue and details, but customers get a 403", async () => {
    signInAs("user_a", "customer");
    const saved = await saveRepairRequest(input, randomUUID());
    const id = saved.ok ? saved.id : "";

    await expect(loadRepairQueue()).rejects.toThrow("403");
    await expect(loadRepairForTechnician(id)).rejects.toThrow("403");

    signInAs("tech_1", "technician");
    const queue = await loadRepairQueue();
    expect(queue.ok && queue.data.items.map((r) => r.id)).toEqual([id]);
    const detail = await loadRepairForTechnician(id);
    expect(detail.ok && detail.data?.description).toBe(input.description);
  });

  it("blocks technicians from customer-only operations, including writes", async () => {
    signInAs("tech_1", "technician");
    await expect(saveRepairRequest(input, randomUUID())).rejects.toThrow("403");
    await expect(loadMyRepairs()).rejects.toThrow("403");
    await expect(loadMyRepair("a".repeat(40))).rejects.toThrow("403");
    expect(await rawRepairDocs()).toHaveLength(0);
  });
});

describe("failures are not shown as empty lists", () => {
  it("returns ok:false (not an empty result) when the database is unavailable", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    adminHolder.broken = true;

    signInAs("user_a", "customer");
    expect(await loadMyRepairs()).toEqual({ ok: false });
    expect(await loadMyRepair("a".repeat(40))).toEqual({ ok: false });
    expect(await saveRepairRequest(input, randomUUID())).toEqual({
      ok: false,
      reason: "unavailable",
    });

    signInAs("tech_1", "technician");
    expect(await loadRepairQueue()).toEqual({ ok: false });
    expect(await loadRepairForTechnician("a".repeat(40))).toEqual({ ok: false });

    // Logs name the operation and error type only: no messages, no user input.
    const logged = log.mock.calls.flat().join(" ");
    expect(logged).toContain("[repairs]");
    expect(logged).not.toContain("secret-ish");
    expect(logged).not.toContain(input.description);
  });
});