/** Result passed from the "Start review" action back to its button. */
export type StartReviewState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success" };

export const INITIAL_REVIEW_STATE: StartReviewState = { status: "idle" };
