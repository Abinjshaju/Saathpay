"""Pagination helpers.

Routes accept `page` and `limit` query params; we return responses shaped as
{ data, total, page, limit }.
"""

from __future__ import annotations

from typing import TypeVar

from fastapi import Query
from pydantic import BaseModel

T = TypeVar("T")

DEFAULT_LIMIT = 25
MAX_LIMIT = 100


class PageParams(BaseModel):
    page: int = 1
    limit: int = DEFAULT_LIMIT

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.limit

    @property
    def range_end(self) -> int:
        """Inclusive end index for Supabase's .range(from, to)."""
        return self.offset + self.limit - 1


def page_params(
    page: int = Query(1, ge=1),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
) -> PageParams:
    return PageParams(page=page, limit=limit)


class Page(BaseModel):
    data: list
    total: int
    page: int
    limit: int


def make_page(data: list, total: int, params: PageParams) -> dict:
    return {"data": data, "total": total, "page": params.page, "limit": params.limit}
