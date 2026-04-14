import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

export async function GET() {
  try {
    const jsPath = path.join(process.cwd(), "app.large.js");
    const source = await readFile(jsPath, "utf8");
    return new Response(source, {
      status: 200,
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return Response.json(
      { error: error?.message || "Failed to load app script" },
      { status: 500 }
    );
  }
}
