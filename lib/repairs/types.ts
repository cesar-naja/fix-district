import type { DeviceType, RepairStatus } from "@/lib/repairs/schema";

/**
 * What the interface is allowed to see. Deliberately excludes the owner's
 * user ID and any other storage field. Add a field here only when a screen
 * actually needs it.
 */
export type RepairSummary = {
  id: string;
  deviceType: DeviceType;
  brand: string;
  model: string;
  status: RepairStatus;
  /** ISO 8601, assigned by the server when the request was saved. */
  createdAt: string;
};

export type RepairDetail = RepairSummary & {
  description: string;
};

export type RepairList = {
  items: RepairSummary[];
  /** True when more requests exist than were returned. */
  hasMore: boolean;
};
