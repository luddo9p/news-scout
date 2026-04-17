import { describe, it, expect, vi } from "vitest";
import {
  buildEmailHtml,
  makeEmailSubject,
} from "../../src/shared/send-email.js";
import type { EmailBranding } from "../../src/shared/types.js";
import type { SynthesisData } from "../../src/shared/synthesis-schema.js";

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

const SAMPLE_DATA: SynthesisData = {
  sections: [
    {
      title: "À lire absolument",
      type: "standard",
      items: [
        {
          title: "Test Article",
          url: "https://example.com/test",
          context: "Un article important",
          source: "Hacker News",
        },
      ],
    },
  ],
};

describe("buildEmailHtml", () => {
  it("should use custom branding title", () => {
    const html = buildEmailHtml(
      SAMPLE_DATA,
      new Date("2024-12-01T10:00:00Z"),
      LUXE_BRANDING,
    );
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Luxe Digital Scout");
    expect(html).not.toContain("Agent Scout");
  });

  it("should use custom footer sources", () => {
    const html = buildEmailHtml(SAMPLE_DATA, new Date(), LUXE_BRANDING);
    expect(html).toContain("Luxury Daily · Reddit · X/Twitter · RSS");
  });

  it("should work with original scout branding", () => {
    const html = buildEmailHtml(SAMPLE_DATA, new Date(), SCOUT_BRANDING);
    expect(html).toContain("Agent Scout");
    expect(html).toContain("Bluesky · Hacker News · Reddit · X/Twitter");
  });

  it("should render synthesis data inside email template", () => {
    const html = buildEmailHtml(SAMPLE_DATA, new Date(), SCOUT_BRANDING);
    expect(html).toContain("Test Article");
    expect(html).toContain("https://example.com/test");
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