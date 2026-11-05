import { describe, expect, it } from "vitest";
// Pure guard module (no I/O, no imports). Run with `npm run test:unit -w @fix-district/e2e`.
import {
  E2ESafetyError,
  assertClerkTestKeys,
  assertDedicatedClerkApp,
  assertEmulatorOnly,
  assertLocalBaseUrl,
  frameworkUserTag,
  isTaggedForRun,
  publishableKeyHost,
} from "../support/safety";

const keyFor = (host: string, kind: "test" | "live" = "test") =>
  `pk_${kind}_${Buffer.from(`${host}$`).toString("base64")}`;

describe("assertEmulatorOnly", () => {
  it("accepts a loopback host with an explicit port and a demo- project", () => {
    expect(() => assertEmulatorOnly("127.0.0.1:8086", "demo-fix-district-e2e")).not.toThrow();
    expect(() => assertEmulatorOnly("localhost:8086", "demo-x")).not.toThrow();
  });

  it.each(["firestore.googleapis.com:443", "10.0.0.5:8086", "example.com:8086"])(
    "refuses the non-loopback host %s",
    (host) => {
      expect(() => assertEmulatorOnly(host, "demo-x")).toThrow(E2ESafetyError);
    },
  );

  it("refuses a missing port", () => {
    expect(() => assertEmulatorOnly("127.0.0.1", "demo-x")).toThrow(E2ESafetyError);
  });

  it("refuses a project that is not a demo- project", () => {
    expect(() => assertEmulatorOnly("127.0.0.1:8086", "my-real-project")).toThrow(E2ESafetyError);
  });
});

describe("assertLocalBaseUrl", () => {
  it("accepts loopback URLs only", () => {
    expect(() => assertLocalBaseUrl("http://localhost:3100")).not.toThrow();
    expect(() => assertLocalBaseUrl("http://127.0.0.1:3100")).not.toThrow();
    expect(() => assertLocalBaseUrl("https://fix-district.example.com")).toThrow(E2ESafetyError);
    expect(() => assertLocalBaseUrl("not a url")).toThrow(E2ESafetyError);
  });
});

describe("assertClerkTestKeys", () => {
  it("accepts development keys", () => {
    expect(() => assertClerkTestKeys("pk_test_abc", "sk_test_abc")).not.toThrow();
  });

  it("refuses production keys, in either position", () => {
    expect(() => assertClerkTestKeys("pk_live_abc", "sk_test_abc")).toThrow(E2ESafetyError);
    expect(() => assertClerkTestKeys("pk_test_abc", "sk_live_abc")).toThrow(E2ESafetyError);
  });
});

describe("publishableKeyHost", () => {
  it("decodes the Frontend API host", () => {
    expect(publishableKeyHost(keyFor("quiet-owl-12.clerk.accounts.dev"))).toBe(
      "quiet-owl-12.clerk.accounts.dev",
    );
  });

  it("returns null for garbage", () => {
    expect(publishableKeyHost("pk_test_replace_me")).toBeNull();
  });
});

describe("assertDedicatedClerkApp", () => {
  const key = keyFor("quiet-owl-12.clerk.accounts.dev");

  it("accepts a matching confirmation and a key different from the app's own", () => {
    expect(() =>
      assertDedicatedClerkApp({
        publishableKey: key,
        confirmedFrontendApi: "https://Quiet-Owl-12.clerk.accounts.dev/",
        localAppPublishableKey: keyFor("other-app-99.clerk.accounts.dev"),
      }),
    ).not.toThrow();
  });

  it("refuses a confirmation that does not match the key", () => {
    expect(() =>
      assertDedicatedClerkApp({
        publishableKey: key,
        confirmedFrontendApi: "something-else.clerk.accounts.dev",
      }),
    ).toThrow(E2ESafetyError);
  });

  it("refuses the key the app itself uses", () => {
    expect(() =>
      assertDedicatedClerkApp({
        publishableKey: key,
        confirmedFrontendApi: "quiet-owl-12.clerk.accounts.dev",
        localAppPublishableKey: key,
      }),
    ).toThrow(E2ESafetyError);
  });

  it("refuses an unreadable key", () => {
    expect(() =>
      assertDedicatedClerkApp({
        publishableKey: "pk_test_replace_me",
        confirmedFrontendApi: "x.clerk.accounts.dev",
      }),
    ).toThrow(E2ESafetyError);
  });
});

describe("isTaggedForRun", () => {
  const tag = frameworkUserTag("abc123", "quiet-owl-12.clerk.accounts.dev");

  it("accepts only this run's tag for this application", () => {
    expect(isTaggedForRun({ e2e: tag }, "abc123", "quiet-owl-12.clerk.accounts.dev")).toBe(true);
  });

  it("refuses another run, another application, or no tag", () => {
    const host = "quiet-owl-12.clerk.accounts.dev";
    expect(isTaggedForRun({ e2e: tag }, "zzz999", host)).toBe(false);
    expect(isTaggedForRun({ e2e: tag }, "abc123", "other.clerk.accounts.dev")).toBe(false);
    expect(isTaggedForRun({}, "abc123", host)).toBe(false);
    expect(isTaggedForRun(null, "abc123", host)).toBe(false);
    expect(isTaggedForRun({ e2e: { ...tag, framework: "something" } }, "abc123", host)).toBe(false);
  });
});
