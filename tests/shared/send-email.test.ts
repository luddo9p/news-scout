import { describe, it, expect, vi } from "vitest";
import {
  buildEmailHtml,
  makeEmailSubject,
} from "../../src/shared/send-email.js";
import type { EmailBranding } from "../../src/shared/types.js";

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi
        .fn()
        .mockResolvedValue({ data: { id: "email-123" }, error: null }),
    },
  })),
}));

import { sendEmail } from "../../src/shared/send-email.js";

const SCOUT_BRANDING: EmailBranding = {
  title: "Agent Scout",
  subjectPrefix: "Agent Scout",
  footerSources: "Bluesky · Hacker News · Reddit · X/Twitter",
};

const LUXE_BRANDING: EmailBranding = {
  title: "Luxe Digital Scout",
  subjectPrefix: "Luxe Digital",
  footerSources: "Luxury Daily · Reddit · X/Twitter · RSS",
};

describe("buildEmailHtml", () => {
  it("should use custom branding title", () => {
    const content = "<h2>Tendances</h2><p>Test item</p>";
    const html = buildEmailHtml(
      content,
      new Date("2024-12-01T10:00:00Z"),
      LUXE_BRANDING,
    );

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Luxe Digital Scout");
    expect(html).not.toContain("Agent Scout");
  });

  it("should use custom footer sources", () => {
    const content = "<p>Test</p>";
    const html = buildEmailHtml(content, new Date(), LUXE_BRANDING);

    expect(html).toContain("Luxury Daily · Reddit · X/Twitter · RSS");
  });

  it("should work with original scout branding", () => {
    const content = "<p>Test</p>";
    const html = buildEmailHtml(content, new Date(), SCOUT_BRANDING);

    expect(html).toContain("Agent Scout");
    expect(html).toContain("Bluesky · Hacker News · Reddit · X/Twitter");
  });
});

describe("makeEmailSubject", () => {
  it("should format subject with custom prefix", () => {
    const subject = makeEmailSubject(
      new Date("2024-12-01T10:00:00Z"),
      LUXE_BRANDING,
    );

    expect(subject).toContain("Luxe Digital");
    expect(subject).toContain("Veille du");
  });

  it("should format subject with scout prefix", () => {
    const subject = makeEmailSubject(
      new Date("2024-12-01T10:00:00Z"),
      SCOUT_BRANDING,
    );

    expect(subject).toContain("Agent Scout");
  });
});

describe("sendEmail", () => {
  it("should call Resend and return success", async () => {
    const result = await sendEmail({
      htmlContent: "<h1>Test</h1>",
      subject: "Agent Scout - Test",
      from: "onboarding@resend.dev",
      to: "test@example.com",
      apiKey: "re_test_key",
    });

    expect(result.success).toBe(true);
    expect(result.id).toBe("email-123");
  });
});