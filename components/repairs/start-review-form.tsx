"use client";

import { useActionState } from "react";
import {
  INITIAL_REVIEW_STATE,
  type StartReviewState,
} from "@/lib/repairs/review-state";

type Props = {
  repairId: string;
  action: (
    previous: StartReviewState,
    formData: FormData,
  ) => Promise<StartReviewState>;
};

/**
 * "Start review" for a Submitted request. The page only renders this while the
 * saved status is Submitted; after a successful save the page re-renders with
 * In Review and this form is gone. On failure the status shown on the page is
 * left untouched (it is the last one the server confirmed) and the button stays
 * so the technician can try again.
 */
export function StartReviewForm({ repairId, action }: Props) {
  const [state, formAction, isPending] = useActionState(action, INITIAL_REVIEW_STATE);

  if (state.status === "success" && !isPending) return null;

  return (
    <form action={formAction} aria-busy={isPending} className="mt-4 grid gap-3">
      <input type="hidden" name="repairId" value={repairId} />
      {state.status === "error" && !isPending ? (
        <p role="alert" className="font-semibold text-accent">
          {state.message}
        </p>
      ) : null}
      <div>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-h-12 items-center justify-center border-2 border-accent bg-accent px-6 py-3 font-display text-sm font-bold uppercase tracking-[0.14em] text-paper transition-colors hover:border-ink hover:bg-ink disabled:cursor-not-allowed disabled:border-muted disabled:bg-muted"
        >
          {isPending ? "Saving…" : "Start review"}
        </button>
      </div>
      <p role="status" className="text-sm text-ink-soft">
        {isPending ? "Saving the new status…" : ""}
      </p>
    </form>
  );
}
