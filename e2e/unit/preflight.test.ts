import { describe, expect, it } from "vitest";
import { assertHubDescribesFirestore, assertNoLeftoverRequests, MAX_LEFTOVER_REQUESTS } from "../support/preflight";
import { E2ESafetyError } from "../support/safety";

// A trimmed copy of what the emulator hub returns for GET /emulators.
const hubWithFirestore = (host: string, port: number) => ({
  hub: { name: "hub", host: "127.0.0.1", port: 4401 },
  firestore: { name: "firestore", host, port, pid: 1, webSocketPort: 9151 },
});

describe("assertHubDescribesFirestore", () => {
  it("accepts a hub that reports Firestore on the configured loopback port", () => {
    expect(() =>
      assertHubDescribesFirestore(hubWithFirestore("127.0.0.1", 8086), "127.0.0.1:8086"),
    ).not.toThrow();
  });

  it("refuses a hub that reports Firestore on a different port (another emulator)", () => {
    expect(() =>
      assertHubDescribesFirestore(hubWithFirestore("127.0.0.1", 8085), "127.0.0.1:8086"),
    ).toThrow(E2ESafetyError);
  });

  it("refuses a Firestore emulator that is not on a loopback address", () => {
    expect(() =>
      assertHubDescribesFirestore(hubWithFirestore("10.0.0.5", 8086), "127.0.0.1:8086"),
    ).toThrow(/loopback/);
  });

  it.each([
    ["no firestore entry", { hub: { port: 4401 } }],
    ["a null payload", null],
    ["a string payload", "Ok"],
    ["an array payload", []],
  ])("refuses %s", (_name, payload) => {
    expect(() => assertHubDescribesFirestore(payload, "127.0.0.1:8086")).toThrow(E2ESafetyError);
  });

  it("does not put the configured host or port into the message", () => {
    try {
      assertHubDescribesFirestore(hubWithFirestore("127.0.0.1", 8085), "127.0.0.1:8086");
      throw new Error("expected a throw");
    } catch (error) {
      expect((error as Error).message).not.toMatch(/8085|8086|127\.0\.0\.1/);
    }
  });
});

describe("assertNoLeftoverRequests", () => {
  it("accepts a clean emulator and one at the limit", async () => {
    await expect(assertNoLeftoverRequests({ totalRepairs: async () => 0 })).resolves.toBeUndefined();
    await expect(
      assertNoLeftoverRequests({ totalRepairs: async () => MAX_LEFTOVER_REQUESTS }),
    ).resolves.toBeUndefined();
  });

  it("refuses an emulator over the limit, without wiping anything", async () => {
    await expect(
      assertNoLeftoverRequests({ totalRepairs: async () => MAX_LEFTOVER_REQUESTS + 1 }),
    ).rejects.toThrow(E2ESafetyError);
  });
});
