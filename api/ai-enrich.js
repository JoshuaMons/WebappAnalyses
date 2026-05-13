module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { payload, model, apiKey } = req.body || {};
    const effectiveApiKey = process.env.OPENAI_API_KEY || apiKey;
    if (!effectiveApiKey) {
      res.status(400).json({ error: "Missing OpenAI API key" });
      return;
    }

    const allowedModels = new Set(["gpt-4o", "gpt-4o-mini"]);
    const selectedModel = allowedModels.has(model) ? model : "gpt-4o";
    const serializedPayload = JSON.stringify(payload || []);
    if (serializedPayload.length > 60000) {
      res.status(413).json({ error: "AI enrichment payload is too large" });
      return;
    }

    const prompt = `Return strict JSON with keys: insights (array), issue_labels (object). Input: ${serializedPayload}`;
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${effectiveApiKey}`
      },
      body: JSON.stringify({
        model: selectedModel,
        temperature: 0.2,
        max_tokens: 1200,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are a support analytics assistant. Output valid JSON only." },
          { role: "user", content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const text = await response.text();
      res.status(response.status).json({ error: text || "OpenAI request failed" });
      return;
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: error.message || "AI proxy failed" });
  }
};
