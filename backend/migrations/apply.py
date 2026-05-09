"""Run all SQL migration files against DATABASE_URL.

Usage:
    uv run python -m migrations.apply

Reads DATABASE_URL from .env. Applies every *.sql file in this directory in
filename order, in a single transaction per file. Idempotent — every migration
is written with `create ... if not exists` / `create or replace function`.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path
from urllib.parse import quote, urlparse, urlunparse

import psycopg
from dotenv import load_dotenv


def _normalise_url(raw: str) -> str:
    """URL-encode the password if it contains characters that confuse urlparse.

    Supabase passwords can contain '@', which breaks naive URL parsing. We
    detect that and re-encode the userinfo section.
    """
    scheme, _, rest = raw.partition("://")
    if "@" not in rest:
        return raw
    userinfo, _, hostpart = rest.rpartition("@")
    if ":" in userinfo:
        user, _, password = userinfo.partition(":")
        encoded = f"{user}:{quote(password, safe='')}"
    else:
        encoded = userinfo
    return f"{scheme}://{encoded}@{hostpart}"


def main() -> int:
    load_dotenv()
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL not set in .env", file=sys.stderr)
        return 1

    migrations_dir = Path(__file__).parent
    files = sorted(p for p in migrations_dir.glob("*.sql"))
    if not files:
        print("No .sql files in migrations/", file=sys.stderr)
        return 1

    url = _normalise_url(database_url)
    parsed = urlparse(url)
    print(f"Connecting to {parsed.hostname}:{parsed.port or 5432} ({parsed.path.lstrip('/')})")

    with psycopg.connect(url, autocommit=False) as conn:
        for path in files:
            print(f"Applying {path.name} ...", end=" ", flush=True)
            sql = path.read_text(encoding="utf-8")
            with conn.cursor() as cur:
                cur.execute(sql)
            conn.commit()
            print("OK")

    print("All migrations applied.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
