import { generateKeyPairSync } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  initializeApp: vi.fn(() => ({ name: "fix-district-admin" })),
  cert: vi.fn((value: unknown) => value),
  getFirestore: vi.fn(() => ({ fake: "firestore" })),
}));

vi.mock("firebase-admin/app", () => ({
  initializeApp: sdk.initializeApp,
  cert: sdk.cert,
  getApps: () => [],
}));
vi.mock("firebase-admin/firestore", () => ({ getFirestore: sdk.getFirestore }));

const realKey = generateKeyPairSync("rsa", { modulusLength: 2048 })
  .privateKey.export({ type: "pkcs8", format: "pem" })
  .toString();

const saved = { ...process.env };

async function load() {
  vi.resetModules();
  return import("@/lib/firebase/admin");
}

function configure(overrides: Record<string, string | undefined> = {}) {
  delete process.env.FIRESTORE_EMULATOR_HOST;
  process.env.FIREBASE_PROJECT_ID = "my-project";
  process.env.FIREBASE_CLIENT_EMAIL = "firebase-adminsdk-x@my-project.iam.gserviceaccount.com";
  // As it would arrive from a one-line .env value.
  process.env.FIREBASE_PRIVATE_KEY = realKey.replace(/\n/g, "\\n");
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

beforeEach(() => {
  sdk.initializeApp.mockClear();
  sdk.cert.mockClear();
});

afterEach(() => {
  process.env = { ...saved };
  vi.restoreAllMocks();
});

describe("Firebase Admin configuration", () => {
  it("initialises with a valid service account (escaped newlines are fine)", async () => {
    configure();
    const { getAdminFirestore } = await load();
    expect(getAdminFirestore()).toEqual({ fake: "firestore" });
    expect(sdk.cert).toHaveBeenCalledOnce();
  });

  it("reports missing settings without initialising", async () => {
    configure({ FIREBASE_PRIVATE_KEY: undefined });
    const { getAdminFirestore, FirebaseConfigError } = await load();
    expect(() => getAdminFirestore()).toThrow(FirebaseConfigError);
    expect(sdk.initializeApp).not.toHaveBeenCalled();
  });

  it("rejects a key with stray characters after the END marker, naming the setting", async () => {
    // The mistake that produced app/invalid-credential: a leftover backslash.
    configure({ FIREBASE_PRIVATE_KEY: realKey.trimEnd() + "\\" });
    const { getAdminFirestore, FirebaseConfigError } = await load();
    let thrown: unknown;
    try {
      getAdminFirestore();
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(FirebaseConfigError);
    expect((thrown as Error).message).toContain("FIREBASE_PRIVATE_KEY");
    expect(sdk.initializeApp).not.toHaveBeenCalled();
  });

  it("rejects a truncated or garbled key and never echoes it", async () => {
    const garbled = realKey.slice(0, 200);
    configure({ FIREBASE_PRIVATE_KEY: garbled });
    const { getAdminFirestore } = await load();
    let message = "";
    try {
      getAdminFirestore();
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("FIREBASE_PRIVATE_KEY");
    expect(message).not.toContain(garbled.slice(40, 80));
  });

  it("warns (without values) when the project ID and service account project differ", async () => {
    configure({ FIREBASE_PROJECT_ID: "another-project" });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { getAdminFirestore } = await load();
    getAdminFirestore();
    const logged = warn.mock.calls.flat().join(" ");
    expect(logged).toMatch(/does not match/);
    expect(logged).not.toContain("another-project");
    expect(logged).not.toContain("my-project");
  });

  it("does not warn when they match", async () => {
    configure();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { getAdminFirestore } = await load();
    getAdminFirestore();
    expect(warn).not.toHaveBeenCalled();
  });

  it("needs no credentials against the emulator", async () => {
    configure({
      FIRESTORE_EMULATOR_HOST: "127.0.0.1:8085",
      FIREBASE_CLIENT_EMAIL: undefined,
      FIREBASE_PRIVATE_KEY: undefined,
    });
    const { getAdminFirestore } = await load();
    expect(() => getAdminFirestore()).not.toThrow();
    expect(sdk.cert).not.toHaveBeenCalled();
  });
});