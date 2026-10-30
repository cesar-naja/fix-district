/**
 * Role model. Pure data and helpers with no framework or Clerk imports, so it
 * is safe to import from anywhere (the server-side checks live in ./access.ts).
 *
 * Roles are NOT stored in anything a user can write. A technician is
 * designated by `privateMetadata.role === "technician"` on the Clerk user,
 * which only the Clerk Dashboard or the Backend API (secret key) can change.
 * Every other value, including a missing one, means "customer".
 */

export const ROLES = ["customer", "technician"] as const;
export type Role = (typeof ROLES)[number];

export const DEFAULT_ROLE: Role = "customer";

export const DASHBOARD_PATH: Record<Role, `/${Role}`> = {
  customer: "/customer",
  technician: "/technician",
};

/**
 * Reads the role from a user's private metadata. Fails closed: anything that
 * is not exactly the string "technician" resolves to the default customer role.
 */
export function roleFromPrivateMetadata(metadata: unknown): Role {
  if (typeof metadata === "object" && metadata !== null && "role" in metadata) {
    if (metadata.role === "technician") return "technician";
  }
  return DEFAULT_ROLE;
}
