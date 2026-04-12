import { describe, it, expect, vi, beforeEach } from "vitest";
import { buildEmailHtml } from "../src/send-email.js";

// We test sendEmail by mocking the Resend module
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi
        .fn()
        .mockResolvedValue({ data: { id: "email-123" }, error: null }),
    },
  })),
}));

import { sendEmail } from "../src/send-email.js";

describe("buildEmailHtml", () => {
  it("should wrap content in a complete HTML email", () => {
    const content = "<h2>À lire absolument</h2><p>Test item</p>";
    const html = buildEmailHtml(content, new Date("2024-12-01T10:00:00Z"));

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("Agent Scout");
    expect(html).toContain("À lire absolument");
    expect(html).toContain("style=");
  });

  it("should include all 3 sections when present", () => {
    const content = `
      <h2>À lire absolument</h2><p>Item 1</p>
      <h2>Nouveaux Outils</h2><p>Item 2</p>
      <h2>Tendances</h2><p>Item 3</p>
    `;
    const html = buildEmailHtml(content, new Date());

    expect(html).toContain("À lire absolument");
    expect(html).toContain("Nouveaux Outils");
    expect(html).toContain("Tendances");
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
