"""Supabase client provider.

A single module-level Supabase Client instance is constructed using the
service-role key. The same client is used for both DB (PostgREST) and Storage.
"""

from __future__ import annotations

from functools import lru_cache

from supabase import Client, create_client

from config import get_settings


@lru_cache(maxsize=1)
def get_supabase() -> Client:
    """Return the singleton Supabase client (service role)."""
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def get_db() -> Client:
    """FastAPI dependency that returns the Supabase client.

    Kept as a function (rather than the lru_cache'd accessor directly) so test
    suites can override it via app.dependency_overrides.
    """
    return get_supabase()
