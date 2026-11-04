import { randomBytes } from "node:crypto";

/**
 * Synthetic test data. Everything here is invented; nothing is real customer
 * data. Values are literals on purpose: tests state the business outcome they
 * expect, and must not read it back from the app's own validation constants.
 */

/** Short, unique per test. Goes into model and description to find the record. */
export function uniqueMarker(runId: string, workerIndex: number): string {
  return `${runId}-w${workerIndex}-${randomBytes(3).toString("hex")}`;
}

export type RepairFormInput = {
  /** The visible label of the device-type choice, e.g. "Phone". */
  deviceType: "Phone" | "Laptop" | "Tablet" | "Console";
  brand: string;
  model: string;
  description: string;
};

/** A valid repair request containing the marker in its searchable fields. */
export function repairInput(
  marker: string,
  overrides: Partial<RepairFormInput> = {},
): RepairFormInput {
  return {
    deviceType: "Phone",
    brand: "E2E Brand",
    model: `Model ${marker}`,
    description: `Synthetic problem description for automated testing ${marker}.`,
    ...overrides,
  };
}

/** Maps a visible device label to the stored value, for seeding. */
export const DEVICE_VALUE = {
  Phone: "phone",
  Laptop: "laptop",
  Tablet: "tablet",
  Console: "console",
} as const;
