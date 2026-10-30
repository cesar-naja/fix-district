# Fix District

Website for Fix District, a neighborhood electronics-repair shop (phones, laptops, tablets, consoles).

What exists today:

- Public pages: home, services, and about, with a shared layout and design system.
- Accounts: registration and sign-in through [Clerk](https://clerk.com).
- Role-based dashboards: `/customer` and `/technician`, with `/dashboard` as the signed-in entry point.
- **Repair requests** stored in Firebase Firestore:
  - A customer submits a request (device type, brand, model, problem description) at `/customer/new`.
  - It appears under **My repairs** on `/customer` (newest first, status *Submitted*), and the customer can open its details.
  - Technicians see every submitted request in the **repair queue** on `/technician` and can open details. Technician access is **read-only**.

Not built yet: status changes, estimates, technician assignment, payments, uploads, emails, AI features, and Clerk Organizations.

## Run it

```bash
npm install
npm run dev      # http://localhost:3000
npm run lint
npm run typecheck
npm run build && npm start
npm run test:unit   # fast tests, no emulator needed
npm test            # everything, including Firestore emulator tests (see "Tests")
```

Copy `.env.example` to `.env.local` (git-ignored) and fill it in. Never commit real values.

> This project uses a recent Next.js with breaking changes from older versions. Before changing framework-level code, read `AGENTS.md` and the matching guide in `node_modules/next/dist/docs/`. `cacheComponents` and `partialPrefetching` are enabled in `next.config.ts`, so anything that reads the session (`auth()`, `currentUser()`, cookies, headers) must render inside `<Suspense>`.

## Roles and access

There are two roles: **customer** (the default for every new account) and **technician**.

- A technician is designated by `role: "technician"` in the user's Clerk **private metadata**. Private metadata is writable only from the Clerk Dashboard or the Clerk Backend API (secret key). There is no sign-up field, cookie, query parameter, local storage value, or user-editable metadata that can set it.
- Any other value, or no value, means customer. Unknown values fail closed to customer.
- `/dashboard` redirects a signed-in user to `/customer` or `/technician`. Signed-out visitors are sent to `/sign-in`.
- A signed-in user requesting the other role's route gets a 403 page.

Enforcement lives in three layers:

1. `proxy.ts` redirects signed-out requests for `/dashboard`, `/customer`, and `/technician` to sign-in before anything renders. It does not check roles (that needs a Clerk Backend API call).
2. `lib/auth/access.ts` is the one place that resolves the user and role. It reads the role from Clerk private metadata on the server on every request.
3. Each page calls `requireRole(...)` itself. **Any future Server Action or Route Handler that touches role-specific data must also call `requireRole("technician")` (or `"customer"`) first.** Hiding a link does not protect anything.

### Make your own development account a technician

Do this in the Clerk Dashboard, for the development instance you run locally:

1. Open the [Clerk Dashboard](https://dashboard.clerk.com), choose this application, and make sure the **Development** instance is selected.
2. Go to **Users** and open your account.
3. Scroll to **Metadata**, find **Private**, and click **Edit**.
4. Enter exactly:

   ```json
   { "role": "technician" }
   ```

5. Save, then open `/dashboard`. You should land on `/technician`. No sign-out is needed, because the role is read from Clerk on each request.

To switch back to customer, edit the same **Private** metadata and either delete the `role` key (leave `{}`) or set it to `"customer"`. Reload `/dashboard` and you land on `/customer`.

Notes:

- Use **Private**, not Public or Unsafe. Public metadata is readable by the browser, and unsafe metadata is writable by the user. Neither is trusted here.
- Development and production Clerk instances have separate users. Designating a technician in one does not affect the other.
- Keep any existing keys in the private metadata object when you edit it; only add or remove `role`.

## Repair requests and Firebase

### How data flows

All repair data is read and written **on the server only**, through Firebase Admin, behind one data-access layer. The browser never talks to Firestore for repair data.

```
form  ->  Server Action (app/customer/new/actions.ts)
      ->  lib/repairs/server.ts   resolves the Clerk user + role (requireRole)
      ->  lib/repairs/store.ts    re-checks role + ownership, then reads/writes Firestore
```

- Collection: `repairRequests`. Fields: `ownerId`, `deviceType`, `brand`, `model`, `description`, `status`, `createdAt`.
- `ownerId` is the authenticated Clerk user ID. `status` (`submitted`) and `createdAt` (server timestamp) are assigned on the server. The action reads only the four device fields and an idempotency key from the form; any `ownerId`, `status`, or timestamp a client sends is never read.
- **Duplicates:** each rendered form carries a server-generated key. The document ID is a hash of the customer's ID and that key, so a double click, retry, or resubmit maps to the same document and is saved once.
- **Customers** can create requests for themselves and read only their own. A request that belongs to someone else returns the same 404 as one that does not exist, so its existence is not revealed.
- **Technicians** can list the queue and open any request. Customers get a 403 on technician routes and operations, and technicians are refused the customer-only operations.
- **Bounded reads:** lists read at most 50 requests (`LIST_LIMIT`) and say so when more exist.
- **DTOs:** pages receive only the fields they display. The owner ID is never sent to the UI. No device passwords, PINs, payment details, or personal contact data are collected.
- **Caching:** repair data is never cached. Nothing uses `use cache`; every read happens at request time inside `<Suspense>` after the session is resolved.
- **Failures:** a failed database read shows an error state, never an empty list. Logs contain only the operation, error type, and error code.

### Security rules do not protect server code

`firestore.rules` denies every client (web SDK) read and write, so a browser cannot reach repair data directly. **Firebase Admin bypasses these rules.** The checks in `lib/auth/access.ts`, `lib/repairs/server.ts`, and `lib/repairs/store.ts` are therefore the only thing protecting data on the server, and must stay in place. Any new server code that touches Firestore must go through `lib/repairs/store.ts` (or an equivalent layer that checks the actor).

`lib/firebase.ts` (the client SDK) is not used for repair data and should not be.

### Firebase setup (private steps for you)

Nothing below is done automatically, and the app cannot read or write real data until it is.

1. **Create or choose a Firebase project** and enable **Firestore** (Build > Firestore Database > Create database, production mode).
2. **Create a service account key:** Project settings > Service accounts > Generate new private key. Keep the JSON file out of this repository.
3. **Put three values in `.env.local`** (names are in `.env.example`): `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` (keep the quotes and the `\n` sequences). These are server-only; never add `NEXT_PUBLIC_` to them.
4. **Deploy the index** (required, or the "My repairs" query fails with an error state). The customer list sorts by `createdAt` within one owner, which needs a composite index defined in `firestore.indexes.json`:
   ```bash
   npx firebase login
   npx firebase deploy --only firestore:indexes --project YOUR_PROJECT_ID
   ```
   Index builds can take a few minutes. Alternatively, open the app, trigger the error once, and follow the link Firestore prints in the server log to create the same index.
5. **Deploy the rules** (recommended, so direct browser access is denied):
   ```bash
   npx firebase deploy --only firestore:rules --project YOUR_PROJECT_ID
   ```
   `firestore.rules` is project-wide: it denies every client read and write to every collection in that Firestore database. Do not deploy it if another app uses client access to the same database.
6. Restart `npm run dev`.

**Troubleshooting.** If My repairs shows "Couldn’t load your repairs", the server log says why. Configuration problems are named directly (for example, `FIREBASE_PRIVATE_KEY is not a valid PEM private key`). Other failures log only an error type and code. Common causes:

- `app/invalid-credential`: `FIREBASE_PRIVATE_KEY` was pasted wrongly. It must end exactly with `-----END PRIVATE KEY-----\n` (backslash, `n`, closing quote) and nothing after it. The app now reports this by name.
- `FIREBASE_PROJECT_ID` differs from the project in `FIREBASE_CLIENT_EMAIL` (`...@PROJECT_ID.iam.gserviceaccount.com`). Use the same project for both.
- gRPC code `9` (failed precondition): the composite index in step 4 is not deployed or still building.
- gRPC code `7` (permission denied): the service account lacks Firestore access in that project.

Deploying is always your decision: no script or test here deploys anything, and there is no `.firebaserc`, so the CLI will not pick a project for you.

### Local development against the emulator

```bash
npm run emulators            # Firestore emulator on 127.0.0.1:8085 (needs Java 21+)
```

Then add `FIRESTORE_EMULATOR_HOST=127.0.0.1:8085` to `.env.local` and restart `npm run dev`. No Firebase credentials are needed in this mode, and the app uses local data only. Remove the line to go back to your live project. Never set it in production.

Clerk is still real in this mode: you sign in with your normal accounts. If an emulator process is left running after a test run on Windows, stop the `java` process listening on port 8085.

### Tests

```bash
npm run test:unit   # validation, role checks, form behaviour (no emulator)
npm test            # starts the Firestore emulator, then runs every test
```

`npm test` runs against the emulator only, using a `demo-` project and no credentials; the integration helpers refuse to run if the emulator is not present. Coverage:

- server validation and limits, including forged `ownerId` / `status` / timestamp fields being ignored
- role and ownership checks: signed-out, customer, technician, and customer-to-customer isolation
- duplicate submissions (sequential and concurrent)
- persistence across a fresh store instance, newest-first ordering, and the 50-item bound
- database failures surfacing as errors instead of empty lists
- the deny-by-default client rules (an unauthenticated web SDK client is refused)
- the request form: labels, field errors, kept input after a failed save, saving state, repeated clicks

The Clerk and Next.js session are replaced by test doubles in these tests. Signing in with real Clerk accounts is a manual check (see below).

## Structure

```
app/                 Routes: / , /services , /about , /sign-in , /sign-up ,
                     /dashboard , /customer , /customer/new ,
                     /customer/repairs/[id] , /technician ,
                     /technician/repairs/[id] , forbidden, not-found
  globals.css        Design tokens (Tailwind v4 @theme) and base styles
  layout.tsx         Fonts, metadata, ClerkProvider, skip link, header, footer
components/
  brand/             Wordmark and screw-head mark
  dashboard/         Shared dashboard frame, empty and error states
  repairs/           Request form (client), list, and detail views
  illustrations/     Hero workbench scene and device line art (inline SVG)
  layout/            SiteHeader, SiteFooter, NavLinks (client component)
  ui/                Container, ButtonLink, SectionHeading, DeviceCard, ProcessList
lib/
  auth/roles.ts      Role names, default role, role-to-path map (pure, no Clerk)
  auth/access.ts     Server-side getAccess / requireUser / requireRole
  firebase/admin.ts  Firebase Admin (server-only) initialisation
  repairs/schema.ts  Fields, limits, and validation (shared with the form)
  repairs/store.ts   Data-access layer: role + ownership checks, Firestore
  repairs/server.ts  Operations pages and actions call (adds the Clerk check)
  clerk-appearance.ts  Clerk styling mapped onto the design tokens
  site.ts            Site name, navigation, device categories, process steps, principles
proxy.ts             Signed-out gate for the dashboard routes
tests/               Vitest: unit/ (no emulator) and integration/ (Firestore emulator)
firebase.json, firestore.rules, firestore.indexes.json   Emulator, client rules, index
.env.example         Placeholder environment variables
```

## Conventions

- **Server Components by default.** The only client code authored here is `components/layout/nav-links.tsx` (marks the current page) and `components/repairs/repair-request-form.tsx` (form state, errors, and the saving state).
- **Content lives in `lib/site.ts`.** Edit copy there, not in components.
- **Design tokens** (`paper`, `ink`, `accent`, …) are defined once in `app/globals.css`. Use the `display` class for headlines and `label` for small mono tags. Dark sections use `on-dark` so focus rings stay visible.
- **Honest content.** No invented prices, turnaround times, reviews, certifications, addresses, statistics, or repair records. Add them only once the shop has confirmed them.
- **Every visible action must work.** Do not add buttons or links for features that are not built. When booking arrives, add the destination first, then the link.
- **Authorize on the server.** Use `lib/auth/access.ts` for every role check. Never derive a role from client-supplied input.
- **Motion** is gated behind `prefers-reduced-motion` (see the end of `globals.css`).
