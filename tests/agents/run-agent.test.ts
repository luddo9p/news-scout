import { describe, it, expect, vi, beforeEach } from "vitest";
import { runAgent } from "../../src/shared/run-agent.js";
import type { AgentConfig, SourceResult } from "../../src/shared/types.js";

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi
        .fn()
        .mockResolvedValue({ data: { id: "email-123" }, error: null }),
    },
  })),
}));

const VALID_JSON = JSON.stringify({
  sections: [
    {
      title: "À lire absolument",
      type: "standard",
      items: [
        {
          title: "Test Article",
          url: "https://example.com/test",
          context: "Important article",
          source: "Hacker News",
        },
      ],
    },
  ],
});

const MOCK_CONFIG: AgentConfig = {
  name: "test-agent",
  sources: [
    async () =>
      ({
        source: "Test Source",
        items: [
          {
            title: "Test Item",
            url: "https://example.com",
            context: "Test summary",
            source: "Test Source",
          },
        ],
      }) as SourceResult,
  ],
  systemPrompt: "Tu es un agent de test.",
  emailBranding: {
    title: "Test Agent",
    subjectPrefix: "Test",
    footerSources: "Test Source",
  },
};

describe("runAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VPS_URL = "http://localhost:3000";
    process.env.API_KEY = "test-key";
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_TO = "test@example.com";
    process.env.RESEND_FROM = "test@resend.dev";
  });

  it("should return error when no content fetched", async () => {
    const emptyConfig: AgentConfig = {
      ...MOCK_CONFIG,
      sources: [
        async () => ({ source: "Empty", items: [] }) as SourceResult,
      ],
    };

    const result = await runAgent(emptyConfig);

    expect(result.success).toBe(false);
    expect(result.emailSent).toBe(false);
  });

  it("should call synthesize with the agent's systemPrompt", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ content: VALID_JSON }), { status: 200 }),
    );

    const result = await runAgent(MOCK_CONFIG);

    const fetchCall = vi.mocked(globalThis.fetch).mock.calls[0];
    const options = fetchCall[1] as RequestInit;
    const body = JSON.parse(options.body as string);
    expect(body.systemPrompt).toBe("Tu es un agent de test.");
  });

  it("should return error when VPS_URL is missing", async () => {
    delete process.env.VPS_URL;

    const result = await runAgent(MOCK_CONFIG);

    expect(result.success).toBe(false);
    expect(result.errors).toContain("Missing VPS_URL");
  });

  it("should return error when Ollama synthesis fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "Server error" }), { status: 500 }),
    );

    const result = await runAgent(MOCK_CONFIG);

    expect(result.success).toBe(false);
    expect(result.errors[0]).toContain("Ollama synthesis failed");
  });

  it("should return error when RESEND_API_KEY is missing", async () => {
    delete process.env.RESEND_API_KEY;

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ content: VALID_JSON }), { status: 200 }),
    );

    const result = await runAgent(MOCK_CONFIG);

    expect(result.success).toBe(false);
    expect(result.errors).toContain("Missing Resend configuration");
  });

  it("should handle a source failure gracefully", async () => {
    const failingConfig: AgentConfig = {
      ...MOCK_CONFIG,
      sources: [
        async () =>
          ({
            source: "Good Source",
            items: [
              {
                title: "Good Item",
                url: "https://example.com/good",
                context: "Good summary",
                source: "Good Source",
              },
            ],
          }) as SourceResult,
        async () => {
          throw new Error("Source down");
        },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ content: VALID_JSON }), { status: 200 }),
    );

    const result = await runAgent(failingConfig);

    expect(result.sourcesFetched).toBe(1);
    expect(result.sourcesFailed).toBe(1);
    expect(result.success).toBe(true);
    expect(result.emailSent).toBe(true);
  });

  it("should succeed on happy path", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ content: VALID_JSON }), { status: 200 }),
    );

    const result = await runAgent(MOCK_CONFIG);

    expect(result.success).toBe(true);
    expect(result.emailSent).toBe(true);
    expect(result.sourcesFetched).toBe(1);
    expect(result.sourcesFailed).toBe(0);
  });
});