module.exports = async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const remoteDbUrl = process.env.SUPPORT_ANALYTICS_DB_URL;
  if (!remoteDbUrl) {
    res.status(404).json({
      error: "SUPPORT_ANALYTICS_DB_URL is not configured"
    });
    return;
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(remoteDbUrl);
  } catch {
    res.status(500).json({ error: "SUPPORT_ANALYTICS_DB_URL is not a valid URL" });
    return;
  }
  if (parsedUrl.protocol !== "https:") {
    res.status(500).json({ error: "SUPPORT_ANALYTICS_DB_URL must use HTTPS" });
    return;
  }

  try {
    const upstream = await fetch(remoteDbUrl, { cache: "no-store" });
    if (!upstream.ok) {
      const details = await upstream.text().catch(() => "");
      res.status(upstream.status).json({
        error: `Failed to fetch remote database${details ? `: ${details.slice(0, 200)}` : ""}`
      });
      return;
    }

    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.setHeader("Content-Type", "application/octet-stream");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(buffer);
  } catch (error) {
    res.status(500).json({
      error: error.message || "Failed to proxy remote database"
    });
  }
};
