import type { Locator, Page } from "@playwright/test";
import type { RepairFormInput } from "../support/data";

/** The customer "request a repair" form at /customer/new. Interactions only; tests assert. */
export class RepairFormPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto("/customer/new");
  }

  async fill(input: RepairFormInput): Promise<void> {
    // The radios are visually hidden; their visible label is the click target.
    await this.page.getByRole("group", { name: /device type/i }).getByText(input.deviceType, { exact: true }).click();
    await this.page.getByLabel("Brand").fill(input.brand);
    await this.page.getByLabel("Model").fill(input.model);
    await this.page.getByLabel(/what.s wrong/i).fill(input.description);
  }

  async submit(): Promise<void> {
    await this.page.getByRole("button", { name: "Submit request" }).click();
  }

  get brand(): Locator {
    return this.page.getByLabel("Brand");
  }

  get model(): Locator {
    return this.page.getByLabel("Model");
  }

  get description(): Locator {
    return this.page.getByLabel(/what.s wrong/i);
  }

  /** The confirmation shown after a saved request. */
  get successNotice(): Locator {
    return this.page.getByRole("status").filter({ hasText: "Request submitted" });
  }

  get viewRequestLink(): Locator {
    return this.page.getByRole("link", { name: "View this request" });
  }
}
