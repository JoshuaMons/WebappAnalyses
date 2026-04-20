#!/usr/bin/env python3
"""
Import a SQL dump (SQLite dialect) into a SQLite .db file.

This is meant for large dumps where loading the entire file into memory is not feasible.

Example:
  python scripts/import_sql_dump_to_sqlite.py --input "C:\\Users\\Josh\\Downloads\\Essent\\essent_dump.sql" --output data\\essent.db
"""

from __future__ import annotations

import argparse
import pathlib
import sqlite3
import sys
import time


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import SQL dump into SQLite DB (streaming)")
    parser.add_argument("--input", required=True, help="Path to input .sql dump")
    parser.add_argument("--output", required=True, help="Path to output .db file")
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Overwrite output .db if it exists",
    )
    parser.add_argument(
        "--commit-every",
        type=int,
        default=25_000,
        help="Commit after N executed statements (default: 25000)",
    )
    return parser.parse_args()


def normalize_statement(sql: str) -> str:
    s = sql.strip()
    if not s:
        return ""
    # Avoid nested transactions from dumps created by SQLite.
    upper = s.upper()
    if upper.startswith("BEGIN " ) or upper == "BEGIN" or upper.startswith("BEGIN;"):
        return ""
    if upper.startswith("COMMIT") or upper.startswith("END"):
        return ""
    if upper.startswith("PRAGMA "):
        return ""
    return s


def main() -> int:
    args = parse_args()
    input_path = pathlib.Path(args.input).expanduser().resolve()
    output_path = pathlib.Path(args.output).expanduser().resolve()

    if not input_path.exists():
        print(f"Input file not found: {input_path}", file=sys.stderr)
        return 1

    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists():
        if not args.overwrite:
            print(f"Output already exists (use --overwrite): {output_path}", file=sys.stderr)
            return 2
        output_path.unlink()

    started = time.time()
    conn = sqlite3.connect(str(output_path))
    try:
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA synchronous=OFF;")
        conn.execute("PRAGMA temp_store=MEMORY;")
        conn.execute("PRAGMA cache_size=-200000;")  # ~200MB cache (negative = KiB)
        conn.execute("PRAGMA foreign_keys=OFF;")

        pending: list[str] = []
        executed = 0

        conn.execute("BEGIN;")
        with input_path.open("r", encoding="utf-8", errors="replace") as f:
            for line in f:
                pending.append(line)
                current = "".join(pending)
                if not sqlite3.complete_statement(current):
                    continue

                pending.clear()
                stmt = normalize_statement(current)
                if not stmt:
                    continue

                conn.execute(stmt)
                executed += 1

                if args.commit_every > 0 and executed % args.commit_every == 0:
                    conn.commit()
                    conn.execute("BEGIN;")
                    elapsed = time.time() - started
                    print(f"Imported {executed:,} statements... ({elapsed:.1f}s)")

        if pending:
            tail = normalize_statement("".join(pending))
            if tail:
                conn.execute(tail)
                executed += 1

        conn.commit()
    except sqlite3.Error as e:
        conn.rollback()
        print(f"SQLite error: {e}", file=sys.stderr)
        return 3
    finally:
        conn.close()

    elapsed = time.time() - started
    print(f"Import complete: {output_path} ({executed:,} statements, {elapsed:.1f}s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

