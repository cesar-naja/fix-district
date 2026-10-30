"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/access";
import type { RepairFormState } from "@/lib/repairs/form-state";
import {
  EMPTY_VALUES,
  isValidRequestKey,
  validateRepairInput,
  type RepairFormValues,
} from "@/lib/repairs/schema";
import { saveRepairRequest } from "@/lib/repairs/server";

function text(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

/**
 * Creates a repair request for the signed-in customer.
 *
 * Only the four device fields and the idempotency key are read from the form.
 * Owner, status, and timestamps are set on the server, so extra fields a
 * client posts (ownerId, status, createdAt, ...) are never looked at.
 */
export async function submitRepairRequest(
  _previous: RepairFormState,
  formData: FormData,
): Promise<RepairFormState> {
  // Server Actions are public endpoints: check access here, every time.
  await requireRole("customer");

  const parsed = validateRepairInput({
    deviceType: formData.get("deviceType"),
    brand: formData.get("brand"),
    model: formData.get("model"),
    description: formData.get("description"),
  });
  if (!parsed.ok) {
    return { status: "error", errors: parsed.errors, values: parsed.values };
  }

  const values: RepairFormValues = { ...EMPTY_VALUES, ...parsed.data };
  const requestKey = text(formData, "requestKey");
  if (!isValidRequestKey(requestKey)) {
    return {
      status: "error",
      message: "This form has expired. Reload the page and try again.",
      errors: {},
      values,
    };
  }

  const saved = await saveRepairRequest(parsed.data, requestKey);
  if (!saved.ok) {
    return {
      status: "error",
      message:
        saved.reason === "invalid"
          ? "Please check the highlighted fields and try again."
          : "We couldn’t save your request. Your answers are still here, so you can try again in a moment.",
      errors: {},
      values,
    };
  }

  // Drop any client-side copy of the customer's list so it shows the new request.
  revalidatePath("/customer");
  return { status: "success", id: saved.id };
}
