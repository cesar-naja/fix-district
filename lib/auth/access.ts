import { auth, clerkClient } from "@clerk/nextjs/server";
import { forbidden } from "next/navigation";
import { cache } from "react";
import { type Role, roleFromPrivateMetadata } from "@/lib/auth/roles";

/**
 * Server-side authentication and authorization: the single place that decides
 * who a request is and what role they hold.
 *
 * Call these from the code that actually does the work (page components, and
 * any future Server Action or Route Handler), not only from navigation. Hiding
 * a link is cosmetic; these checks are the enforcement.
 *
 * The role is read from Clerk private metadata through the Backend API on every
 * request (de-duplicated per request by `cache`). It is deliberately not taken
 * from the session token, cookies, query parameters, or any client-writable
 * metadata, so a user cannot grant themselves a role.
 *
 * Request data is read here, so callers must render inside <Suspense>
 * (required by cacheComponents).
 */

export type Access = {
  userId: string;
  role: Role;
  /** First name for greetings, or null when the account has none. */
  firstName: string | null;
};

/** Resolves the current user's access, or null when signed out. */
export const getAccess = cache(async (): Promise<Access | null> => {
  const { userId } = await auth();
  if (!userId) return null;

  // Throws if Clerk is unreachable, which fails closed (no page renders).
  const client = await clerkClient();
  const user = await client.users.getUser(userId);

  return {
    userId,
    role: roleFromPrivateMetadata(user.privateMetadata),
    firstName: user.firstName,
  };
});

/** Requires a signed-in user. Signed-out visitors are sent to sign in. */
export async function requireUser(): Promise<Access> {
  const access = await getAccess();
  if (!access) {
    const { redirectToSignIn } = await auth();
    return redirectToSignIn();
  }
  return access;
}

/**
 * Requires a signed-in user holding exactly `role`. Signed-out visitors are
 * sent to sign in; signed-in users with another role get a 403 (see
 * app/forbidden.tsx). Works in Server Components, Server Actions, and Route
 * Handlers.
 */
export async function requireRole(role: Role): Promise<Access> {
  const access = await requireUser();
  if (access.role !== role) forbidden();
  return access;
}
