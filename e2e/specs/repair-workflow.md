# Fix District: repair request workflow

## Application Overview

Plan for the existing repair-request workflow of Fix District, explored with the signed-in customer and technician planner seeds against the isolated Firestore emulator (nothing was changed in any live service). WORKFLOW: a signed-in customer submits a repair request at /customer/new (device type, brand, model, description); sees a confirmation; finds the request in 'My repairs' (/customer, newest first) and opens its read-only detail page (/customer/repairs/<id>); a technician sees every submitted request in 'Repair queue' (/technician, newest first, read-only) and opens its detail (/technician/repairs/<id>). Status changes, estimates and assignment do not exist yet and are out of scope. CONVENTIONS FOR GENERATION: import test/customerTest/technicianTest and expect from e2e/fixtures (never from @playwright/test); put tests under e2e/repair/; every test creates its data with a unique marker (the 'marker' fixture) in brand/model/description and finds rows by that marker, never by position, count or id; use the 'seed' fixture for preconditions and the customerPage/otherCustomerPage/technicianPage fixtures for roles; no fixed sleeps. The device-type radios are visually hidden: click the visible label text inside the 'Device type' group (see e2e/pages/repair-form.page.ts). State expected texts as the literals listed here, not imported from the app. ALREADY COVERED by smoke tests (do not duplicate): signed-out redirects, customer submit smoke, technician sees a seeded request, customer visiting /technician is denied, technician visiting customer pages is denied. Items marked '(confirm)' were not observed directly (taken from the form's own hint text or inferred) and must be confirmed in the browser during generation before being asserted. The technician queue only shows the newest 50 requests across all users, so queue tests must locate their own row by marker and must not assert counts or order across the whole queue. Do not include real personal data; use synthetic text only.

## Test Scenarios

### 1. Customer submits a repair request

**Seed:** `e2e/seed.customer.spec.ts`

#### 1.1. Submit a valid request and open it from the confirmation

**File:** `e2e/repair/submit-valid-request.spec.ts`

**Steps:**
  1. Open My repairs (/customer) and click the 'Request a repair' link.
    - expect: The URL is /customer/new.
    - expect: The heading 'Request a repair' is shown.
    - expect: A 'Device type' group offers Phone, Laptop, Tablet and Console, plus 'Brand', 'Model' and 'What’s wrong?' fields and a 'Submit request' button.
  2. Choose Laptop (click its visible label), fill Brand and Model with marker-based synthetic values, and fill 'What’s wrong?' with a synthetic sentence of at least 10 characters containing the marker.
    - expect: No error messages are shown while filling.
  3. Click 'Submit request'.
    - expect: A status region shows 'Request submitted'.
    - expect: The heading 'We’ve got it' and the text 'Your repair request was saved with the status Submitted.' are shown.
    - expect: Links 'View this request' and 'Back to My repairs' are visible.
  4. Click 'View this request'.
    - expect: The URL matches /customer/repairs/<id>.
    - expect: The page heading is the brand and model entered.
    - expect: The Request details list shows Status 'Submitted', Device type 'Laptop', the entered Brand and Model, and a Submitted time.
    - expect: 'Problem description' shows exactly the description entered.
  5. Click 'Back to My repairs'.
    - expect: A list item for this request (found by marker) is shown with 'Laptop', the status 'Submitted' and a submitted time.

#### 1.2. Each device type can be submitted

**File:** `e2e/repair/submit-each-device-type.spec.ts`

**Steps:**
  1. For each of Phone, Laptop, Tablet and Console (one independent test per type, each with its own marker), submit a valid request choosing that device type.
    - expect: The confirmation 'Request submitted' appears.
    - expect: The request's detail page shows the Device type chosen.
    - expect: The My repairs row for the marker is prefixed with that device type (for example 'Tablet · Ref ...').

#### 1.3. Empty submission shows a summary and field errors and saves nothing

**File:** `e2e/repair/empty-submission-errors.spec.ts`

**Steps:**
  1. Open /customer/new and click 'Submit request' without entering anything.
    - expect: The URL stays /customer/new.
    - expect: The summary 'Please fix the following before sending:' lists four links: 'Device type: Choose the type of device.', 'Brand: Enter the brand.', 'Model: Enter the model.' and 'What’s wrong?: Describe the problem.'
    - expect: The Brand, Model and 'What’s wrong?' fields are marked invalid and each shows an error message next to it; the Device type group shows 'Choose the type of device.'
  2. Open My repairs (/customer).
    - expect: No list item contains this test's marker (nothing was saved).

#### 1.4. Too-short description is rejected and the entered values are kept

**File:** `e2e/repair/short-description-rejected.spec.ts`

**Steps:**
  1. Choose Laptop, fill Brand and Model, and enter a 9-character description such as 'too short'. Click 'Submit request'.
    - expect: The summary and the field show 'Add a little more detail (at least 10 characters).'
    - expect: The URL stays /customer/new.
    - expect: Brand and Model still contain the values entered, and the description still contains 'too short'.
    - expect: The Device type error is NOT shown because a type was chosen (confirm).

#### 1.5. Description length limits: 10 accepted, 1,000 accepted, 1,001 rejected (confirm)

**File:** `e2e/repair/description-length-limits.spec.ts`

**Steps:**
  1. The form's hint states '10 to 1,000 characters'. In three independent tests submit a valid request whose description is exactly 10 characters, exactly 1,000 characters, and 1,001 characters (marker included in Brand or Model, not counted toward the description length).
    - expect: 10 and 1,000 characters: 'Request submitted' is shown.
    - expect: 1,001 characters: the form stays on /customer/new with an error on 'What’s wrong?' and nothing is saved (the exact message must be confirmed in the browser before asserting it).

#### 1.6. Fixing a rejected form and resubmitting saves exactly one request

**File:** `e2e/repair/fix-and-resubmit.spec.ts`

**Steps:**
  1. Submit the form with a too-short description, then replace it with a valid description and submit again.
    - expect: 'Request submitted' is shown.
    - expect: My repairs contains exactly one list item for the marker.

#### 1.7. Double-clicking Submit saves only one request (confirm)

**File:** `e2e/repair/double-submit-saves-once.spec.ts`

**Steps:**
  1. Fill the form with valid marker-based data and double-click 'Submit request'.
    - expect: 'Request submitted' is shown.
    - expect: My repairs contains exactly one list item for the marker.

#### 1.8. Cancel returns to My repairs without saving

**File:** `e2e/repair/cancel-request.spec.ts`

**Steps:**
  1. Open /customer/new, fill in valid marker-based data, then click the 'Cancel' link.
    - expect: The URL is /customer.
    - expect: No list item contains the marker.

### 2. Customer views their repair requests

**Seed:** `e2e/seed.customer.spec.ts`

#### 2.1. My repairs lists requests newest first with device, reference, status and time

**File:** `e2e/repair/customer-list-order.spec.ts`

**Steps:**
  1. Create two requests for the customer with clearly different creation times (seed one, then submit a second through the form), then open /customer.
    - expect: Both are listed under the heading 'My repairs' in a list labelled 'My repair requests, newest first'.
    - expect: The newer request (found by marker) appears before the older one (compare their positions only against each other, not against absolute numbers).
    - expect: Each item shows '<Device type> · Ref <8 characters>', a link titled with the brand and model, the submitted time and the status 'Submitted'.

#### 2.2. Customer request detail shows every field

**File:** `e2e/repair/customer-detail-fields.spec.ts`

**Steps:**
  1. Seed a request with known values, open /customer and click its link.
    - expect: The URL matches /customer/repairs/<id>.
    - expect: The heading is the brand and model; the lead text says 'This is the request you submitted. A technician can see it.'
    - expect: The details list shows Status, Device type, Brand, Model and Submitted with the seeded values.
    - expect: 'Problem description' shows the seeded description.
  2. Click 'Back to My repairs'.
    - expect: The URL is /customer and the request is listed.

#### 2.3. Unknown or malformed request ids show 'Page not found'

**File:** `e2e/repair/customer-detail-not-found.spec.ts`

**Steps:**
  1. Visit /customer/repairs/ followed by 40 zeros (well-formed but unknown id).
    - expect: The page shows 'Error 404' and the heading 'Page not found'.
  2. Visit /customer/repairs/not-a-valid-id.
    - expect: The page shows 'Error 404' and the heading 'Page not found'.

#### 2.4. A customer cannot open another customer's request (confirm)

**File:** `e2e/repair/customer-cannot-open-others-request.spec.ts`

**Steps:**
  1. Seed a request owned by the second customer (otherCustomer), then, signed in as the first customer, visit that request's /customer/repairs/<id> URL.
    - expect: The same 'Page not found' result as an unknown id is shown (confirm in the browser; do not assume 403).
    - expect: None of the other customer's brand, model or description appears anywhere on the page.

### 3. Technician sees submitted requests

**Seed:** `e2e/seed.technician.spec.ts`

#### 3.1. A request submitted by a customer appears in the technician queue and detail

**File:** `e2e/repair/customer-request-reaches-technician.spec.ts`

**Steps:**
  1. As the customer (customerPage), submit a valid request with marker-based data through /customer/new.
    - expect: 'Request submitted' is shown.
  2. As the technician (technicianPage), open /technician.
    - expect: The page shows 'Technician dashboard' lead text 'Submitted repair requests appear here, newest first. This view is read-only for now.'
    - expect: A queue item for the marker is listed under 'Repair queue' with the device type, the status 'Submitted' and a submitted time.
  3. Click the queue item's link.
    - expect: The URL matches /technician/repairs/<id>.
    - expect: The details show Status 'Submitted' and the device type, brand, model and description exactly as the customer entered them.
  4. Click 'Back to repair queue'.
    - expect: The URL is /technician and the item is still listed.

#### 3.2. Technician detail is read-only

**File:** `e2e/repair/technician-detail-read-only.spec.ts`

**Steps:**
  1. Seed a request and open its technician detail page.
    - expect: The text 'Read-only for now. Status changes, estimates, and assignment are not available yet.' is shown.
    - expect: The main content has no form, status control, assignment control or submit button; its only link action is 'Back to repair queue'.

#### 3.3. Unknown request id shows 'Page not found' for a technician (confirm)

**File:** `e2e/repair/technician-detail-not-found.spec.ts`

**Steps:**
  1. As the technician, visit /technician/repairs/ followed by 40 zeros, then /technician/repairs/not-a-valid-id.
    - expect: Each shows 'Error 404' and 'Page not found' (confirm the exact result in the browser before asserting).
