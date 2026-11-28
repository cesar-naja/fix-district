// story: FD-1 "Let technicians mark a repair as In Review"
// covers: the Submitted → In Review transition (AC1–AC3, AC5) and the server-side
// permission check for customer accounts and signed-out visitors (AC4).
//
// The test creates its own prerequisites: two requests for one disposable customer,
// written through the `seed` fixture, and a disposable technician. The technician
// queue is shared, so only this test's markers are asserted, never counts or order.

import type { APIRequestContext, Locator, Page, Request } from "@playwright/test";
import { test, expect } from "../../fixtures";
import { LIST_NAME, repairRow } from "../../pages/repair-list";
import { repairInput } from "../../support/data";

/** The <dd> of a labelled fact (<dt>label</dt><dd>value</dd>) on the request detail page. */
function fact(page: Page, label: string): Locator {
  return page
    .getByRole("main")
    .locator("dt", { hasText: new RegExp(`^${label}$`) })
    .locator("xpath=following-sibling::dd");
}

function startReviewButton(page: Page): Locator {
  return page.getByRole("main").getByRole("button", { name: "Start review" });
}

/** The parts of a captured Server Action request needed to send it again. */
type CapturedAction = { url: string; headers: Record<string, string>; body: string };

async function capture(request: Request): Promise<CapturedAction> {
  const all = await request.allHeaders();
  const headers: Record<string, string> = {};
  for (const name of ["next-action", "content-type", "accept", "origin"]) {
    if (all[name]) headers[name] = all[name];
  }
  return { url: request.url(), headers, body: request.postData() ?? "" };
}

/** Sends the captured action again, aimed at another request ID, with the caller's own session. */
async function replay(
  api: APIRequestContext,
  action: CapturedAction,
  fromId: string,
  toId: string,
): Promise<void> {
  expect(action.body, "the captured action carries the request ID").toContain(fromId);
  await api.post(action.url, {
    headers: action.headers,
    data: action.body.split(fromId).join(toId),
    maxRedirects: 0,
    failOnStatusCode: false,
  });
}

test.describe("Technician starts a review", { tag: "@repair" }, () => {
  test("A technician moves a Submitted request to In Review; customers and signed-out visitors cannot", async ({
    page: signedOutPage,
    customerPage,
    technicianPage,
    customer,
    emulator,
    seed,
    marker,
  }) => {
    const tokenTarget = `${marker}-T`;
    const tokenOther = `${marker}-O`;
    let targetId = "";
    let otherId = "";
    let action: CapturedAction | null = null;

    const statusOf = async (id: string) =>
      (await emulator.repairsOwnedBy(customer.userId)).find((doc) => doc.id === id)?.status;

    await test.step("1. Seed two Submitted requests for the customer", async () => {
      targetId = await seed({
        ownerId: customer.userId,
        overrides: repairInput(tokenTarget, { brand: "Review Target" }),
      });
      otherId = await seed({
        ownerId: customer.userId,
        overrides: repairInput(tokenOther, { brand: "Review Other" }),
      });
      expect(await statusOf(targetId)).toBe("submitted");
      expect(await statusOf(otherId)).toBe("submitted");
    });

    await test.step("2. The customer's detail page has no Start review button", async () => {
      await customerPage.goto(`/customer/repairs/${targetId}`);
      await expect(fact(customerPage, "Status")).toHaveText("Submitted");
      await expect(startReviewButton(customerPage)).toHaveCount(0);
    });

    await test.step("3. As the technician, select Start review; the page shows In Review", async () => {
      await technicianPage.goto(`/technician/repairs/${targetId}`);
      await expect(fact(technicianPage, "Status")).toHaveText("Submitted");
      await expect(startReviewButton(technicianPage)).toBeVisible();

      const sent = technicianPage.waitForRequest(
        (request) => request.method() === "POST" && "next-action" in request.headers(),
      );
      await startReviewButton(technicianPage).click();
      action = await capture(await sent);

      await expect(fact(technicianPage, "Status")).toHaveText("In Review");
      await expect(startReviewButton(technicianPage)).toHaveCount(0);
      await expect(technicianPage.getByRole("alert")).toHaveCount(0);
      await expect.poll(() => statusOf(targetId)).toBe("in_review");
    });

    await test.step("4. After a refresh and in the queue, the technician still sees In Review", async () => {
      await technicianPage.reload();
      await expect(fact(technicianPage, "Status")).toHaveText("In Review");
      await expect(startReviewButton(technicianPage)).toHaveCount(0);

      await technicianPage.goto("/technician");
      const row = repairRow(technicianPage, LIST_NAME.technician, tokenTarget);
      await expect(row).toBeVisible();
      await expect(row.getByText("In Review", { exact: true })).toBeVisible();
      const otherRow = repairRow(technicianPage, LIST_NAME.technician, tokenOther);
      await expect(otherRow.getByText("Submitted", { exact: true })).toBeVisible();
    });

    await test.step("5. The customer sees In Review; their other request is still Submitted", async () => {
      await customerPage.reload();
      await expect(fact(customerPage, "Status")).toHaveText("In Review");
      await expect(startReviewButton(customerPage)).toHaveCount(0);

      await customerPage.goto("/customer");
      const row = repairRow(customerPage, LIST_NAME.customer, tokenTarget);
      await expect(row.getByText("In Review", { exact: true })).toBeVisible();
      const otherRow = repairRow(customerPage, LIST_NAME.customer, tokenOther);
      await expect(otherRow.getByText("Submitted", { exact: true })).toBeVisible();
      expect(await statusOf(otherId)).toBe("submitted");
    });

    await test.step("6. The server rejects the same action from the customer and from a signed-out visitor", async () => {
      expect(action).not.toBeNull();
      // Load a page first so the browser-side session cookie is fresh.
      await customerPage.goto(`/customer/repairs/${otherId}`);
      await expect(fact(customerPage, "Status")).toHaveText("Submitted");
      await replay(customerPage.request, action!, targetId, otherId);

      await signedOutPage.goto("/");
      await replay(signedOutPage.request, action!, targetId, otherId);

      expect(await statusOf(otherId)).toBe("submitted");
      await customerPage.reload();
      await expect(fact(customerPage, "Status")).toHaveText("Submitted");
    });

    await test.step("7. Control: the same replay from the technician does change the status", async () => {
      // Proves the replay in step 6 was a real, well-formed action call.
      await technicianPage.goto(`/technician/repairs/${otherId}`);
      await expect(fact(technicianPage, "Status")).toHaveText("Submitted");
      await replay(technicianPage.request, action!, targetId, otherId);
      await expect.poll(() => statusOf(otherId)).toBe("in_review");
      // Repeating the action leaves it In Review.
      await replay(technicianPage.request, action!, targetId, otherId);
      expect(await statusOf(otherId)).toBe("in_review");
      expect(await statusOf(targetId)).toBe("in_review");
    });
  });
});
