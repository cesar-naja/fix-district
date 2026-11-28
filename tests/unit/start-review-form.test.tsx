// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StartReviewForm } from "@/components/repairs/start-review-form";
import type { StartReviewState } from "@/lib/repairs/review-state";

const ID = "a".repeat(40);

afterEach(cleanup);

describe("StartReviewForm", () => {
  it("sends only the request ID", async () => {
    const action = vi.fn(async (): Promise<StartReviewState> => ({ status: "success" }));
    const user = userEvent.setup();
    render(<StartReviewForm repairId={ID} action={action} />);

    await user.click(screen.getByRole("button", { name: "Start review" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const [, formData] = action.mock.calls[0] as unknown as [StartReviewState, FormData];
    expect([...formData.keys()].filter((k) => !k.startsWith("$ACTION"))).toEqual(["repairId"]);
    expect(formData.get("repairId")).toBe(ID);
  });

  it("disables the button while saving, then disappears on success", async () => {
    let finish!: (state: StartReviewState) => void;
    const action = vi.fn(
      () => new Promise<StartReviewState>((resolve) => (finish = resolve)),
    );
    const user = userEvent.setup();
    render(<StartReviewForm repairId={ID} action={action} />);

    await user.click(screen.getByRole("button", { name: "Start review" }));
    const pending = await screen.findByRole("button", { name: "Saving…" });
    expect((pending as HTMLButtonElement).disabled).toBe(true);

    finish({ status: "success" });
    await waitFor(() => expect(screen.queryByRole("button")).toBeNull());
  });

  it("explains a failed save and lets the technician try again", async () => {
    const action = vi
      .fn<() => Promise<StartReviewState>>()
      .mockResolvedValueOnce({
        status: "error",
        message: "We couldn’t save the change. Please try again.",
      })
      .mockResolvedValueOnce({ status: "success" });
    const user = userEvent.setup();
    render(<StartReviewForm repairId={ID} action={action} />);

    await user.click(screen.getByRole("button", { name: "Start review" }));
    expect((await screen.findByRole("alert")).textContent).toMatch(/couldn’t save the change/);
    const retry = screen.getByRole("button", { name: "Start review" });
    expect((retry as HTMLButtonElement).disabled).toBe(false);

    await user.click(retry);
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });
});
