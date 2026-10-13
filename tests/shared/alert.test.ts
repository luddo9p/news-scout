import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi
        .fn()
        .mockResolvedValue({ data: { id: "alert-123" }, error: null }),
    },
  })),
}));

import { Resend } from "resend";
import { sendFailureAlert } from "../../src/shared/alert.js";

interface SentPayload {
  subject: string;
  html: string;
  to: string;
  from: string;
}

/** Reads the payload of the last send call, whatever instance Resend returned. */
function lastPayload(): SentPayload | undefined {
  const results = vi.mocked(Resend).mock.results;
  const instance = results.at(-1)?.value as
    | { emails: { send: { mock: { calls: [SentPayload][] } } } }
    | undefined;
  return instance?.emails.send.mock.calls.at(-1)?.[0];
}

describe("sendFailureAlert", () => {
  beforeEach(() => {
    // clearAllMocks, not restoreAllMocks: restoring wipes the module mock's
    // implementation and every later `new Resend()` would return undefined.
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_TO = "veille@example.com";
    process.env.RESEND_FROM = "onboarding@resend.dev";
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_TO;
    delete process.env.RESEND_FROM;
  });

  it("should name the agent and list the errors", async () => {
    await sendFailureAlert("tech-ai", ['Unknown agent: "--agent"']);

    const payload = lastPayload();

    expect(payload?.subject).toContain("tech-ai");
    expect(payload?.html).toContain("Unknown agent");
    expect(payload?.to).toBe("veille@example.com");
  });

  it("should escape the error text", async () => {
    await sendFailureAlert("tech-ai", ["<script>alert(1)</script>"]);

    const payload = lastPayload();

    expect(payload?.html).not.toContain("<script>");
    expect(payload?.html).toContain("&lt;script&gt;");
  });

  it("should still warn when the run gave no detail", async () => {
    await sendFailureAlert("luxe-digital", []);

    expect(lastPayload()?.html).toContain("Aucun detail fourni par le run.");
  });

  it("should stay silent without a Resend key", async () => {
    delete process.env.RESEND_API_KEY;

    await sendFailureAlert("tech-ai", ["boom"]);

    expect(Resend).not.toHaveBeenCalled();
  });

  it("should stay silent without a recipient", async () => {
    delete process.env.RESEND_TO;

    await sendFailureAlert("tech-ai", ["boom"]);

    expect(Resend).not.toHaveBeenCalled();
  });

  it("should never throw when the send fails", async () => {
    vi.mocked(Resend).mockImplementationOnce(
      () =>
        ({
          emails: {
            send: vi.fn().mockRejectedValue(new Error("Resend down")),
          },
        }) as unknown as Resend,
    );

    await expect(sendFailureAlert("tech-ai", ["boom"])).resolves.toBeUndefined();
  });
});
