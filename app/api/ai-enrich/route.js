export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { payload, model, apiKey } = body || {};
    const effectiveApiKey = process.env.OPENAI_API_KEY || apiKey;
    if (!effectiveApiKey) {
      return Response.json({ error: "Missing OpenAI API key" }, { status: 400 });
    }

    const prompt = `Return strict JSON with keys: insights (array), issue_labels (object). Input: ${JSON.stringify(payload || [])}`;
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${effectiveApiKey}`
      },
      body: JSON.stringify({
        model: model || "gpt-5.2",
        input: [
          { role: "system", content: "You are a support analytics assistant. Output valid JSON only." },
          { role: "user", content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return Response.json({ error: text || "OpenAI request failed" }, { status: response.status });
    }

    const data = await response.json();
    return Response.json(data, { status: 200 });
  } catch (error) {
    return Response.json({ error: error?.message || "AI proxy failed" }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ error: "Method not allowed" }, { status: 405 });
}
