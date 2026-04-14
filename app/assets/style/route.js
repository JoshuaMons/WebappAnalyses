import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

export async function GET() {
  try {
    const cssPath = path.join(process.cwd(), "style.css");
    const css = await readFile(cssPath, "utf8");
    return new Response(css, {
      status: 200,
      headers: {
        "Content-Type": "text/css; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return Response.json(
      { error: error?.message || "Failed to load stylesheet" },
      { status: 500 }
    );
  }
}
