import { describe, expect, it } from "vitest";
import {
  LIMITS,
  isValidRepairId,
  isValidRequestKey,
  validateRepairInput,
} from "@/lib/repairs/schema";

const valid = {
  deviceType: "phone",
  brand: "Apple",
  model: "iPhone 13",
  description: "The screen is cracked and the touch input is unreliable.",
};

describe("validateRepairInput", () => {
  it("accepts a complete request", () => {
    const result = validateRepairInput(valid);
    expect(result).toEqual({ ok: true, data: valid });
  });

  it("accepts every supported device type", () => {
    for (const deviceType of ["phone", "laptop", "tablet", "console"]) {
      expect(validateRepairInput({ ...valid, deviceType }).ok).toBe(true);
    }
  });

  it("rejects unknown or missing device types", () => {
    for (const deviceType of ["watch", "PHONE", "", undefined, 3, ["phone"]]) {
      const result = validateRepairInput({ ...valid, deviceType });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.errors.deviceType).toBeTruthy();
    }
  });

  it("requires brand, model, and description", () => {
    const result = validateRepairInput({ deviceType: "phone" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual([
        "brand",
        "description",
        "model",
      ]);
    }
  });

  it("treats whitespace-only text as empty", () => {
    const result = validateRepairInput({ ...valid, brand: "   ", model: "\n\t" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.brand && result.errors.model).toBeTruthy();
  });

  it("trims and collapses whitespace in single-line fields", () => {
    const result = validateRepairInput({
      ...valid,
      brand: "  Apple  ",
      model: "iPhone    13  Pro",
    });
    expect(result.ok && result.data.brand).toBe("Apple");
    expect(result.ok && result.data.model).toBe("iPhone 13 Pro");
  });

  it("keeps line breaks in the description and strips control characters", () => {
    const result = validateRepairInput({
      ...valid,
      description: "Line one is long enough.\r\nLine two\u0000\u0007 here.",
    });
    expect(result.ok && result.data.description).toBe(
      "Line one is long enough.\nLine two here.",
    );
  });

  it("enforces maximum lengths", () => {
    const brand = validateRepairInput({
      ...valid,
      brand: "a".repeat(LIMITS.brand.max + 1),
    });
    const model = validateRepairInput({
      ...valid,
      model: "a".repeat(LIMITS.model.max + 1),
    });
    const description = validateRepairInput({
      ...valid,
      description: "a".repeat(LIMITS.description.max + 1),
    });
    expect(brand.ok || model.ok || description.ok).toBe(false);
    expect(!brand.ok && brand.errors.brand).toBeTruthy();
    expect(!model.ok && model.errors.model).toBeTruthy();
    expect(!description.ok && description.errors.description).toBeTruthy();
  });

  it("accepts values exactly at the limits", () => {
    const result = validateRepairInput({
      ...valid,
      brand: "a".repeat(LIMITS.brand.max),
      model: "a".repeat(LIMITS.model.max),
      description: "a".repeat(LIMITS.description.max),
    });
    expect(result.ok).toBe(true);
  });

  it("enforces a minimum description length", () => {
    const result = validateRepairInput({
      ...valid,
      description: "a".repeat(LIMITS.description.min - 1),
    });
    expect(result.ok).toBe(false);
    expect(
      validateRepairInput({
        ...valid,
        description: "a".repeat(LIMITS.description.min),
      }).ok,
    ).toBe(true);
  });

  it("ignores non-string values such as files or objects", () => {
    const result = validateRepairInput({
      deviceType: "phone",
      brand: { toString: () => "Apple" },
      model: 12345,
      description: ["not", "a", "string"],
    });
    expect(result.ok).toBe(false);
  });

  it("never passes unknown fields (owner, status, timestamps) through", () => {
    const forged = {
      ...valid,
      ownerId: "user_attacker",
      status: "completed",
      createdAt: "1999-01-01T00:00:00Z",
      role: "technician",
    };
    const result = validateRepairInput(forged);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(Object.keys(result.data).sort()).toEqual([
        "brand",
        "description",
        "deviceType",
        "model",
      ]);
    }
  });

  it("returns the cleaned values so a form can be refilled", () => {
    const result = validateRepairInput({ ...valid, brand: "", model: " X " });
    expect(!result.ok && result.values.model).toBe("X");
    expect(!result.ok && result.values.description).toBe(valid.description);
  });
});

describe("identifier validation", () => {
  it("accepts only UUID request keys", () => {
    expect(isValidRequestKey("3f2b1c3e-9d0a-4c52-8a52-0a3f6a2f4b11")).toBe(true);
    for (const bad of ["", "abc", "../../x", 123, null, undefined]) {
      expect(isValidRequestKey(bad)).toBe(false);
    }
  });

  it("accepts only 40-character lowercase hex repair IDs", () => {
    expect(isValidRepairId("a".repeat(40))).toBe(true);
    for (const bad of [
      "A".repeat(40),
      "a".repeat(39),
      "a".repeat(41),
      "a/b",
      "..",
      "",
      "a".repeat(39) + "/",
      42,
    ]) {
      expect(isValidRepairId(bad)).toBe(false);
    }
  });
});