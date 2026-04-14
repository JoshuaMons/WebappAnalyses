import { readFile } from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

function isLfsPointer(bytes) {
  const header = new TextDecoder("utf-8").decode(bytes.subarray(0, Math.min(bytes.length, 120))).trim();
  return header.startsWith("version https://git-lfs.github.com/spec/v1");
}

function isSqlite(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 16) return false;
  const signature = new TextDecoder("utf-8").decode(bytes.subarray(0, 16));
  return signature === "SQLite format 3\u0000";
}

async function loadLocalDatabaseBytes() {
  const candidates = [
    path.join(process.cwd(), "data", "fontys_cgny.db"),
    path.join(process.cwd(), "public", "data", "fontys_cgny.db")
  ];
  for (const candidate of candidates) {
    try {
      const raw = await readFile(candidate);
      const bytes = new Uint8Array(raw);
      if (isLfsPointer(bytes)) continue;
      if (!isSqlite(bytes)) continue;
      return bytes;
    } catch {
      // Try next candidate.
    }
  }
  return null;
}

export async function GET() {
  const remoteDbUrl = process.env.SUPPORT_ANALYTICS_DB_URL;
  if (remoteDbUrl) {
    try {
      const upstream = await fetch(remoteDbUrl, { cache: "no-store" });
      if (upstream.ok) {
        const bytes = new Uint8Array(await upstream.arrayBuffer());
        if (isLfsPointer(bytes)) {
          return Response.json(
            { error: "Remote URL returned a Git LFS pointer instead of database content" },
            { status: 502 }
          );
        }
        if (!isSqlite(bytes)) {
          return Response.json(
            { error: "Remote URL did not return a valid SQLite database file" },
            { status: 502 }
          );
        }
        return new Response(bytes, {
          status: 200,
          headers: {
            "Content-Type": "application/octet-stream",
            "Cache-Control": "no-store"
          }
        });
      }
    } catch {
      // Fall back to local file resolution below.
    }
  }

  const localBytes = await loadLocalDatabaseBytes();
  if (localBytes) {
    return new Response(localBytes, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "no-store"
      }
    });
  }

  return Response.json(
    {
      error:
        "No valid database source found. Configure SUPPORT_ANALYTICS_DB_URL or include a non-LFS local data/fontys_cgny.db file."
    },
    { status: 404 }
  );
}
