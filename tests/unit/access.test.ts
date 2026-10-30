import { beforeEach, describe, expect, it, vi } from "vitest";

// Stand-ins for Clerk and Next.js control flow. redirect/forbidden throw, as
// the real ones do, so a call that "succeeds" can never fall through.
const clerk = vi.hoisted(() => ({
  userId: null as string | null,
  privateMetadata: {} as unknown,
  firstName: "Sam" as string | null,
  getUser: vi.fn(),
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: async () => ({
    userId: clerk.userId,
    redirectToSignIn: () => {
      throw new Error("REDIRECT_TO_SIGN_IN");
    },
  }),
  clerkClient: async () => ({
    users: {
      getUser: async (id: string) => {
        clerk.getUser(id);
        return { privateMetadata: clerk.privateMetadata, firstName: clerk.firstName };
      },
    },
  }),
}));

vi.mock("next/navigation", () => ({
  forbidden: () => {
    throw new Error("FORBIDDEN");
  },
}));

// `cache` memoises per request in Next; in tests every call is its own request.
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react")>()),
  cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

import { getAccess, requireRole, requireUser } from "@/lib/auth/access";

beforeEach(() => {
  clerk.userId = null;
  clerk.privateMetadata = {};
  clerk.getUser.mockClear();
});

describe("server-side access checks", () => {
  it("treats a signed-out visitor as no access and sends them to sign in", async () => {
    expect(await getAccess()).toBeNull();
    await expect(requireUser()).rejects.toThrow("REDIRECT_TO_SIGN_IN");
    await expect(requireRole("customer")).rejects.toThrow("REDIRECT_TO_SIGN_IN");
    await expect(requireRole("technician")).rejects.toThrow("REDIRECT_TO_SIGN_IN");
    expect(clerk.getUser).not.toHaveBeenCalled();
  });

  it("defaults new users to customer", async () => {
    clerk.userId = "user_1";
    expect((await getAccess())?.role).toBe("customer");
    await expect(requireRole("customer")).resolves.toMatchObject({
      userId: "user_1",
      role: "customer",
    });
  });

  it("rejects a customer on technician-only operations", async () => {
    clerk.userId = "user_1";
    await expect(requireRole("technician")).rejects.toThrow("FORBIDDEN");
  });

  it("grants technician only for exactly role: technician in private metadata", async () => {
    clerk.userId = "user_2";
    clerk.privateMetadata = { role: "technician" };
    await expect(requireRole("technician")).resolves.toMatchObject({
      role: "technician",
    });
    await expect(requireRole("customer")).rejects.toThrow("FORBIDDEN");
  });

  it("fails closed on look-alike or malformed role values", async () => {
    clerk.userId = "user_3";
    for (const value of ["Technician", "admin", ["technician"], true, null, {}]) {
      clerk.privateMetadata = { role: value };
      expect((await getAccess())?.role).toBe("customer");
    }
  });

  it("fails closed when Clerk cannot be reached", async () => {
    clerk.userId = "user_4";
    clerk.getUser.mockImplementationOnce(() => {
      throw new Error("network down");
    });
    // The mock above throws inside getUser's wrapper via the spy.
    await expect(requireRole("technician")).rejects.toThrow();
  });
});