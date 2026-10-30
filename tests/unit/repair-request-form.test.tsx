// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RepairRequestForm } from "@/components/repairs/repair-request-form";
import type { RepairFormState } from "@/lib/repairs/form-state";

const KEY = "3f2b1c3e-9d0a-4c52-8a52-0a3f6a2f4b11";

afterEach(cleanup);

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText("Laptop"));
  await user.type(screen.getByLabelText(/^Brand/), "Lenovo");
  await user.type(screen.getByLabelText(/^Model/), "ThinkPad T14");
  await user.type(
    screen.getByLabelText(/What’s wrong/),
    "It will not boot past the logo screen.",
  );
}

describe("RepairRequestForm", () => {
  it("labels every field and states the limits and the no-passwords warning", () => {
    render(<RepairRequestForm requestKey={KEY} action={vi.fn()} />);
    expect(screen.getByRole("group", { name: /Device type/ })).toBeTruthy();
    for (const name of ["Phone", "Laptop", "Tablet", "Console"]) {
      expect(screen.getByLabelText(name)).toBeTruthy();
    }
    expect(screen.getByLabelText(/^Brand/)).toBeTruthy();
    expect(screen.getByLabelText(/^Model/)).toBeTruthy();
    expect(screen.getByLabelText(/What’s wrong/)).toBeTruthy();
    expect(screen.getByText(/Do not include passwords, PINs, or payment details/)).toBeTruthy();
  });

  it("shows accessible field errors and does not submit an invalid form", async () => {
    const action = vi.fn();
    const user = userEvent.setup();
    render(<RepairRequestForm requestKey={KEY} action={action} />);

    await user.click(screen.getByRole("button", { name: "Submit request" }));

    expect(action).not.toHaveBeenCalled();
    const brand = screen.getByLabelText(/^Brand/);
    expect(brand.getAttribute("aria-invalid")).toBe("true");
    const describedBy = brand.getAttribute("aria-describedby")!;
    expect(document.getElementById(describedBy)?.textContent).toMatch(/Enter the brand/);
    // The summary lists the problems and receives focus.
    const summary = screen.getByText(/Please fix the following/).closest("div")!;
    expect(within(summary).getAllByRole("link").length).toBeGreaterThanOrEqual(4);
    await waitFor(() => expect(document.activeElement).toBe(summary));
  });

  it("sends the entered values and the idempotency key, and nothing about ownership", async () => {
    const action = vi.fn(async (): Promise<RepairFormState> => ({ status: "success", id: "a".repeat(40) }));
    const user = userEvent.setup();
    render(<RepairRequestForm requestKey={KEY} action={action} />);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Submit request" }));

    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const [, formData] = action.mock.calls[0] as unknown as [RepairFormState, FormData];
    expect(Object.fromEntries(formData)).toMatchObject({
      requestKey: KEY,
      deviceType: "laptop",
      brand: "Lenovo",
      model: "ThinkPad T14",
      description: "It will not boot past the logo screen.",
    });
    expect([...formData.keys()].filter((k) => !k.startsWith("$ACTION")).sort()).toEqual([
      "brand",
      "description",
      "deviceType",
      "model",
      "requestKey",
    ]);
  });

  it("shows a clear confirmation with links after saving", async () => {
    const id = "b".repeat(40);
    const action = vi.fn(async (): Promise<RepairFormState> => ({ status: "success", id }));
    const user = userEvent.setup();
    render(<RepairRequestForm requestKey={KEY} action={action} />);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Submit request" }));

    const confirmation = await screen.findByRole("status");
    expect(confirmation.textContent).toMatch(/Request submitted/);
    expect(confirmation.textContent).toMatch(/Submitted/);
    expect(
      screen.getByRole("link", { name: "View this request" }).getAttribute("href"),
    ).toBe(`/customer/repairs/${id}`);
    expect(
      screen.getByRole("link", { name: "Back to My repairs" }).getAttribute("href"),
    ).toBe("/customer");
    expect(screen.queryByRole("button", { name: "Submit request" })).toBeNull();
  });

  it("keeps everything the customer typed when saving fails", async () => {
    const action = vi.fn(async (): Promise<RepairFormState> => ({
      status: "error",
      message: "We couldn’t save your request.",
      errors: {},
      values: {
        deviceType: "laptop",
        brand: "Lenovo",
        model: "ThinkPad T14",
        description: "It will not boot past the logo screen.",
      },
    }));
    const user = userEvent.setup();
    render(<RepairRequestForm requestKey={KEY} action={action} />);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Submit request" }));

    await screen.findByText("We couldn’t save your request.");
    await waitFor(() => {
      expect((screen.getByLabelText(/^Brand/) as HTMLInputElement).value).toBe("Lenovo");
    });
    expect((screen.getByLabelText(/^Model/) as HTMLInputElement).value).toBe("ThinkPad T14");
    expect((screen.getByLabelText(/What’s wrong/) as HTMLTextAreaElement).value).toBe(
      "It will not boot past the logo screen.",
    );
    expect((screen.getByLabelText("Laptop") as HTMLInputElement).checked).toBe(true);
    // The same form (same key) can be retried.
    expect(screen.getByRole("button", { name: "Submit request" })).toBeTruthy();
  });

  it("shows server-side field errors next to the fields", async () => {
    const action = vi.fn(async (): Promise<RepairFormState> => ({
      status: "error",
      errors: { model: "The model must be 80 characters or fewer." },
      values: { deviceType: "phone", brand: "Apple", model: "x", description: "long enough text here" },
    }));
    const user = userEvent.setup();
    render(<RepairRequestForm requestKey={KEY} action={action} />);
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Submit request" }));

    const model = await screen.findByLabelText(/^Model/);
    await waitFor(() => expect(model.getAttribute("aria-invalid")).toBe("true"));
    expect(document.getElementById(model.getAttribute("aria-describedby")!)?.textContent).toMatch(
      /80 characters/,
    );
  });

  it("shows a saving state and ignores repeated clicks while a save is in flight", async () => {
    let finish!: (state: RepairFormState) => void;
    const action = vi.fn(
      () => new Promise<RepairFormState>((resolve) => { finish = resolve; }),
    );
    const user = userEvent.setup();
    render(<RepairRequestForm requestKey={KEY} action={action} />);
    await fillValid(user);

    const button = screen.getByRole("button", { name: "Submit request" });
    await user.click(button);
    await waitFor(() => expect(screen.getByRole("button", { name: "Saving…" })).toBeTruthy());

    const saving = screen.getByRole("button", { name: "Saving…" }) as HTMLButtonElement;
    expect(saving.disabled).toBe(true);
    await user.click(saving);
    await user.click(saving);
    expect(action).toHaveBeenCalledTimes(1);

    finish({ status: "success", id: "c".repeat(40) });
    await screen.findByText("We’ve got it");
    expect(action).toHaveBeenCalledTimes(1);
  });
});