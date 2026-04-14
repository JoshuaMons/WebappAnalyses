import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

export async function GET() {
  try {
    const htmlPath = path.join(process.cwd(), "index.html");
    const rawHtml = await readFile(htmlPath, "utf8");
    const patchedHtml = rawHtml
      .replace('href="style.css"', 'href="/assets/style"')
      .replace('src="app.large.js" defer', 'src="/assets/app-large" defer');

    return new Response(patchedHtml, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return Response.json(
      { error: error?.message || "Failed to load dashboard template" },
      { status: 500 }
    );
  }
}
