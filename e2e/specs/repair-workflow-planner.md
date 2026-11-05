# Fix District repair workflow: independent browser test plan (planner)

## Application Overview

# 1. Overview

Scope: the implemented repair workflow of Fix District (Next.js 16.4.3, Clerk auth, Firestore via Firebase Admin on the E2E emulator). Customers submit a repair request at /customer/new, see their own requests at /customer and /customer/repairs/[id]; technicians see every request at /technician and /technician/repairs/[id] (read-only). Status is always "Submitted" in this milestone.

This plan is INDEPENDENT. It was produced from live exploration through the playwright-test MCP server plus the repository docs/code listed in section 3. It does not use e2e/specs/repair-workflow.md. PLAN ONLY: no tests were generated and no application code was changed.

Every statement is labelled:
- OBSERVED = actually seen in the browser during this exploration (seed session named).
- REQUIREMENT = documented expected behaviour, with its source file.
- UNVERIFIED = assumption or behaviour not seen in the browser (reason given).
- POSSIBLE BUG = observed behaviour that conflicts with a documented requirement.

Priorities: P0 = security/data-integrity/core flow, P1 = important validation/UX/resilience, P2 = polish/edge. Testing layers: browser E2E, integration (Vitest + emulator 8085, tests/integration), unit, rules-emulator.

# 2. Environment & seeds

- App server: http://localhost:3100 (started by the MCP server, .next-e2e, never port 3000). Firestore emulator for E2E on 8086, project demo-fix-district-e2e (already running; not touched). Clerk: dedicated development app, disposable users only. Source: e2e/docs/framework.md, e2e/README.md.
- Seeds used (project chromium): e2e/seed.spec.ts (signed-out, creates nothing), e2e/seed.customer.spec.ts (disposable customer + 1 emulator request; default page signed in), e2e/seed.technician.spec.ts (disposable technician + 1 queued request owned by a synthetic owner). Only one seed session is alive at a time; the second customer fixture (otherCustomer) and customerPage/otherCustomerPage/technicianPage exist only in test fixtures (e2e/fixtures/index.ts), NOT in the seeds, so two-actor scenarios cannot be explored through the planner and are UNVERIFIED here.
- Sessions in this exploration: signed-out x1 (plus a final signed-out call to tear down), customer x1, technician x1. planner_setup_page call counts: e2e/seed.spec.ts = 2, e2e/seed.customer.spec.ts = 1, e2e/seed.technician.spec.ts = 1.
- Tooling limits OBSERVED: browser_route, browser_network_state_set and browser_reload were listed by tool discovery but returned "Tool not found" when called. Network faults were therefore simulated only by an in-page window.fetch stub (page JavaScript, not a network-level fault). browser_run_code_unsafe exists but was deliberately NOT used (RCE-equivalent).
- Facts for test authors (OBSERVED): (a) the device-type radios are visually hidden (class sr-only); getByRole('radio').check()/fill timed out after 15 s because the wrapping <label> intercepts pointer events; click the label text (getByText('Phone', {exact:true})) instead. (b) Success and error headings are upper-cased by CSS, so innerText is upper case while the accessible/DOM text is mixed case; assert on role/name or textContent, not innerText. (c) /dashboard redirect for a signed-in user happens client-side after streaming (navigation redirectCount 0), so assert with an auto-retrying toHaveURL, not an immediate URL check. (d) Document navigations for 403/404 pages return HTTP 200 (see POSSIBLE BUG PB-1). (e) A well-formed test ID is 40 lowercase hex characters.

# 3. Requirements traceability (sources; none from e2e/specs/repair-workflow.md)

| Req | Requirement | Source |
| --- | --- | --- |
| R1 | Signed-out visitors to /dashboard, /customer, /technician (and sub-paths) are redirected to sign-in before anything renders. | README.md (Roles and access, layer 1); proxy.ts |
| R2 | A signed-in user requesting the other role's route gets a 403 page; customers get a 403 on technician routes and technicians are refused customer-only operations. | README.md (Roles and access; How data flows); lib/auth/access.ts requireRole; app/forbidden.tsx |
| R3 | Role is read server-side from Clerk private metadata; default role is customer; /dashboard sends each user to /customer or /technician. | README.md; lib/auth/access.ts |
| R4 | Request fields: deviceType in {phone, laptop, tablet, console}; brand 1-60; model 1-80; description 10-1000 characters; control characters stripped; single-line fields whitespace-collapsed and trimmed; description keeps newlines. | lib/repairs/schema.ts (LIMITS, clean) |
| R5 | Exact validation messages: "Choose the type of device.", "Enter the brand.", "Enter the model.", "Describe the problem.", "Add a little more detail (at least 10 characters).", "The brand must be 60 characters or fewer.", "The model must be 80 characters or fewer.", "The description must be 1000 characters or fewer." | lib/repairs/schema.ts |
| R6 | The form validates in the browser for hints and the server repeats the check (server result is the trusted one); invalid submissions save nothing; entered values are kept after an error; focus moves to the problem summary. | lib/repairs/schema.ts header; components/repairs/repair-request-form.tsx; app/customer/new/actions.ts; tests/integration/action.test.ts |
| R7 | Owner, status ("submitted") and createdAt are assigned on the server; forged ownerId/status/createdAt/role fields are never read. | README.md (How data flows); app/customer/new/actions.ts; lib/repairs/store.ts; tests/integration/action.test.ts |
| R8 | Duplicate prevention: each rendered form carries a server-generated UUID key; document id = hash(userId:key); double click/retry/resubmit saves once. A missing or malformed key returns "This form has expired. Reload the page and try again." and saves nothing. | README.md (Duplicates); lib/repairs/store.ts repairIdFor/createForCustomer; app/customer/new/actions.ts; lib/repairs/schema.ts isValidRequestKey |
| R9 | After success the form is replaced by "Request submitted / We’ve got it / Your repair request was saved with the status Submitted. Our technicians can see it now." with links "View this request" and "Back to My repairs"; /customer is revalidated. | components/repairs/repair-request-form.tsx; app/customer/new/actions.ts |
| R10 | Customers see only their own requests, newest first, status Submitted, at most 50 (LIST_LIMIT) with a "Showing the 50 most recent requests." note when more exist. | README.md; lib/repairs/store.ts listForCustomer; components/repairs/repair-list.tsx |
| R11 | A request that belongs to someone else returns the same 404 as one that does not exist; invalid-format ids are 404; the owner id is never sent to the UI (DTO has no ownerId). | README.md; lib/repairs/store.ts getForCustomer/toSummary; lib/repairs/types.ts; app/customer/repairs/[id]/page.tsx |
| R12 | Technicians list the queue (all owners, newest first, max 50) and open any request; read-only ("Read-only for now. Status changes, estimates, and assignment are not available yet."). | README.md; lib/repairs/store.ts listQueue/getForTechnician; app/technician/page.tsx; app/technician/repairs/[id]/page.tsx |
| R13 | A failed database read shows an error state, never an empty list: "Couldn’t load your repairs" / "Couldn’t load the repair queue" / "Couldn’t load this request" with a retry affordance; a failed save shows "We couldn’t save your request. Your answers are still here, so you can try again in a moment." and keeps the values. | README.md (Failures); app/customer/page.tsx; app/technician/page.tsx; app/customer/new/actions.ts |
| R14 | Repair data is never cached; all reads at request time inside Suspense. | README.md (Caching); lib/repairs/server.ts |
| R15 | Firestore client rules deny all reads/writes to repairRequests; Admin bypasses rules so application checks are the real control. | firestore.rules; README.md (Security rules do not protect server code) |
| R16 | Test isolation: owner-scoped cleanup only, technician queue shows newest 50 across all users, tests find rows by unique marker not by position/count. | e2e/docs/framework.md sections 7 and 12 |

Existing Vitest suites (tests/integration/action.test.ts, store.test.ts, server.test.ts, rules.test.ts; tests/unit/*) were NOT all read; only action.test.ts was read. README.md claims they cover validation, role/ownership, duplicates (sequential and concurrent), persistence, 50-bound, DB-failure error states and deny-by-default rules. This plan assumes those exist and marks overlap as integration-layer scenarios.

# 4. Possible bugs / discrepancies

- PB-1 (POSSIBLE BUG, P1, requirement conflict): 403 and 404 pages are served with HTTP status 200. OBSERVED (customer seed): customer opening /technician rendered "Error 403 / Access denied / Your account does not have access to that page." but navigation responseStatus was 200; nonexistent /customer/repairs/<well-formed id> rendered "Error 404 / Page not found" with responseStatus 200 and <meta name=robots content=noindex>; technician seed: /customer/new rendered the 403 page with 200 and nonexistent technician id rendered the 404 page with 200. REQUIREMENT R2/R11 (README) says "403 page"/"403 on technician routes"/"plain 404" which can be read as the HTTP status. Likely cause (UNVERIFIED but supported by node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/forbidden.md and not-found.md): once streaming starts, the status stays 200 and only the UI changes; these pages call requireRole()/notFound() inside <Suspense>. Impact: search/monitoring/clients relying on status codes see success. Tests must assert the rendered text ("Error 403", "Access denied"), and a decision is needed on whether real 403/404 statuses are required.
- PB-2 (POSSIBLE UX GAP, P1): a network-level failure during submit crashes the whole page to Next's generic error screen ("This page couldn’t load / Reload to try again, or go back. / Reload / Back") and the typed answers are lost. OBSERVED (customer seed) by stubbing window.fetch to reject POSTs and clicking Submit with a valid form; the form disappeared, nothing was saved (list count unchanged afterwards). REQUIREMENT R13 only promises "Your answers are still here" for a failed SAVE reported by the server, so this is a gap rather than a proven violation. Caveat: simulated in the page, not at network level.
- PB-3 (POSSIBLE BUG, P2, layout): long unbroken brand/model values at the maximum length (60 x "B", 80 x "M", no spaces) make the whole page scroll horizontally. OBSERVED at a 1265 px wide viewport: /customer documentElement scrollWidth 1698 > clientWidth 1265; /customer/repairs/[id] scrollWidth 2118 > 1265. The 1000-character unbroken description did NOT overflow (break-words applied). No documented requirement; UNVERIFIED expectation that the layout should not overflow.
- PB-4 (NOTE, not a defect): the request detail 404 page keeps the page title "Repair request | Fix District" (same as an existing request). It is consistent with R11 (existing-but-not-yours and nonexistent look the same) but could not be compared against a real other-customer id (UNVERIFIED).
- PB-5 (documentation inconsistency, P2): e2e/docs/framework.md section 13 says "The planner has not been run" while section 10 says planner_setup_page and planner_save_plan were run. Stale text only.
- PB-6 (design risk, UNVERIFIED, P1): lib/repairs/store.ts toSummary() throws RepairDataError for any malformed stored document, and lib/repairs/server.ts turns that into a whole-list error state; one bad document therefore hides every request in a customer's list or in the whole technician queue. Not exercised (needs data the UI cannot create). Plan as integration scenario DBF-I6.

# 5. Database-failure scenarios: browser vs integration

| ID | Failure | Layer | Status | Expected (REQUIREMENT R13) |
| --- | --- | --- | --- | --- |
| DBF-B1 | Submit POST fails at the network (in-page fetch stub) | Browser E2E | EXPLORED (observed PB-2) | Today: generic error page, answers lost, nothing saved. Desired per R13 spirit: message + answers kept (UNVERIFIED requirement) |
| DBF-B2 | Server Action POST mocked as HTTP 500 via page.route (generated test only; browser_route was not callable) | Browser E2E | PLANNED, unexplored | Same assertions as DBF-B1; no record saved; retry with the same form key after unroute saves exactly 1 record |
| DBF-B3 | Browser offline during submit (context.setOffline) | Browser E2E | PLANNED, unexplored (browser_network_state_set not callable) | No record; after going online and retrying, exactly 1 record |
| DBF-I1 | Firestore write fails (unavailable / permission denied code 7 / deadline exceeded) during createForCustomer | Integration (tests/integration/server.test.ts style, stub the Firestore instance) | PLANNED, unexplored | saveRepairRequest returns {ok:false, reason:"unavailable"}; action returns the "We couldn’t save your request..." message with values preserved; no document |
| DBF-I2 | Firestore read fails on listForCustomer (including missing composite index, gRPC code 9) | Integration | PLANNED, unexplored | /customer shows "Couldn’t load your repairs" with the "does not mean you have no repairs" text and a "Try again" link, never "No repairs yet" |
| DBF-I3 | Firestore read fails on listQueue | Integration | PLANNED, unexplored | /technician shows "Couldn’t load the queue" (never "Queue is empty") |
| DBF-I4 | Firestore read fails on getForCustomer / getForTechnician | Integration | PLANNED, unexplored | "Couldn’t load this request" with "Try again", not a 404 |
| DBF-I5 | Firebase config/credential error (FirebaseConfigError) | Integration (unit on lib/firebase/admin.ts) | PLANNED, unexplored | Named fixed message in server log only; UI shows the same error states; no secret in logs (logFailure prints type/code only) |
| DBF-I6 | One malformed stored document (missing createdAt type, bad status) | Integration | PLANNED, unexplored (PB-6) | Define intended behaviour (whole-list error vs skip the bad row) and assert it |
| DBF-I7 | Client-SDK access to repairRequests | Rules-emulator (tests/integration/rules.test.ts) | PLANNED (exists per README), unexplored here | Unauthenticated and authenticated web-SDK read/write denied |
| DBF-I8 | Emulator stopped/unreachable | NOT DONE by design | Forbidden for this exploration | Do not stop the emulator; cover via DBF-I1..I4 with stubs |

# 6. Exploration gaps / unverified assumptions

- G1: Customer-to-customer isolation could not be explored in the browser (no second disposable customer in any seed). Only the fake/nonexistent-id 404 behaviour was observed. Scenarios ISO-01..ISO-03 are UNVERIFIED and need the otherCustomerPage fixture.
- G2: Server-side validation was not exercised independently of the client check (the browser form validates first and blocks the submit). Covered by tests/integration/action.test.ts (read) but not seen in a browser; a generated test would need to bypass the client handler (not possible with plain Playwright form submit without removing onSubmit) so keep it at integration layer.
- G3: "Form expired" message (missing/malformed requestKey) not exercised in the browser. Feasible in browser by deleting the hidden requestKey input and submitting; planned as CUS-13.
- G4: Empty customer state ("No repairs yet") and empty technician queue ("Queue is empty") were not observed: both seeds always create a request and the queue is shared. Framework docs keep empty/50-row behaviour in Vitest.
- G5: The 50-item bound and the "Showing the 50 most recent requests." note were not exercised (needs 51 documents; framework caps seeded rows at 8 per worker).
- G6: Technician seeing a request created through the UI by a real customer was not observed (seeds are sequential; the customer's data was deleted before the technician seed started). TECH-05/ISO-03 UNVERIFIED.
- G7: Raw redirect HTTP status for signed-out requests (307 vs 302) was not observable (fetch redirect:manual gives an opaque redirect; browser_network_requests did not list document statuses). Final landing URL was OBSERVED.
- G8: Rendered 404 for malformed ids ("not-a-valid-id", upper-case hex, %00) was not confirmed by rendering: only raw HTML was fetched, and the raw payload contains both the 403 and 404 boundary strings, so those probes are inconclusive (only the absence of other-user data was reliable). Planned as CUS-09 steps.
- G9: Server-action POST by a signed-out or wrong-role caller (direct HTTP) not exercised; covered by tests/integration/action.test.ts per the code read.
- G10: Mobile viewport, keyboard-only and screen-reader checks were not explored beyond: success panel receives focus (role=status), problem summary receives focus (OBSERVED).
- G11: Network-level fault tools (browser_route, browser_network_state_set) were not callable; see DBF-B2/B3.

# 7. Test data isolation & cleanup notes

- Disposable Clerk users: one customer (seed.customer) and one technician (seed.technician), created by fixtures, deleted by fixture teardown (e2e/docs/framework.md section 6).
- Records created by this exploration (all synthetic, owner-scoped to the disposable customer): 5 UI-created requests (markers: "Planner Brand PLN-R2 ...", a max-length Console request with 60 x B brand, "PLN-R4-back", "PLN-R5-spa", "PLN-R6-forged") plus the seed's own request (marker a11638-w5-...). Technician seed created 1 queued request (marker a11638-w7-...) owned by a synthetic owner. The simulated-network-failure submit and every validation failure saved nothing.
- Cleanup is owner-scoped and runs when the seed session ends. Evidence recorded: after switching from the customer seed to the technician seed, the technician queue (which lists all owners) contained exactly one request (the technician seed's own) and none of the six customer-owned records, so the customer teardown removed them. No explicit teardown line is printed by planner_setup_page; the technician teardown was triggered by the final signed-out planner_setup_page, whose setup gate ("emulator is reachable and clean" and the queue canary) passed. A direct read of the emulator was not possible with the available tools after teardown, so removal of the technician seed's record is inferred, not proven.
- Generated tests must: import test/expect from e2e/fixtures; find rows by a unique marker; never assert global counts/order on the shared technician queue (use owner-scoped /customer lists for counts); seed preconditions through the emulator helper; clean up with the testHygiene fixture (owner-scoped only); never wipe the emulator.
- Exploration artifacts (snapshots/console logs) were written to .playwright-mcp/ in the repository root (git-ignored; e2e/docs/framework.md says delete when done). They may contain Clerk dev URLs; treat as private.

## Test Scenarios

### 1. A. Signed-out access restrictions

**Seed:** `e2e/seed.spec.ts`

#### 1.1. AUTH-01 [P0, browser E2E, OBSERVED] Signed-out visitors are redirected to sign-in from every protected route and see no repair data

**File:** `e2e/repair/auth-signed-out.spec.ts`

**Steps:**
  1. META. Preconditions: fresh signed-out browser context (seed.spec.ts), no data needed. Test data: none. Requirement: R1 (README.md, proxy.ts). Status: OBSERVED in signed-out seed session. Layer: browser E2E.
  2. For each path in [/dashboard, /customer, /customer/new, /customer/repairs/0123456789abcdef0123456789abcdef01234567, /technician, /technician/repairs/0123456789abcdef0123456789abcdef01234567, /technician/repairs/not-a-valid-id] call page.goto(path).
    - expect: Final URL path is /sign-in and the query contains redirect_url equal to the URL-encoded original http://localhost:3100<path> (OBSERVED for all 7).
    - expect: The page text contains none of "Repair queue", "My repairs", "Problem description", "Request a repair" and no seeded marker text (OBSERVED: no repair words in any response).
    - expect: No 403/404 error page is shown (signed-out is redirect, not 403).
  3. Request /customer once with redirect:'manual' via page.request or fetch.
    - expect: Response is a redirect (OBSERVED as an opaque redirect); UNVERIFIED exact code (307/302): if the assertion matters, use page.request.get(url, {maxRedirects: 0}) and assert status is 3xx and the Location header starts with /sign-in.
  4. HOW THIS FAILS: if proxy.ts stops protecting a path, the URL stays on the protected path (or renders a page/403 body) and the toHaveURL(/sign-in\?redirect_url=/) assertion fails; if a page renders repair data to signed-out users the text-absence assertions fail. Assertions on specific redirect_url value catch a wrong destination.

### 2. B. Customer: submission, validation, persistence, lists, details

**Seed:** `e2e/seed.customer.spec.ts`

#### 2.1. CUS-01 [P0, browser E2E, OBSERVED] Customer submits a valid request and it is persisted with server-assigned fields

**File:** `e2e/repair/customer-submit-happy.spec.ts`

**Steps:**
  1. META. Preconditions: signed-in disposable customer (customerTest), one seeded request present. Test data: unique marker M; deviceType Phone, brand "E2E Brand", model "Model <M>", description "Synthetic problem description for automated testing <M>.". Requirements: R4, R7, R8, R9, R10. Layer: browser E2E (+ emulator read via support/emulator.ts repairsOwnedBy for the stored document).
  2. Open /customer/new. Read the hidden input named requestKey.
    - expect: Heading "Request a repair"; fieldset "Device type Required" with radios Phone/Laptop/Tablet/Console; textboxes "Brand Required", "Model Required", "What’s wrong? Required"; hint "10 to 1,000 characters"; buttons/links "Submit request" and "Cancel" (-> /customer). All OBSERVED.
    - expect: requestKey is a UUID (OBSERVED, regex 8-4-4-4-12 hex) and a reload gives a different one (OBSERVED).
  3. Click the label text "Phone" (not the sr-only radio), fill Brand, Model and the description with the test data, click "Submit request" once.
    - expect: Form is replaced by a role=status panel with "Request submitted", "We’ve got it" and "Your repair request was saved with the status Submitted. Our technicians can see it now." (OBSERVED).
    - expect: Links: "View this request" -> /customer/repairs/<40 hex> and "Back to My repairs" -> /customer (OBSERVED).
    - expect: Focus is on the status panel (OBSERVED document.activeElement role=status).
  4. Click "View this request".
    - expect: URL /customer/repairs/<id> with title "Repair request | Fix District".
    - expect: Fact list shows Status = Submitted, Device type = Phone, Brand = E2E Brand, Model = Model <M>, a Submitted date in UTC format like "Nov 5, 2026, 2:49 AM UTC" (OBSERVED), and the description text equals the entered text exactly.
    - expect: Page eyebrow shows "Ref " + first 8 chars of the id upper-cased (OBSERVED).
  5. Read the stored emulator document for this customer via the emulator helper.
    - expect: Exactly one document with ownerId = this customer's Clerk id, status "submitted", deviceType "phone", brand/model/description equal to the sanitised input, createdAt a server timestamp within the last minute (R7).
  6. HOW THIS FAILS: if saving silently fails the success panel or the emulator document is missing; if status/owner assignment is wrong the Status fact or ownerId assertion fails; asserting the exact stored brand/model/description (not just that a row exists) catches field mix-ups such as brand and model swapped.

#### 2.2. CUS-02 [P0, browser E2E, OBSERVED] Submitting an empty form shows all four required errors and saves nothing

**File:** `e2e/repair/customer-validation-required.spec.ts`

**Steps:**
  1. META. Preconditions: signed-in customer on /customer/new, count N of rows in "My repair requests, newest first" recorded from /customer (seed gives N>=1). Test data: none. Requirements: R5, R6. Layer: browser E2E.
  2. Click "Submit request" with nothing filled.
    - expect: URL stays /customer/new; no network POST to the server action (client check blocks it) (UNVERIFIED POST absence; assert saved-count instead).
    - expect: A summary titled "Please fix the following before sending:" lists exactly four links: "Device type: Choose the type of device.", "Brand: Enter the brand.", "Model: Enter the model.", "What’s wrong?: Describe the problem." (all OBSERVED).
    - expect: Under each field an inline message prefixed "Error": "Choose the type of device.", "Enter the brand.", "Enter the model.", "Describe the problem."; Brand, Model and description textboxes are aria-invalid (OBSERVED [invalid]).
    - expect: Focus moved to the summary (OBSERVED, activeElement aria-labelledby=repair-form-problem).
  3. Navigate to /customer.
    - expect: Row count is still N (nothing saved).
  4. HOW THIS FAILS: if validation were removed an empty record would be saved (count N+1) and no summary would show; if one error message were missing the exact four-link assertion fails.

#### 2.3. CUS-03 [P1, browser E2E, OBSERVED client-side] Field boundary and invalid values per field

**File:** `e2e/repair/customer-validation-boundaries.spec.ts`

**Steps:**
  1. META. Preconditions: signed-in customer on /customer/new; record N from /customer. Test data: description of 9 and 10 characters; description 1000 and 1001 characters; brand 60/61 characters; model 80/81 characters; brand of only spaces; no device type. Requirements: R4, R5. Layer: browser E2E for client check; integration for the server check (G2).
  2. Choose Phone, brand "     " (5 spaces), model "Planner Model A", description "123456789" (9 chars), submit.
    - expect: Summary lists exactly "Brand: Enter the brand." and "What’s wrong?: Add a little more detail (at least 10 characters)." (OBSERVED); no Device type or Model error; entered model value and checked Phone are kept (OBSERVED).
  3. Set values past the maxlength attribute by programmatic assignment (maxlength is 60/80/1000 OBSERVED): brand 61 x "B", model 81 x "M", description 1001 x "D", submit.
    - expect: Summary lists "Brand: The brand must be 60 characters or fewer.", "Model: The model must be 80 characters or fewer.", "What’s wrong?: The description must be 1000 characters or fewer." (OBSERVED).
  4. Set brand 60 x "B", model 80 x "M", description 999 x "D" + ".", choose Console, submit.
    - expect: Success panel appears (OBSERVED); the new row is present on /customer and the detail page shows the full 60/80/1000 character values (OBSERVED lengths 60-char brand, 80-char model, description textContent length 1000).
  5. Also try description of exactly 10 characters (not run).
    - expect: UNVERIFIED: expected success. Lower boundary 10 passes schema (LIMITS.description.min = 10, lib/repairs/schema.ts).
  6. HOW THIS FAILS: off-by-one in limits shows as the 60/80/1000-character submission being rejected or the 61/81/1001 one being accepted (row count changes); wrong copy shows as a mismatch on the exact message strings.

#### 2.4. CUS-04 [P1, browser E2E, OBSERVED] Input normalisation and HTML escaping

**File:** `e2e/repair/customer-sanitisation.spec.ts`

**Steps:**
  1. META. Preconditions: signed-in customer. Test data: brand "  Planner   Brand  ", model `PLN-R2 <b>x</b> & "q"`, description "Line one: screen flickers.\n\nLine three <script>window.__xss=1</script> after 2 days.  Two  spaces.". Requirement: R4 (clean()). Layer: browser E2E.
  2. Submit the form and open the detail page via a fresh navigation.
    - expect: Brand fact is exactly "Planner Brand" (inner whitespace collapsed and trimmed, OBSERVED).
    - expect: Model fact textContent is exactly `PLN-R2 <b>x</b> & "q"`: shown as literal text, no <b> element and no <script> element inside main (OBSERVED 0 scripts), window.__xss remains undefined (OBSERVED).
    - expect: Description textContent keeps the blank line and the double spaces (OBSERVED): multiline text is preserved, only single-line fields are collapsed.
    - expect: Page HTML does not contain ownerId (OBSERVED false).
  3. HOW THIS FAILS: unescaped rendering would create a script/bold element or set window.__xss; missing normalisation shows as leading/trailing/double spaces in the Brand fact.

#### 2.5. CUS-05 [P0, browser E2E, OBSERVED] Saved requests survive refresh, fresh navigation and client-side navigation

**File:** `e2e/repair/customer-persistence.spec.ts`

**Steps:**
  1. META. Preconditions: signed-in customer with the seeded request. Test data: marker M. Requirements: R9, R10, R14. Layer: browser E2E.
  2. Submit a valid request (CUS-01 data). Without a full reload click "Back to My repairs".
    - expect: Client-side navigation to /customer lists the new request first (OBSERVED, revalidatePath works) with text "Phone · Ref XXXXXXXX", the device name "E2E Brand Model <M>", "Submitted" twice (date line and status badge) and a link to /customer/repairs/<id>.
  3. Reload /customer (page.reload) and also open it via page.goto.
    - expect: The row is still present exactly once; seeded request still present; order newest first (new request above the seed) (OBSERVED).
  4. Open /customer/repairs/<id> directly in a new page of the same context.
    - expect: Detail page renders the same fields as in CUS-01 (no dependence on in-memory client state).
  5. HOW THIS FAILS: a stale client cache after submit would hide the new row on the SPA navigation; if data were held only in memory the reload/goto would not show it. Asserting the row by marker and that it occurs exactly once catches both.

#### 2.6. CUS-06 [P0, browser E2E, OBSERVED] Duplicate submission prevention: double click, same-tick resubmit, refresh, back button

**File:** `e2e/repair/customer-duplicate-submission.spec.ts`

**Steps:**
  1. META. Preconditions: signed-in customer; record the count N of rows with the unique marker (0) and the total list size T. Test data: three distinct markers M1, M2, M3 (one per sub-case). Requirement: R8. Layer: browser E2E (+ emulator document count for the owner as the authoritative check).
  2. Sub-case 1 (double click): fill a valid form with M1 and dblclick "Submit request".
    - expect: Success panel (OBSERVED). /customer then contains exactly one row with M1 and total T+1 (OBSERVED: seed + one new row). Emulator has exactly one document for M1.
  3. Sub-case 2 (rapid resubmit): fill a valid form with M2 and call form.requestSubmit() twice synchronously, then click "View this request".
    - expect: Success panel; /customer shows exactly one M2 row (OBSERVED: one row for PLN-R4-back); total increased by exactly 1.
  4. Sub-case 3 (refresh after submit): after a successful submit with M3, reload /customer/new.
    - expect: A blank form appears with a different requestKey, no resubmission, no success panel (OBSERVED). /customer still shows exactly one M3 row.
  5. Sub-case 4 (back button): after submit, click "View this request" then go back.
    - expect: Browser returns to /customer/new showing the success panel again, not a fillable form (OBSERVED), so there is nothing to resubmit; list still has exactly one row per submission.
  6. Sub-case 5 (different forms, different keys): submit two different valid forms in sequence.
    - expect: Two rows, not one (OBSERVED across R2..R6): the key is per rendered form so distinct submissions are not merged.
  7. HOW THIS FAILS: without the idempotency key the double click or requestSubmit x2 produces two documents (count T+2, two rows with the same marker); merging distinct submissions would show T+1 after two submits. Assert exact counts, not visibility.

#### 2.7. CUS-07 [P0, browser E2E, OBSERVED] Forged ownership/status/timestamp/role fields are ignored

**File:** `e2e/repair/customer-forged-fields.spec.ts`

**Steps:**
  1. META. Preconditions: signed-in customer on /customer/new. Test data: add hidden inputs ownerId=user_victim_planner, status=completed, createdAt=1999-01-01T00:00:00.000Z, role=technician, then a valid request with marker M. Requirement: R7. Layer: browser E2E; integration covers the same (tests/integration/action.test.ts).
  2. Inject the hidden inputs via page.evaluate, fill the form, submit, open the detail page.
    - expect: Success (OBSERVED). Detail shows Status Submitted (not completed) and a Submitted date of today, not 1999 (OBSERVED).
    - expect: The request appears in the customer's own list (it is owned by the signed-in customer, not user_victim_planner) (OBSERVED via own detail page).
    - expect: Emulator document: ownerId = customer's id, status "submitted", no role/userId fields (R7).
  3. HOW THIS FAILS: if the action read forged fields the request would be owned by another id (detail 404 for the customer), show Status Completed or a 1999 date.

#### 2.8. CUS-08 [P1, browser E2E, OBSERVED] Customer request list: ordering, content and links

**File:** `e2e/repair/customer-list.spec.ts`

**Steps:**
  1. META. Preconditions: customer with the seeded request plus two requests created in order A then B. Requirements: R10. Layer: browser E2E.
  2. Open /customer.
    - expect: Heading "Welcome, E2E" (OBSERVED first name of the disposable user) and section "My repairs" with link "Request a repair" -> /customer/new.
    - expect: List named "My repair requests, newest first": B is above A, A above the seed (OBSERVED order newest first).
    - expect: Each row shows "<DeviceType> · Ref <8 hex upper-case>", a link named "<brand> <model>" to /customer/repairs/<id>, "Submitted <date> UTC" and a "Submitted" badge; no ownerId or Clerk id in the HTML (OBSERVED).
  3. HOW THIS FAILS: wrong sort order, status text or link target fails the exact order/text/href assertions; a leaked owner field fails the HTML absence assertion.

#### 2.9. CUS-09 [P1, browser E2E, PARTLY OBSERVED] Customer 404 handling for missing, malformed and mis-cased request ids

**File:** `e2e/repair/customer-detail-404.spec.ts`

**Steps:**
  1. META. Preconditions: signed-in customer with at least one own request (id OWN). Test data: well-formed unknown id 0123456789abcdef0123456789abcdef01234567, "not-a-valid-id", OWN upper-cased, /customer/repairs/OWN/extra. Requirement: R11. Layer: browser E2E.
  2. page.goto('/customer/repairs/0123456789abcdef0123456789abcdef01234567').
    - expect: Rendered "Error 404" / "Page not found" / "We couldn’t find that page..." with links "Back to home" and "Browse services" (OBSERVED), robots meta noindex (OBSERVED). HTTP status is 200 (OBSERVED, PB-1): do not assert status unless PB-1 is resolved.
  3. Repeat for "not-a-valid-id", OWN.toUpperCase() (the id pattern is lower-case hex only) and /customer/repairs/OWN/extra.
    - expect: UNVERIFIED by rendering for the first two (G8): expected the same 404 page and none of the customer's own data. /customer/repairs/OWN/extra returned HTTP 404 (OBSERVED via fetch), the only response with a real 404 status.
  4. HOW THIS FAILS: if a malformed id reached Firestore and threw, the page would show the "Couldn’t load this request" error state instead of 404; if upper-case ids were accepted the own data would appear.

#### 2.10. CUS-10 [P0, browser E2E, OBSERVED] Customer cannot use technician routes (403, no data)

**File:** `e2e/repair/customer-forbidden-technician.spec.ts`

**Steps:**
  1. META. Preconditions: signed-in customer with a known own request id OWN. Requirement: R2. Layer: browser E2E.
  2. page.goto('/technician'), then '/technician/repairs/OWN', then '/technician/repairs/0123456789abcdef0123456789abcdef01234567'.
    - expect: Rendered main text: "Error 403", heading "Access denied", "Your account does not have access to that page.", links "Go to my dashboard" -> /dashboard and "Back to home" -> / (OBSERVED for /technician and the other two probes returned no data).
    - expect: No list named "Repair queue, newest first", no request text or marker anywhere in the document (OBSERVED false). HTTP status is 200 (PB-1).
    - expect: The 403 is shown even for a nonexistent id (role is checked before the lookup), so it cannot be used to probe existence.
  3. Open /dashboard.
    - expect: Lands on /customer after a client-side redirect (OBSERVED, redirectCount 0, heading "Welcome, E2E"); use an auto-retrying URL assertion.
  4. HOW THIS FAILS: if requireRole were removed the technician queue or detail would render for the customer (list/marker visible); asserting absence of the queue list and of the seeded marker catches it; asserting the "Access denied" text catches a redirect/blank page substitute.

#### 2.11. CUS-11 [P1, browser E2E, PLANNED, UNVERIFIED] Expired form key shows the expiry message and saves nothing

**File:** `e2e/repair/customer-expired-form.spec.ts`

**Steps:**
  1. META. Preconditions: signed-in customer; N recorded. Requirement: R8 (message from app/customer/new/actions.ts). Status: UNVERIFIED (feasible in browser, not executed). Layer: browser E2E.
  2. On /customer/new fill a valid form, remove the hidden input name=requestKey via page.evaluate (and in a second run set it to "nope"), submit.
    - expect: Problem summary "Your request was not saved." with "This form has expired. Reload the page and try again."; typed values still in the fields; count still N.
  3. HOW THIS FAILS: if the key were not enforced a record with a random id would be saved (count N+1) or no message would appear.

#### 2.12. CUS-12 [P2, browser E2E, OBSERVED] Layout with long unbroken brand/model values (POSSIBLE BUG PB-3)

**File:** `e2e/repair/customer-long-values-layout.spec.ts`

**Steps:**
  1. META. Preconditions: customer; viewport 1265 x 720 (as observed). Test data: brand 60 x "B", model 80 x "M" (no spaces). Requirement: none documented; expectation UNVERIFIED (no horizontal page scroll). Layer: browser E2E.
  2. Submit the request, open /customer and the detail page, evaluate document.documentElement.scrollWidth vs clientWidth.
    - expect: EXPECTED (assumption): scrollWidth <= clientWidth. OBSERVED today: /customer scrollWidth 1698 vs clientWidth 1265; detail page 2118 vs 1265, i.e. the test fails until the text is wrapped. A 1000-character unbroken description did not overflow (OBSERVED).
  3. HOW THIS FAILS: this is a known-failing check until fixed; it fails on the exact scrollWidth/clientWidth comparison.

#### 2.13. CUS-13 [P2, browser E2E, UNVERIFIED] Cancel link and empty customer state

**File:** `e2e/repair/customer-cancel-empty.spec.ts`

**Steps:**
  1. META. Status: Cancel link OBSERVED present (-> /customer), behaviour not clicked; empty state UNVERIFIED (seed always creates one request; needs a customer without records, G4). Requirement: R13 text in app/customer/page.tsx ("No repairs yet", "You haven’t requested a repair..."). Layer: browser E2E (empty state better at Vitest/unit).
  2. Fill part of the form and click "Cancel".
    - expect: Lands on /customer; no row with the partially typed values; row count unchanged.
  3. (Needs a customer with zero requests) open /customer.
    - expect: Heading "No repairs yet" and the text "You haven’t requested a repair."; no list element.
  4. HOW THIS FAILS: a cancel that saves a draft would add a row; an empty-state regression would show an empty list or the error state.

### 3. C. Technician: queue and detail

**Seed:** `e2e/seed.technician.spec.ts`

#### 3.1. TECH-01 [P0, browser E2E, OBSERVED] Technician queue lists a queued request with correct fields and link

**File:** `e2e/repair/technician-queue.spec.ts`

**Steps:**
  1. META. Preconditions: signed-in disposable technician; one seeded request with marker M, owner a synthetic id, device Phone, brand "E2E Brand", model "Model <M>". Requirements: R12, R16. Layer: browser E2E. Rule: find the row by marker, never by position/count (shared queue).
  2. Open /technician.
    - expect: Eyebrow "Technician dashboard", heading "Welcome, E2E", intro "Submitted repair requests appear here, newest first. This view is read-only for now." (OBSERVED).
    - expect: Section "Repair queue" with list "Repair queue, newest first" containing the row for M: "Phone · Ref XXXXXXXX", link "E2E Brand Model <M>" -> /technician/repairs/<id>, "Submitted <UTC date>", badge "Submitted" (OBSERVED).
    - expect: No form, no "Request a repair" button on the technician page.
  3. HOW THIS FAILS: the marker-scoped row assertion fails if the queue reads the wrong database/collection (the framework gate relies on the same assertion); wrong link target fails the href check.

#### 3.2. TECH-02 [P0, browser E2E, OBSERVED] Technician opens a request: read-only details, no owner leakage

**File:** `e2e/repair/technician-detail.spec.ts`

**Steps:**
  1. META. Preconditions: as TECH-01. Requirements: R11 (DTO), R12. Layer: browser E2E.
  2. Click the row link for M.
    - expect: URL /technician/repairs/<40 hex>; title "Repair request | Fix District"; eyebrow "Repair request · Ref XXXXXXXX"; heading is the device name "E2E Brand Model <M>" (OBSERVED).
    - expect: Intro "Read-only for now. Status changes, estimates, and assignment are not available yet." (OBSERVED).
    - expect: Facts: Status Submitted, Device type Phone, Brand E2E Brand, Model Model <M>, Submitted date; description equals the seeded description (OBSERVED).
    - expect: No form, input, textarea, select or button inside main (OBSERVED count 0); only link "Back to repair queue" -> /technician.
    - expect: The HTML contains neither "ownerId" nor the synthetic owner id (OBSERVED false).
  3. Click "Back to repair queue".
    - expect: Returns to /technician and the row for M is still present.
  4. HOW THIS FAILS: an edit control or owner id leaking through the DTO fails the count-0 / HTML-absence assertions; wrong or missing description fails the exact description assertion.

#### 3.3. TECH-03 [P0, browser E2E, OBSERVED] Technician is refused customer routes (403) and sees no customer form

**File:** `e2e/repair/technician-forbidden-customer.spec.ts`

**Steps:**
  1. META. Preconditions: signed-in technician with the seeded request id SEED. Requirement: R2. Layer: browser E2E.
  2. page.goto('/customer/new'), '/customer', '/customer/repairs/SEED'.
    - expect: Rendered: "Error 403", heading "Access denied", "Your account does not have access to that page.", zero <form> elements (OBSERVED for /customer/new and /customer/repairs/SEED), no seeded marker text anywhere (OBSERVED). HTTP status 200 (PB-1).
  3. Open /dashboard.
    - expect: Lands on /technician (UNVERIFIED for technician; observed for customer->/customer only; implied by the seed fixture which asserts /technician after /dashboard).
  4. HOW THIS FAILS: if the customer form rendered for a technician, a technician could submit requests (form count > 0); asserting no form plus the Access denied text catches it.

#### 3.4. TECH-04 [P1, browser E2E, PARTLY OBSERVED] Technician 404 for unknown or malformed ids

**File:** `e2e/repair/technician-detail-404.spec.ts`

**Steps:**
  1. META. Preconditions: signed-in technician. Test data: 0123456789abcdef0123456789abcdef01234567 (well-formed, nonexistent), "not-a-valid-id", SEED upper-cased. Requirement: R11/R12. Layer: browser E2E.
  2. page.goto('/technician/repairs/0123456789abcdef0123456789abcdef01234567').
    - expect: Rendered "Error 404" / "Page not found" (OBSERVED, HTTP 200 per PB-1).
  3. Repeat with the malformed and upper-cased ids.
    - expect: UNVERIFIED by rendering (G8): expected the same 404 page; never the "Couldn’t load this request" error state and never the request's data.
  4. HOW THIS FAILS: malformed ids reaching Firestore would produce the error state or leak data; assert "Page not found" text and absence of the SEED marker.

#### 3.5. TECH-05 [P1, browser E2E, UNVERIFIED] Technician sees requests created through the UI by a customer

**File:** `e2e/repair/technician-sees-customer-request.spec.ts`

**Steps:**
  1. META. Status: UNVERIFIED (needs customerPage and technicianPage in one test; seeds are sequential, G6). Requirement: R12 ('every submitted request'). Layer: browser E2E (two contexts via fixtures).
  2. In customerPage submit a valid request with marker M; in technicianPage open /technician.
    - expect: A row containing M appears in "Repair queue, newest first" with the customer's device details; opening it shows the same description and status Submitted; no customer identifier (ownerId, Clerk id, email) appears in the HTML.
  3. HOW THIS FAILS: if the queue filtered by owner or read a stale cache the marker row would be missing; if owner info leaked the HTML absence assertion fails.

#### 3.6. TECH-06 [P2, unit/integration, UNVERIFIED in browser] Queue bound of 50, empty queue and error state

**File:** `tests/integration/store.test.ts`

**Steps:**
  1. META. Layer: integration/Vitest (e2e/docs/framework.md section 7 keeps empty-queue and 50-row behaviour out of Playwright). Requirements: R10, R12, R13. Status: not explored in browser (G4, G5).
  2. Seed 51 documents and call listQueue; seed 0 documents and render /technician; stub a Firestore read failure.
    - expect: items.length = 50 and hasMore = true, note "Showing the 50 most recent requests." rendered; empty -> heading "Queue is empty" with "No repair requests have been submitted yet."; failure -> "Couldn’t load the queue" and never "Queue is empty".
  3. HOW THIS FAILS: off-by-one on the extra-read logic gives 51 items or no note; an error rendered as empty violates R13.

### 4. D. Cross-actor isolation (customer A vs customer B vs technician)

**Seed:** `e2e/seed.customer.spec.ts (generated tests use fixtures customerPage, otherCustomerPage, technicianPage)`

#### 4.1. ISO-01 [P0, browser E2E, UNVERIFIED] Customer B cannot open customer A's request by direct URL

**File:** `e2e/repair/isolation-direct-url.spec.ts`

**Steps:**
  1. META. Status: UNVERIFIED. A second disposable customer is unavailable through the planner seeds (G1); only the nonexistent-id 404 was observed. Requirement: R11. Layer: browser E2E using otherCustomerPage fixture; integration covers store.getForCustomer (tests/integration/store.test.ts).
  2. Customer A (customerPage) submits a request with marker MA and records the id A_ID from the "View this request" link. Customer B (otherCustomerPage) page.goto('/customer/repairs/' + A_ID).
    - expect: B sees exactly the same rendered page as for a nonexistent id: "Error 404", "Page not found", same title "Repair request | Fix District"; the text MA, brand and model appear nowhere; the DOM text of the A_ID response and of the nonexistent-id response is identical apart from the URL.
    - expect: A still opens A_ID successfully (control, proves the id was valid).
  3. HOW THIS FAILS: if ownership were not checked B would see MA's details; if not-yours differed from not-found (e.g. 403) the identical-page assertion fails and reveals existence.

#### 4.2. ISO-02 [P0, browser E2E, UNVERIFIED] Customer B's list never contains customer A's requests

**File:** `e2e/repair/isolation-lists.spec.ts`

**Steps:**
  1. META. Status: UNVERIFIED (G1). Requirement: R10/R11. Layer: browser E2E (two contexts) + integration.
  2. A submits MA; B submits MB; each opens /customer.
    - expect: A's list has a row with MA and no row with MB; B's list has MB and no MA; page HTML for each contains neither marker of the other customer; both lists show their own count.
  3. HOW THIS FAILS: a missing owner filter in listForCustomer (where ownerId == userId) shows the other marker; asserting absence of the other marker, not just presence of the own one, catches it.

#### 4.3. ISO-03 [P1, browser E2E, UNVERIFIED] Technician sees both customers' requests and customers cannot see each other's through the queue

**File:** `e2e/repair/isolation-technician-view.spec.ts`

**Steps:**
  1. META. Status: UNVERIFIED (G1, G6). Requirements: R10, R12. Layer: browser E2E (three contexts).
  2. A submits MA, B submits MB, technician opens /technician.
    - expect: Technician queue contains rows for MA and MB (find by marker only; do not assert counts or order of the shared queue).
    - expect: Customers A and B still cannot open /technician (403) and still do not see each other's markers.
  3. HOW THIS FAILS: a per-owner filter on the technician query hides one marker; a role regression exposes the queue to a customer.

### 5. E. Database and network failure (browser vs integration)

**Seed:** `e2e/seed.customer.spec.ts for browser scenarios; tests/integration (emulator 8085) for integration scenarios`

#### 5.1. DBF-B1 [P1, browser E2E, OBSERVED] Network failure during submit: no record saved, UI behaviour recorded (PB-2)

**File:** `e2e/repair/failure-network-submit.spec.ts`

**Steps:**
  1. META. Layer: browser E2E. Preconditions: signed-in customer on /customer/new with a valid form (Laptop, "PlannerNet", "PLN-R4-net"); list size T recorded. Fault: page-level window.fetch stub that rejects POST with TypeError (OBSERVED); in a generated test prefer page.route(..., route => route.abort('failed')) or context.setOffline(true) (UNVERIFIED, DBF-B2/B3).
  2. Install the fault, click "Submit request".
    - expect: OBSERVED: the page turns into "This page couldn’t load" / "Reload to try again, or go back." with buttons Reload and Back; the form and typed answers are gone; browser console shows a TypeError: Failed to fetch from fetchServerAction.
    - expect: DESIRED (UNVERIFIED requirement, R13 spirit): an inline message such as "We couldn’t save your request..." with the answers kept.
  3. Remove the fault and open /customer.
    - expect: List size is still T (OBSERVED), so no partial record was created.
  4. HOW THIS FAILS: this scenario records current behaviour; once the UI handles the failure it must change to assert the message and kept values; the T assertion fails if a retry/partial write ever saves a record.

#### 5.2. DBF-B2/B3 [P1, browser E2E, PLANNED, unexplored] HTTP 500 and offline on submit, then successful retry

**File:** `e2e/repair/failure-submit-retry.spec.ts`

**Steps:**
  1. META. Status: PLANNED, not explored: browser_route and browser_network_state_set returned "Tool not found" in this session (G11). Layer: browser E2E. Preconditions: customer on /customer/new with a valid form and note of the requestKey.
  2. Run 1: page.route('**/customer/new', r => r.fulfill({status: 500})) for POST only, submit. Run 2: context.setOffline(true), submit. Then restore the network and resubmit (same page/form if it still exists, else a new form).
    - expect: During the fault no record exists (owner-scoped emulator count unchanged).
    - expect: After recovery the owner's emulator count increases by exactly 1 and /customer shows exactly one row with the marker (idempotent key: the same key never creates a second document even if the first request had in fact reached the server).
  3. HOW THIS FAILS: a duplicate document (count +2) would mean the retry is not idempotent; missing document means retry is impossible.

#### 5.3. DBF-I1..I3 [P0, integration, PLANNED, unexplored] Firestore failures produce error states, never empty states

**File:** `tests/integration/server.test.ts`

**Steps:**
  1. META. Layer: integration (Vitest with a failing Firestore stub; do NOT stop the emulator). Requirement: R13. Status: README claims coverage exists; not run or read here.
  2. Make listForCustomer throw (code 14 unavailable, then 9 failed-precondition for the missing index, then 7 permission denied) and render /customer logic via loadMyRepairs; repeat for listQueue and getFor*.
    - expect: loadMyRepairs/loadRepairQueue/loadMyRepair/loadRepairForTechnician return {ok:false}; the pages render "Couldn’t load your repairs" (with "it does not mean you have no repairs" and link "Try again" -> /customer), "Couldn’t load the queue" (link "Try again" -> /technician) and "Couldn’t load this request"; the strings "No repairs yet" and "Queue is empty" are NOT present.
    - expect: Server log contains only the operation, error name and code ("[repairs] listMine failed (Error, code 9)"), no message text, input or credentials.
  3. HOW THIS FAILS: an error swallowed into an empty array renders the empty state, caught by the not-present assertion.

#### 5.4. DBF-I4 [P0, integration, PLANNED, unexplored] Write failure on submit keeps answers and saves nothing

**File:** `tests/integration/action.test.ts`

**Steps:**
  1. META. Layer: integration. Requirement: R13, R8. Make createForCustomer throw a non-already-exists error (and separately an already-exists whose existing document belongs to another owner).
  2. Call submitRepairRequest with valid values and a valid key.
    - expect: Returns status "error" with message "We couldn’t save your request. Your answers are still here, so you can try again in a moment." and values equal to the sanitised inputs; no document exists; a retry with the same key after the fault is removed creates exactly one document.
    - expect: For a key collision with a different owner the store throws RepairAccessError and the action reports the same generic save failure (code path: store.createForCustomer -> server.saveRepairRequest catch); no foreign document is modified or revealed.
  3. HOW THIS FAILS: success returned on failure, values dropped, or a second document on retry fail the exact state/count assertions.

#### 5.5. DBF-I5/I6/I7 [P1, integration + rules-emulator, PLANNED, unexplored] Config errors, malformed stored data and client-SDK rules

**File:** `tests/integration/rules.test.ts`

**Steps:**
  1. META. Layer: unit/integration/rules-emulator. Requirements: R13, R15. Status: unexplored; PB-6 is a design question.
  2. (I5) Initialise Firebase admin with a malformed private key/project mismatch. (I6) Insert a document missing createdAt Timestamp or with status "completed" and load the owner's list and the technician queue. (I7) Use the web SDK (unauthenticated and authenticated) to read and write repairRequests.
    - expect: (I5) FirebaseConfigError with fixed named message logged; UI shows the error states, never leaks the key.
    - expect: (I6) Define and assert the intended behaviour: today the whole list becomes the error state (RepairDataError) - decide whether bad rows should be skipped.
    - expect: (I7) Every client read/write is rejected (permission-denied) per firestore.rules.
  3. HOW THIS FAILS: a relaxed rule lets the web SDK read or write a document; a regression in toSummary turns one bad document into a silent empty list.
