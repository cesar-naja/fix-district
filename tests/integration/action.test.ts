import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeRequireRole, signInAs, signedOut } from "../helpers/session";

vi.mock("@/lib/auth/access", () => ({
  requireRole: (role: "customer" | "technician") => fakeRequireRole(role),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/server", () => ({ connection: async () => {} }));

import { submitRepairRequest } from "@/app/customer/new/actions";
import { INITIAL_FORM_STATE } from "@/lib/repairs/form-state";
import { clearEmulator, rawRepairDocs } from "../helpers/emulator";

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

const valid = {
  deviceType: "console",
  brand: "Sony",
  model: "PlayStation 5",
  description: "The disc drive makes a grinding noise and ejects discs.",
};

beforeEach(async () => {
  await clearEmulator();
  signedOut();
});

describe("submitRepairRequest (server action)", () => {
  it("saves the request and returns success", async () => {
    signInAs("user_a", "customer");
    const state = await submitRepairRequest(
      INITIAL_FORM_STATE,
      form({ ...valid, requestKey: randomUUID() }),
    );
    expect(state.status).toBe("success");
    const docs = await rawRepairDocs();
    expect(docs).toHaveLength(1);
    expect(state.status === "success" && state.id).toBe(docs[0].id);
  });

  it("cannot be tricked by forged ownership, status, or timestamp fields", async () => {
    signInAs("user_a", "customer");
    await submitRepairRequest(
      INITIAL_FORM_STATE,
      form({
        ...valid,
        requestKey: randomUUID(),
        ownerId: "user_victim",
        userId: "user_victim",
        status: "completed",
        createdAt: "1999-01-01T00:00:00.000Z",
        role: "technician",
      }),
    );
    const [{ data }] = await rawRepairDocs();
    expect(data.ownerId).toBe("user_a");
    expect(data.status).toBe("submitted");
    expect(data.createdAt.toDate().getFullYear()).toBeGreaterThan(2000);
    expect(data.role).toBeUndefined();
    expect(data.userId).toBeUndefined();
  });

  it("saves only one request when the same form is submitted repeatedly", async () => {
    signInAs("user_a", "customer");
    const key = randomUUID();
    const states = await Promise.all(
      Array.from({ length: 5 }, () =>
        submitRepairRequest(INITIAL_FORM_STATE, form({ ...valid, requestKey: key })),
      ),
    );
    expect(states.every((s) => s.status === "success")).toBe(true);
    expect(new Set(states.map((s) => s.status === "success" && s.id)).size).toBe(1);
    expect(await rawRepairDocs()).toHaveLength(1);
  });

  it("returns field errors and the entered values, saving nothing, when invalid", async () => {
    signInAs("user_a", "customer");
    const state = await submitRepairRequest(
      INITIAL_FORM_STATE,
      form({ ...valid, brand: "", description: "short", requestKey: randomUUID() }),
    );
    expect(state.status).toBe("error");
    if (state.status === "error") {
      expect(Object.keys(state.errors).sort()).toEqual(["brand", "description"]);
      expect(state.values.model).toBe("PlayStation 5");
    }
    expect(await rawRepairDocs()).toHaveLength(0);
  });

  it("rejects a missing or malformed request key and keeps the values", async () => {
    signInAs("user_a", "customer");
    for (const fields of [valid, { ...valid, requestKey: "nope" }]) {
      const state = await submitRepairRequest(INITIAL_FORM_STATE, form(fields));
      expect(state.status).toBe("error");
      if (state.status === "error") {
        expect(state.message).toMatch(/expired/i);
        expect(state.values.brand).toBe("Sony");
      }
    }
    expect(await rawRepairDocs()).toHaveLength(0);
  });

  it("rejects signed-out and technician callers before touching the database", async () => {
    const body = form({ ...valid, requestKey: randomUUID() });
    await expect(submitRepairRequest(INITIAL_FORM_STATE, body)).rejects.toThrow(
      "NEXT_REDIRECT",
    );
    signInAs("tech_1", "technician");
    await expect(submitRepairRequest(INITIAL_FORM_STATE, body)).rejects.toThrow("403");
    expect(await rawRepairDocs()).toHaveLength(0);
  });

  it("ignores file uploads and non-string values", async () => {
    signInAs("user_a", "customer");
    const body = form({ ...valid, requestKey: randomUUID() });
    body.set("brand", new File(["x"], "brand.txt"));
    const state = await submitRepairRequest(INITIAL_FORM_STATE, body);
    expect(state.status).toBe("error");
    expect(await rawRepairDocs()).toHaveLength(0);
  });
});