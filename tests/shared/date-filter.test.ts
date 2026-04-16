import { describe, it, expect, vi } from "vitest";
import { getSinceTimestamp } from "../../src/shared/date-filter.js";

describe("getSinceTimestamp", () => {
  it("should return iso, unix, and date properties", () => {
    const result = getSinceTimestamp();

    expect(result).toHaveProperty("iso");
    expect(result).toHaveProperty("unix");
    expect(result).toHaveProperty("date");
  });

  it("should return a valid ISO 8601 string", () => {
    const { iso } = getSinceTimestamp();

    // ISO 8601 format: YYYY-MM-DDTHH:mm:ss.sssZ
    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("should return a unix timestamp roughly 24h ago", () => {
    const { unix } = getSinceTimestamp();
    const now = Math.floor(Date.now() / 1000);
    const expected = now - 86400;

    // Allow 5 seconds tolerance
    expect(unix).toBeGreaterThanOrEqual(expected - 5);
    expect(unix).toBeLessThanOrEqual(expected + 5);
  });

  it("should return a date string in YYYY-MM-DD format", () => {
    const { date } = getSinceTimestamp();

    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("should have all three formats represent the same point in time", () => {
    const { iso, unix, date } = getSinceTimestamp();

    const fromIso = new Date(iso).getTime() / 1000;
    const fromUnix = unix;

    expect(Math.abs(fromIso - fromUnix)).toBeLessThan(1);
    expect(iso).toContain(date);
  });
});