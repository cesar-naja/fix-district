# Repair workflow: approved batch 1 (for review)

Main reference: `e2e/specs/repair-workflow-planner.md` ("the planner plan"). Requirement IDs (R4, R7, ...) and observation labels below are the planner plan's. `e2e/specs/repair-workflow.md` was not used.

Status: PLAN ONLY. No tests are generated. Four independent scenarios, each traceable to its source scenario ID.

| Batch ID | Source scenario ID(s) | Title | Priority | Layer | Source status |
| --- | --- | --- | --- | --- | --- |
| B1-01 | CUS-01 (+ persistence step of CUS-05) | Submit a valid repair, open details, reload, values persist | P0 | Browser E2E + emulator read | OBSERVED |
| B1-02 | CUS-02 | Submit an empty form: validation errors, nothing saved | P0 | Browser E2E + emulator read | OBSERVED |
| B1-03 | ISO-01 (+ list part of ISO-02) | Customer B cannot list or open Customer A's request; A still can | P0 | Browser E2E (two actors) + emulator read | UNVERIFIED (planner could not run two actors) |
| B1-04 | TECH-05 (+ detail checks from TECH-02) | Customer submits; technician sees the same request and details | P0 | Browser E2E (two actors) + emulator read | UNVERIFIED (planner could not run two actors) |

## Rules that apply to every scenario

- Import `test` and `expect` from `e2e/fixtures` only. Use the existing `RepairFormPage` (`e2e/pages/repair-form.page.ts`), `repairRow` and `LIST_NAME` (`e2e/pages/repair-list.ts`), `repairInput` (`e2e/support/data.ts`).
- Each test creates its own prerequisites. It does not rely on the exploration seeds (`seed.spec.ts`, `seed.customer.spec.ts`, `seed.technician.spec.ts`) or on any record they created. Actors come from the worker-scoped fixtures `customer`, `otherCustomer` and `technician`, which create disposable Clerk users. Records come from the UI or from the `seed` fixture, never from a shared leftover.
- Database assertions use `emulator.repairsOwnedBy(<this test's customer userId>)`, plus the test's own marker. Never use `emulator.totalRepairs()`, counts of the shared technician queue, or queue position.
- Do not assert HTTP status for 403/404 pages (PB-1: they are served as 200). Assert the rendered heading and text.
- No wall-clock windows. Server-assigned `createdAt` is asserted only as present and valid (a non-null ISO string from `repairsOwnedBy`), not as "within N seconds".
- No full-page HTML or full-text comparisons, and no incidental text counts (for example, the number of times "Submitted" appears). Assert specific elements, specific values and specific absences.
- An absence assertion is only valid after a positive signal that the page finished loading (for example the actor's own row or the 404 heading is visible). Otherwise it can pass while the page is still loading.
- Cleanup comes from the auto `testHygiene` fixture: it deletes records owned by every actor used, per owner. Do not add manual wipes. `customerPage`, `otherCustomerPage` and `technicianPage` register their user for cleanup. Records seeded through `seed` register their owner.
- Page-interaction facts from the planner plan (section 2): the device-type radios are visually hidden, so click the label text (`RepairFormPage.fill` already does this). Success and error headings are upper-cased by CSS, so assert by role/name, not `innerText`. The sign-in redirect is client-side, so use auto-retrying assertions.

---

## B1-01: Submit a valid repair, open its details, reload, verify the saved values persist

**Source:** CUS-01 steps 3 to 5, plus the reload step from CUS-05. Requirements: R4, R7, R9, R11.
**Priority:** P0. **Layer:** browser E2E, with an owner-scoped emulator read as the authoritative persistence check.

**Prerequisites (created by the test):**
- Disposable customer from the `customer` fixture, signed in through `customerPage`.
- No records. The test asserts the baseline instead of assuming it (step 1).

**Fixtures:** `customerPage`, `customer`, `emulator`, `marker`.

**Synthetic data:** `repairInput(marker, overrides)` with
- `deviceType: "Tablet"` (not the default, so a swapped or defaulted device type is detected),
- `brand: "Acme Tab"`,
- model `Model <marker>` (the default),
- description `Synthetic problem description for automated testing <marker>.` (the default).

Brand, model and description differ from each other, so swapped fields are detected.

**Steps and assertions:**
1. Read `emulator.repairsOwnedBy(customer.userId)` as `before`.
   - Assert `before` has length 0. This is the explicit baseline for this test's own user, not a global count.
2. `RepairFormPage.goto()`, `fill(data)`, `submit()` once.
   - Assert `successNotice` is visible (role `status`, "Request submitted").
   - Assert `viewRequestLink` has an `href` matching `/customer/repairs/<40 lowercase hex>`. Capture the id from it as `repairId`.
3. Click `viewRequestLink`.
   - Assert the URL is `/customer/repairs/<repairId>`.
   - Assert the detail page shows, scoped to the main region: Status = "Submitted", Device type = "Tablet", Brand = "Acme Tab", Model = `Model <marker>`, and the description equal to the submitted text (exact match on the description element, not `toContainText` on the whole main).
   - Assert a "Submitted" date fact is present and ends with "UTC". Do not assert its value.
4. Reload with `page.reload()`.
   - Assert the URL is still `/customer/repairs/<repairId>` and the same five values from step 3 are shown again. This catches state that exists only in client memory.
5. Read `emulator.repairsOwnedBy(customer.userId)` with `expect.poll`.
   - Assert exactly 1 document.
   - Assert its `id` equals `repairId`.
   - Assert `deviceType` is `"tablet"`, `brand` is `"Acme Tab"`, `model` is `Model <marker>`, `description` is the submitted text, `status` is `"submitted"`.
   - Assert `createdAt` is a non-null, parseable ISO string.

**Why the assertions detect failure:**
- A failed or silent save: the emulator document is missing and step 5 fails.
- Wrong or duplicated record: the exact-length-1 and `id === repairId` checks fail.
- Swapped fields, or a defaulted device type: the per-field checks fail, because the values are distinct and not the default.
- Data held only in memory: the reload in step 4 shows an error or empty page.
- Wrong status: both the page and the stored `status` fail.

**Not covered here:** the exact fact locators (see "Open items").

---

## B1-02: Submit an empty form, verify validation errors, and verify no record was saved

**Source:** CUS-02. Requirements: R5, R6.
**Priority:** P0. **Layer:** browser E2E, with an owner-scoped emulator comparison.

**Prerequisites (created by the test):**
- Disposable customer, signed in through `customerPage`.
- One existing request owned by this customer, created with the `seed` fixture (`seed({ ownerId: customer.userId })`). This makes the before/after comparison meaningful: a stray extra write is detected against a known non-empty state. It also replaces CUS-02's assumption that an earlier seed record exists.

**Fixtures:** `customerPage`, `customer`, `emulator`, `seed`, `marker`.

**Synthetic data:** the seeded request uses `repairInput(marker)`. The form is submitted with no input at all.

**Steps and assertions:**
1. Seed one request for the customer. Read `emulator.repairsOwnedBy(customer.userId)` as `before`.
   - Assert `before` has exactly 1 document, and that its id is the one `seed` returned.
2. `RepairFormPage.goto()`. Click "Submit request" with nothing filled.
   - Assert the URL is still `/customer/new`.
   - Assert the problem summary titled "Please fix the following before sending:" lists exactly these four entries, in this order, using an array `toHaveText` on the summary links:
     - "Device type: Choose the type of device."
     - "Brand: Enter the brand."
     - "Model: Enter the model."
     - "What’s wrong?: Describe the problem."
   - Assert each field shows its inline error: "Choose the type of device.", "Enter the brand.", "Enter the model.", "Describe the problem.".
   - Assert the Brand, Model and description textboxes are `aria-invalid`.
   - Assert `successNotice` is not visible. Assert the "View this request" link is absent.
3. Read `emulator.repairsOwnedBy(customer.userId)` as `after`.
   - Assert `after` deep-equals `before`: same length, same ids, same field values. A deep comparison of owner-scoped documents is used, not a count alone, so a replaced or edited document is also detected.
4. Navigate to `/customer` as a round trip, then re-read the emulator as `afterNavigation`.
   - Assert the seeded row is visible via `repairRow(customerPage, LIST_NAME.customer, marker)`. This is the positive "page finished loading" signal.
   - Assert `afterNavigation` deep-equals `before`. This catches a save that completes after step 3.

**Why the assertions detect failure:**
- Validation removed or bypassed: an empty record is saved, so `after` or `afterNavigation` differs from `before`, and no error summary shows.
- One message missing or wrong: the exact four-entry array assertion fails.
- Validation shown, but the data also written: the emulator comparison fails even though the UI looks right.

**Known limit:** the planner plan could not confirm whether a server POST is sent (CUS-02 step 2). This scenario does not assert on network requests. It asserts persisted state only. Server-side validation on its own stays at the integration layer (planner plan, G2).

---

## B1-03: Customer B cannot list or open Customer A's request, while A can still open it

**Source:** ISO-01 (direct URL), plus the list-isolation part of ISO-02. Requirements: R10, R11. Scoped to two customers. The technician half of ISO-03 is left out.
**Priority:** P0. **Layer:** browser E2E with two actors, and owner-scoped emulator reads.
**Source status:** UNVERIFIED. Two actors were not runnable in the planner session, so this is the first real run of this path.

**Prerequisites (created by the test):**
- Customer A (`customer` fixture, `customerPage`) and Customer B (`otherCustomer` fixture, `otherCustomerPage`), both disposable, with separate Clerk user ids.
- One request owned by A, with id `A_ID`, created through `seed({ ownerId: customer.userId, overrides })`. `seed` returns the id, so the test does not depend on the UI submit flow (that flow is covered by B1-01).
- One request owned by B, with id `B_ID`, created the same way. B needs its own request so that B's list renders real content, and so a missing owner filter produces a visible leak instead of an empty state.
- A well-formed id that does not exist, `MISSING_ID` = `0123456789abcdef0123456789abcdef01234567`, as the 404 reference. Do not assume any record exists there.

**Fixtures:** `customerPage`, `otherCustomerPage`, `customer`, `otherCustomer`, `emulator`, `seed`, `marker`.

**Synthetic data:**
- Token A = `${marker}-A`, token B = `${marker}-B`. Neither contains the other, so asserting on A's token cannot match B's row.
- A's request: Phone, brand "Brand A", model `Model <token A>`, description containing token A.
- B's request: Laptop, brand "Brand B", model `Model <token B>`, description containing token B.
- `repairRow` is called with the full token (not the bare `marker`), because the bare `marker` is a substring of both tokens.
- Seeds use 2 of the worker's budget of 8.

**Steps and assertions:**
1. Seed A's and B's requests. Read `emulator.repairsOwnedBy` for each owner as `docsA` and `docsB`.
   - Assert each owner has exactly one document, with the id returned by `seed`.
2. Customer B opens `/customer`.
   - Positive signal: assert B's row (token B) is visible in the list named "My repair requests, newest first".
   - Assert there is no row containing token A. Assert there is no link whose `href` is `/customer/repairs/<A_ID>`. Assert neither token A nor A's brand ("Brand A") appears in the list.
3. Customer B navigates to `/customer/repairs/<A_ID>`.
   - Assert the page shows the "Page not found" heading (the "Error 404" state).
   - Assert token A, "Brand A" and A's description are absent from the page body.
   - Do not assert the HTTP status (PB-1).
4. Customer B navigates to `/customer/repairs/<MISSING_ID>`.
   - Assert the same "Page not found" heading appears. This is the reference showing that "not yours" and "does not exist" look the same (R11). Compare only the heading and the absence of A's data. Do not compare full-page HTML or full text.
5. Control: Customer B opens their own `/customer/repairs/<B_ID>`.
   - Assert B's detail shows token B. This proves B is a working signed-in customer and that step 3's result is not caused by a broken B session.
6. Customer A opens `/customer/repairs/<A_ID>`.
   - Assert A's detail page shows model `Model <token A>`, brand "Brand A" and A's description. This proves the id was valid and that B's attempts did not remove access.
   - Assert A's `/customer` list shows the row for token A and no row for token B.
7. Read `emulator.repairsOwnedBy` for each owner again.
   - Assert A's documents deep-equal `docsA` and B's deep-equal `docsB`. Neither was changed or deleted by the other's access attempts.

**Why the assertions detect failure:**
- Missing ownership check on the detail page: step 3 shows A's data, and the "Page not found" and absence assertions fail.
- Missing owner filter on the list: step 2 shows A's token or A's link in B's list.
- A "not yours" response that differs from "does not exist" (for example a 403 that reveals the id exists): step 3's heading assertion fails against step 4's.
- B's session broken: steps 2 and 5 fail on B's own row, so a vacuous pass of the absence checks is not possible.
- A's access broken, or A's record altered: step 6 or step 7 fails.

**Risk:** because this path was never run by the planner, the first generation may find that a locator or a message differs from the plan. Treat that as new exploration data rather than a defect.

---

## B1-04: Submit as a customer, then verify a technician sees the same request and details

**Source:** TECH-05 (technician sees a request created through the UI by a customer), plus the detail assertions from TECH-02. Requirements: R9, R11, R12, R16.
**Priority:** P0. **Layer:** browser E2E with two actors, and an owner-scoped emulator read.
**Source status:** UNVERIFIED. The planner could not combine customer and technician in one session (G6).

**Prerequisites (created by the test):**
- A disposable customer (`customerPage`) and a disposable technician (`technicianPage`) from the fixtures.
- No existing record. The request under test is created by this test through the customer UI, so there is nothing to assume from a seed.

**Fixtures:** `customerPage`, `technicianPage`, `customer`, `emulator`, `marker`.

**Synthetic data:** `repairInput(marker, overrides)` with
- `deviceType: "Console"`,
- `brand: "Acme Console"`,
- model `Model <marker>` (the default),
- description `Synthetic problem description for automated testing <marker>.` (the default).

**Steps and assertions:**
1. As the customer, `RepairFormPage.goto()`, `fill(data)`, `submit()` once.
   - Assert `successNotice` is visible.
   - Capture `repairId` from the `href` of `viewRequestLink` (`/customer/repairs/<40 hex>`).
2. Read `emulator.repairsOwnedBy(customer.userId)` with `expect.poll`.
   - Assert exactly 1 document, with `id === repairId`, `deviceType` `"console"`, `brand` "Acme Console", model `Model <marker>`, `status` `"submitted"`.
3. As the technician, open `/technician`.
   - Assert `repairRow(technicianPage, LIST_NAME.technician, marker)` is visible. This is the marker-scoped check. Do not assert counts, order or position in the shared queue (R16).
   - Assert that row contains the device name "Acme Console Model <marker>", the device type "Console", and the "Submitted" badge, scoped to that row.
   - Assert the row's link `href` is `/technician/repairs/<repairId>`. This ties the technician's row to the exact record the customer created.
4. Click that row's link.
   - Assert the URL is `/technician/repairs/<repairId>`.
   - Assert the detail page shows: Status = "Submitted", Device type = "Console", Brand = "Acme Console", Model = `Model <marker>`, and the description equal to the submitted text (exact match on the description element).
   - Assert the read-only note "Read-only for now. Status changes, estimates, and assignment are not available yet." is shown.
   - Assert there is no form, input, textarea, select or button inside the main region of the page. A "Back to repair queue" link is allowed.
   - Assert the page content contains neither `customer.userId` nor `customer.email`. This is a specific-identifier absence check, not a full-HTML comparison.
5. Customer cross-check: the customer opens `/customer/repairs/<repairId>`.
   - Assert the same five values as in step 4. This proves both roles see the same stored record.

**Why the assertions detect failure:**
- Queue reads the wrong store, or filters by owner: the marker row in step 3 is missing.
- Wrong record exposed: the `href` equals `repairId` only for the customer's own record.
- Stale or mismatched fields (for example brand and model swapped in the technician DTO): step 4's per-field exact checks fail.
- Owner data leaks through the DTO: the userId/email absence check fails.
- Editable controls appear for technicians: the no-controls check fails.
- The customer's submission was not stored: step 2 fails first, with a clearer cause than the technician's missing row.

**Risks:**
- The technician queue shows the newest 50 requests across all users. The marker-scoped row could be pushed out if other tests add many records at once. The suite's guard caps seeded rows per worker and the setup gate refuses a polluted emulator (planner plan, R16), so this is low but not zero. If it fails with the row missing and a full queue, investigate that before suspecting the app.
- The technician page is read at request time and never cached (R14), so no reload should be needed. If the row only appears after a reload, report it as a possible caching bug and do not add a retry reload to the test.

---

## Open items for review (answer before generation)

1. **Fact locators.** The planner plan describes the detail page as a "fact list" (Status, Device type, Brand, Model, Submitted, description) but gives no locator. Generation should read the page's accessible structure (term/definition pairs or similar) and scope every value check to its own labelled fact. Confirm that is acceptable, or point to a preferred helper.
2. **404 reference in B1-03 step 4.** Assert the heading "Page not found" and absence of A's data only. Confirm that is enough, without a text comparison of the two 404 pages.
3. **Unverified paths.** B1-03 and B1-04 are the first runs of two-actor flows. Confirm that a first-run locator or wording mismatch should be reported and fixed in the test, not treated as a bug.
4. **Planner discrepancies carried forward.** PB-1 (403/404 served as 200) is left out of every assertion. PB-2 to PB-6 are not exercised by this batch.

## Traceability to the planner plan

| Batch ID | Planner section | What was kept | What was changed, and why |
| --- | --- | --- | --- |
| B1-01 | CUS-01 steps 3 to 5; CUS-05 step 4 | Submit, open details, field values, stored document | Added reload. Device type changed from the default to Tablet to detect defaulting. Dropped the "createdAt within the last minute" check (arbitrary window). Dropped the "Ref" prefix and requestKey checks (out of scope). Baseline asserted as 0 for this user instead of assuming a seed record |
| B1-02 | CUS-02 | Exact four errors, nothing saved | Prerequisite record is created by the test, not assumed from a seed. UI row count replaced by an owner-scoped before/after document comparison. Second read after a round trip added to catch late writes. Dropped the unverified "no POST" assertion |
| B1-03 | ISO-01, ISO-02 | B cannot open A's id, A can; B's list excludes A | Records are created by `seed`, not the UI, so the test is independent of the submit flow. Full-page text identity of the two 404s replaced by heading plus absence checks. Added B's own request and B's own detail as controls against a vacuous pass. Added the emulator no-change check |
| B1-04 | TECH-05, TECH-02 | Technician row, detail, read-only, no owner leak | Row `href` must equal the id of the customer's own record. Added emulator and customer cross-checks. No counts or ordering on the shared queue |
