import { vi } from "vitest";
import type { Role } from "@/lib/auth/roles";

/**
 * Controls who the mocked Clerk session says is signed in. Use together with
 * `vi.mock("@/lib/auth/access", ...)` (see tests/integration/server.test.ts).
 * requireRole mirrors the real one: redirect when signed out, forbidden on a
 * role mismatch, both by throwing.
 */
export const session = {
  current: null as { userId: string; role: Role; firstName: string | null } | null,
};

export function signedOut() {
  session.current = null;
}

export function signInAs(userId: string, role: Role) {
  session.current = { userId, role, firstName: "Test" };
}

export const fakeRequireRole = vi.fn(async (role: Role) => {
  if (!session.current) throw new Error("NEXT_REDIRECT sign-in");
  if (session.current.role !== role) throw new Error("NEXT_HTTP_ERROR_FALLBACK;403");
  return session.current;
});