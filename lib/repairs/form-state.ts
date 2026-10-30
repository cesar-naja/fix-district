import type { FieldErrors, RepairFormValues } from "@/lib/repairs/schema";

/** Result passed from the submit action back to the form. */
export type RepairFormState =
  | { status: "idle" }
  | {
      status: "error";
      /** Form-level message (save failure, expired form). */
      message?: string;
      errors: FieldErrors;
      /** What the user typed, so the form can keep it. */
      values: RepairFormValues;
    }
  | { status: "success"; id: string };

export const INITIAL_FORM_STATE: RepairFormState = { status: "idle" };
