import { randomBytes } from "node:crypto";
import { createClerkClient } from "@clerk/backend";
import type { E2EConfig } from "../config/env";
import {
  E2ESafetyError,
  assertClerkTestKeys,
  frameworkUserTag,
  isTaggedForRun,
  publishableKeyHost,
} from "./safety";

export type TestRole = "customer" | "technician";

export type TestUser = {
  userId: string;
  email: string;
  role: TestRole;
};

/**
 * Creates and removes disposable Clerk users in the dedicated testing
 * application, through the Clerk Backend API.
 *
 * Ownership rules (deliberately strict):
 *  - Every user is stamped with a tag in public metadata: framework name, this
 *    run's ID, and the Clerk application's Frontend API host.
 *  - The instance remembers the IDs it created. It deletes only those, and only
 *    after re-reading the user and confirming the tag still matches this run
 *    and this application.
 *  - It never lists, searches, or sweeps users. Leftovers from a crashed run
 *    are removed by hand in the Clerk Dashboard (see e2e/README.md).
 *
 * Roles are granted exactly as production grants them: `role: "technician"` in
 * private metadata, which only the Backend API (or Dashboard) can write.
 */
export function createClerkTestUsers(config: E2EConfig) {
  assertClerkTestKeys(config.clerk.publishableKey, config.clerk.secretKey);
  const appHost = publishableKeyHost(config.clerk.publishableKey);
  if (!appHost) throw new E2ESafetyError("Cannot read the Clerk application host.");

  const client = createClerkClient({
    secretKey: config.clerk.secretKey,
    publishableKey: config.clerk.publishableKey,
  });
  const created: string[] = [];

  return {
    /** A new user with only an email address (no password), tagged for this run. */
    async create(role: TestRole, workerIndex: number): Promise<TestUser> {
      const suffix = randomBytes(3).toString("hex");
      // "+clerk_test" addresses are never emailed by Clerk in development.
      const email = `e2e-${config.runId}-w${workerIndex}-${role}-${suffix}+clerk_test@example.com`;
      const user = await client.users.createUser({
        emailAddress: [email],
        firstName: "E2E",
        lastName: role === "technician" ? "Technician" : "Customer",
        skipPasswordRequirement: true,
        skipLegalChecks: true,
        publicMetadata: { e2e: frameworkUserTag(config.runId, appHost) },
        ...(role === "technician" ? { privateMetadata: { role: "technician" } } : {}),
      });
      created.push(user.id);
      return { userId: user.id, email, role };
    },

    /** Deletes the users this instance created, after confirming their tag. */
    async deleteCreated(): Promise<void> {
      const failures: string[] = [];
      for (const userId of created.splice(0)) {
        try {
          const user = await client.users.getUser(userId);
          if (!isTaggedForRun(user.publicMetadata, config.runId, appHost)) {
            failures.push(`${userId}: tag mismatch, left in place`);
            continue;
          }
          await client.users.deleteUser(userId);
        } catch (error) {
          const name = error instanceof Error ? error.name : "Error";
          failures.push(`${userId}: ${name}`);
        }
      }
      if (failures.length > 0) {
        // Names only. Remove any leftovers by hand in the dedicated Clerk app.
        console.warn(`[e2e] Could not delete some test users:\n - ${failures.join("\n - ")}`);
      }
    },
  };
}
