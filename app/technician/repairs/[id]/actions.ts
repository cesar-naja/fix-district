"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/access";
import type { StartReviewState } from "@/lib/repairs/review-state";
import { isValidRepairId } from "@/lib/repairs/schema";
import { startRepairReview } from "@/lib/repairs/server";

const SAVE_FAILED =
  "We couldn’t save the change. The status shown is the last saved one. Please try again.";

/**
 * Moves a Submitted repair request to In Review.
 *
 * Only the request ID is read from the form. The new status is fixed here and
 * the store only ever applies Submitted → In Review, so a posted "status" (or
 * any other field) is never looked at.
 */
export async function startReview(
  _previous: StartReviewState,
  formData: FormData,
): Promise<StartReviewState> {
  // Server Actions are public endpoints: check access here, every time.
  await requireRole("technician");

  const id = formData.get("repairId");
  if (!isValidRepairId(id)) {
    return { status: "error", message: SAVE_FAILED };
  }

  const result = await startRepairReview(id);
  if (!result.ok) {
    return {
      status: "error",
      message:
        result.reason === "not_found"
          ? "This repair request no longer exists."
          : SAVE_FAILED,
    };
  }

  // Re-render this page with the saved status, and drop any client-side copy
  // of the queue and the customer's pages so they show it the next time.
  revalidatePath(`/technician/repairs/${id}`);
  revalidatePath("/technician");
  revalidatePath(`/customer/repairs/${id}`);
  revalidatePath("/customer");
  return { status: "success" };
}
