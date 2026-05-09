"""Seed an initial admin_user for the console.

Usage:
    uv run python -m scripts.seed_admin <username> <email> <password> [full_name]

Idempotent: re-running with a known username updates the password hash.
"""

from __future__ import annotations

import sys

from dotenv import load_dotenv

load_dotenv(".env")

from auth.utils import hash_password  # noqa: E402
from database import get_supabase  # noqa: E402


def main(argv: list[str]) -> int:
    if len(argv) < 4:
        print(
            "usage: python -m scripts.seed_admin <username> <email> <password> [full_name]",
            file=sys.stderr,
        )
        return 1
    username = argv[1]
    email = argv[2]
    password = argv[3]
    full_name = argv[4] if len(argv) > 4 else "Saathpay Admin"

    sb = get_supabase()
    pw_hash = hash_password(password)

    existing = (
        sb.table("admin_users")
        .select("id")
        .eq("username", username)
        .limit(1)
        .execute()
        .data
        or []
    )
    if existing:
        sb.table("admin_users").update(
            {"password_hash": pw_hash, "email": email, "full_name": full_name}
        ).eq("username", username).execute()
        print(f"Updated admin '{username}' (id={existing[0]['id']})")
    else:
        res = (
            sb.table("admin_users")
            .insert(
                {
                    "username": username,
                    "email": email,
                    "password_hash": pw_hash,
                    "full_name": full_name,
                    "role": "superadmin",
                }
            )
            .execute()
        )
        new_id = (res.data or [{}])[0].get("id")
        print(f"Created admin '{username}' (id={new_id})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
