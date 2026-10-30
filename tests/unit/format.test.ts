import { describe, expect, it } from "vitest";
import {
  deviceName,
  formatSubmitted,
  referenceCode,
} from "@/components/repairs/format";

describe("repair display formatting", () => {
  it("formats timestamps in an explicit time zone", () => {
    expect(formatSubmitted("2026-10-29T16:05:00.000Z")).toBe("Oct 29, 2026, 4:05 PM UTC");
  });

  it("builds a device name and a short reference", () => {
    expect(deviceName({ brand: "Apple", model: "iPhone 13" })).toBe("Apple iPhone 13");
    expect(referenceCode("abcdef0123456789abcdef0123456789abcdef01")).toBe("ABCDEF01");
  });
});