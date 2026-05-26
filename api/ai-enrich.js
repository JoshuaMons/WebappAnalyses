module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { payload, apiKey } = req.body || {};
    const effectiveApiKey = process.env.ANTHROPIC_API_KEY || apiKey;
    if (!effectiveApiKey) {
      res.status(400).json({ error: "Missing Anthropic API key" });
      return;
    }

    const serializedPayload = JSON.stringify(payload || []);
    if (serializedPayload.length > 60000) {
      res.status(413).json({ error: "AI enrichment payload is too large" });
      return;
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": effectiveApiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        system: "You are a support analytics assistant. Output valid JSON only with keys: insights (array of strings), issue_labels (object mapping issue key to human-readable label).",
        messages: [
          {
            role: "user",
            content: `Return strict JSON with keys: insights (array), issue_labels (object). Input: ${serializedPayload}`
          }
        ]
      })
    });

    if (!response.ok) {
      const text = await response.text();
      res.status(response.status).json({ error: text || "Anthropic API request failed" });
      return;
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message || "AI proxy failed" });
  }
};
