#!/usr/bin/env python3
"""
Export a SQLite database to a SQL dump file.

Examples:
  python scripts/export_sqlite_to_sql.py --input data/fontys_cgny.db --output C:\\Users\\Josh\\Downloads\\fontys_cgny.sql
  python scripts/export_sqlite_to_sql.py --input data/fontys_cgny.db --output C:\\Users\\Josh\\Downloads\\fontys_cgny.sql.gz --gzip
"""

from __future__ import annotations

import argparse
import gzip
import pathlib
import sqlite3
import sys
from typing import TextIO


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Export SQLite DB to SQL dump")
    parser.add_argument("--input", required=True, help="Path to source .db file")
    parser.add_argument("--output", required=True, help="Path to output .sql or .sql.gz file")
    parser.add_argument(
        "--gzip",
        action="store_true",
        help="Write compressed gzip output (.sql.gz)",
    )
    return parser.parse_args()


def open_output(path: pathlib.Path, use_gzip: bool) -> TextIO:
    path.parent.mkdir(parents=True, exist_ok=True)
    if use_gzip:
        return gzip.open(path, mode="wt", encoding="utf-8", newline="\n")
    return path.open(mode="w", encoding="utf-8", newline="\n")


def main() -> int:
    args = parse_args()
    input_path = pathlib.Path(args.input).expanduser().resolve()
    output_path = pathlib.Path(args.output).expanduser().resolve()

    if not input_path.exists():
        print(f"Input file not found: {input_path}", file=sys.stderr)
        return 1

    connection = sqlite3.connect(str(input_path))
    try:
        with open_output(output_path, args.gzip) as output_file:
            for line in connection.iterdump():
                output_file.write(f"{line}\n")
    finally:
        connection.close()

    print(f"Export complete: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
