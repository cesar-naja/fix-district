import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeRequireRole, signInAs, signedOut } from "../helpers/session";

vi.mock("@/lib/auth/access", () => ({
  requireRole: (role: "customer" | "technician") => fakeRequireRole(role),
}));
const cache = vi.hoisted(() => ({ revalidatePath: vi.fn() }));
vi.mock("next/cache", () => cache);
vi.mock("next/server", () => ({ connection: async () => {} }));

const adminHolder = vi.hoisted(() => ({ broken: false }));
vi.mock("@/lib/firebase/admin", async () => {
  const real = await vi.importActual<typeof import("@/lib/firebase/admin")>(
    "@/lib/firebase/admin",
  );
  return {
    ...real,
    getAdminFirestore: () => {
      if (adminHolder.broken) throw new Error("database down");
      return real.getAdminFirestore();
    },
  };
});

import { startReview } from "@/app/technician/repairs/[id]/actions";
import { INITIAL_REVIEW_STATE } from "@/lib/repairs/review-state";
import { saveRepairRequest } from "@/lib/repairs/server";
import { clearEmulator, rawRepairDocs } from "../helpers/emulator";

const input = {
  deviceType: "phone",
  brand: "Google",
  model: "Pixel 8",
  description: "The battery drains from full to empty in two hours.",
};

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

async function seedAsCustomer(userId = "user_a"): Promise<string> {
  signInAs(userId, "customer");
  const saved = await saveRepairRequest(input, randomUUID());
  if (!saved.ok) throw new Error("seed failed");
  return saved.id;
}

beforeEach(async () => {
  await clearEmulator();
  signedOut();
  adminHolder.broken = false;
  cache.revalidatePath.mockClear();
});

describe("startReview (server action)", () => {
  it("saves In Review for a technician and refreshes both roles' pages", async () => {
    const id = await seedAsCustomer();
    signInAs("tech_1", "technician");

    const state = await startReview(INITIAL_REVIEW_STATE, form({ repairId: id }));

    expect(state).toEqual({ status: "success" });
    const [{ data }] = await rawRepairDocs();
    expect(data.status).toBe("in_review");
    const paths = cache.revalidatePath.mock.calls.map(([path]) => path);
    expect(paths).toEqual(
      expect.arrayContaining([
        `/technician/repairs/${id}`,
        "/technician",
        `/customer/repairs/${id}`,
        "/customer",
      ]),
    );
  });

  it("leaves the request In Review when submitted repeatedly", async () => {
    const id = await seedAsCustomer();
    signInAs("tech_1", "technician");
    const states = await Promise.all(
      Array.from({ length: 3 }, () =>
        startReview(INITIAL_REVIEW_STATE, form({ repairId: id })),
      ),
    );
    expect(states.every((s) => s.status === "success")).toBe(true);
    expect(await startReview(INITIAL_REVIEW_STATE, form({ repairId: id }))).toEqual({
      status: "success",
    });
    const docs = await rawRepairDocs();
    expect(docs).toHaveLength(1);
    expect(docs[0].data.status).toBe("in_review");
  });

  it("rejects customer accounts (even the owner) and signed-out visitors", async () => {
    const id = await seedAsCustomer("user_a");
    const body = form({ repairId: id });

    // The owner.
    await expect(startReview(INITIAL_REVIEW_STATE, body)).rejects.toThrow("403");
    // Another customer.
    signInAs("user_b", "customer");
    await expect(startReview(INITIAL_REVIEW_STATE, body)).rejects.toThrow("403");
    // Signed out.
    signedOut();
    await expect(startReview(INITIAL_REVIEW_STATE, body)).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    const [{ data }] = await rawRepairDocs();
    expect(data.status).toBe("submitted");
    expect(cache.revalidatePath).not.toHaveBeenCalled();
  });

  it("ignores any posted status and only applies Submitted → In Review", async () => {
    const id = await seedAsCustomer();
    signInAs("tech_1", "technician");
    await startReview(
      INITIAL_REVIEW_STATE,
      form({ repairId: id, status: "completed", ownerId: "user_x" }),
    );
    const [{ data }] = await rawRepairDocs();
    expect(data.status).toBe("in_review");
    expect(data.ownerId).toBe("user_a");
  });

  it("explains a failed save, changes nothing, and can be retried", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const id = await seedAsCustomer();
    signInAs("tech_1", "technician");

    adminHolder.broken = true;
    const failed = await startReview(INITIAL_REVIEW_STATE, form({ repairId: id }));
    expect(failed.status).toBe("error");
    expect(failed.status === "error" && failed.message).toMatch(/couldn’t save the change/);
    expect(cache.revalidatePath).not.toHaveBeenCalled();

    adminHolder.broken = false;
    expect((await rawRepairDocs())[0].data.status).toBe("submitted");
    const retried = await startReview(failed, form({ repairId: id }));
    expect(retried).toEqual({ status: "success" });
    expect((await rawRepairDocs())[0].data.status).toBe("in_review");
    log.mockRestore();
  });

  it("returns an error for missing, malformed, or unknown request IDs", async () => {
    signInAs("tech_1", "technician");
    for (const fields of [{}, { repairId: "../x" }, { repairId: "0".repeat(40) }]) {
      const state = await startReview(INITIAL_REVIEW_STATE, form(fields));
      expect(state.status).toBe("error");
    }
    expect(await rawRepairDocs()).toHaveLength(0);
    expect(cache.revalidatePath).not.toHaveBeenCalled();
  });
});
