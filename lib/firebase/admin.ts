import "server-only";
import { createPrivateKey } from "node:crypto";
import {
  cert,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Firebase Admin for server code only. This is the only way repair data is
 * read or written. The browser never talks to Firestore.
 *
 * Credentials come from server-only environment variables (never prefixed
 * NEXT_PUBLIC_, never logged):
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 * See .env.example. When FIRESTORE_EMULATOR_HOST is set (local development
 * and automated tests), the Admin SDK talks to the emulator and needs no
 * credentials.
 *
 * NOTE: Firebase Admin bypasses Firestore security rules. Authorization is
 * enforced in lib/repairs/store.ts and lib/repairs/server.ts, not by rules.
 */

const APP_NAME = "fix-district-admin";

export class FirebaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FirebaseConfigError";
  }
}

function projectId(): string | undefined {
  return (
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    undefined
  );
}

function createApp(): App {
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    // The emulator needs no credentials. (Offline, the SDK may log a harmless
    // "MetadataLookupWarning" while it looks for some.)
    return initializeApp({ projectId: projectId() ?? "demo-fix-district" }, APP_NAME);
  }

  const id = projectId();
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Private keys pasted into .env files usually carry literal "\n" sequences.
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!id || !clientEmail || !privateKey) {
    throw new FirebaseConfigError(
      "Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY (see .env.example).",
    );
  }

  // Fail early, with a message that says what to fix, instead of the SDK's
  // generic "app/invalid-credential". Messages here never include values.
  try {
    createPrivateKey(privateKey);
  } catch {
    throw new FirebaseConfigError(
      "FIREBASE_PRIVATE_KEY is not a valid PEM private key. Copy private_key from the service account JSON exactly: it must start with -----BEGIN PRIVATE KEY----- and end with -----END PRIVATE KEY-----\\n, with nothing after it (see .env.example).",
    );
  }

  // Firebase-generated service accounts are named <name>@<project-id>.iam.gserviceaccount.com.
  const accountProject = clientEmail.split("@")[1]?.split(".")[0];
  if (accountProject && accountProject !== id) {
    console.warn(
      "[firebase] FIREBASE_PROJECT_ID does not match the project in FIREBASE_CLIENT_EMAIL. Check both come from the same Firebase project.",
    );
  }

  return initializeApp(
    { credential: cert({ projectId: id, clientEmail, privateKey }) },
    APP_NAME,
  );
}

let firestore: Firestore | undefined;

/** The shared Firestore instance. Throws FirebaseConfigError if unconfigured. */
export function getAdminFirestore(): Firestore {
  if (!firestore) {
    const existing = getApps().find((app) => app.name === APP_NAME);
    firestore = getFirestore(existing ?? createApp());
  }
  return firestore;
}
