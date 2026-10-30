import { DEVICE_TYPE_LABEL, STATUS_LABEL } from "@/lib/repairs/schema";
import type { RepairSummary } from "@/lib/repairs/types";

/** "Apple iPhone 13" */
export function deviceName(repair: Pick<RepairSummary, "brand" | "model">) {
  return `${repair.brand} ${repair.model}`;
}

export function deviceTypeLabel(repair: Pick<RepairSummary, "deviceType">) {
  return DEVICE_TYPE_LABEL[repair.deviceType] ?? repair.deviceType;
}

export function statusLabel(repair: Pick<RepairSummary, "status">) {
  return STATUS_LABEL[repair.status] ?? repair.status;
}

/** Short reference shown to people; the full ID stays in the URL. */
export function referenceCode(id: string) {
  return id.slice(0, 8).toUpperCase();
}

// Rendered on the server, so the time zone is pinned and shown explicitly
// rather than silently using the server's.
const dateFormat = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

export function formatSubmitted(iso: string) {
  return dateFormat.format(new Date(iso));
}
