import express from "express";

const app = express();
app.use(express.json());

const OLLAMA_CLOUD_URL = process.env.OLLAMA_CLOUD_URL || "https://ollama.com";
const OLLAMA_API_KEY = process.env.OLLAMA_API_KEY;
const API_KEY = process.env.API_KEY;
const DEFAULT_MODEL = "glm-5.1:cloud";
const TIMEOUT_MS = 120000;

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// POST /generate — proxy to Ollama
app.post("/generate", async (req, res) => {
  // API key check
  if (API_KEY && req.headers["x-api-key"] !== API_KEY) {
    return res.status(401).json({ error: "Invalid or missing API key" });
  }

  const { prompt, systemPrompt, model } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Missing 'prompt' in body" });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const response = await fetch(`${OLLAMA_CLOUD_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OLLAMA_API_KEY}`,
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: model || DEFAULT_MODEL,
        messages: [
          { role: "system", content: systemPrompt || "" },
          { role: "user", content: prompt },
        ],
        stream: false,
      }),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errorBody = await response.text();
      return res.status(502).json({
        error: `Ollama error ${response.status}`,
        details: errorBody,
      });
    }

    const data = await response.json();

    // Ollama chat non-streaming response: { message: { content: "..." } , ... }
    const content = data.message?.content || data.response;
    if (!content || content.trim().length === 0) {
      return res.status(502).json({ error: "Ollama returned empty content" });
    }

    return res.json({ content });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return res.status(504).json({ error: "Ollama request timeout" });
    }
    return res.status(500).json({
      error: "Internal server error",
      details: err instanceof Error ? err.message : String(err),
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`[API Bridge] Listening on port ${PORT}`);
  console.log(`[API Bridge] Ollama Cloud URL: ${OLLAMA_CLOUD_URL}`);
  console.log(`[API Bridge] Model: ${DEFAULT_MODEL}`);
  console.log(
    `[API Bridge] API key: ${API_KEY ? "configured" : "none (open access)"}`,
  );
});
