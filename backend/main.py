"""FastAPI application entrypoint."""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import ValidationError

from auth.router import router as auth_router
from auth.users_router import router as users_router
from config import get_settings
from middleware.logging import RequestLoggingMiddleware
from routers.analytics import router as analytics_router
from routers.backup import router as backup_router
from routers.logs import router as logs_router
from routers.members import router as members_router
from routers.messages import router as messages_router
from routers.organisations import router as organisations_router
from routers.settings import router as settings_router
from routers.webhooks import router as webhooks_router
from routers.user_api import router as user_api_router
from utils.errors import ErrorCode

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)


def _serialise_errors(errors: list[dict]) -> list[dict]:
    """Strip non-JSON-serialisable values (e.g. ctx exceptions) from pydantic errors."""
    out = []
    for err in errors:
        clean = {k: v for k, v in err.items() if k != "ctx"}
        ctx = err.get("ctx")
        if isinstance(ctx, dict):
            clean["ctx"] = {k: str(v) for k, v in ctx.items()}
        out.append(clean)
    return out


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    logging.info("Starting %s (%s)", settings.app_name, settings.app_env)
    yield
    logging.info("Shutting down %s", settings.app_name)


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(RequestLoggingMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list or ["http://localhost:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["x-request-id"],
    )

    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError):
        return JSONResponse(
            status_code=422,
            content={
                "detail": {
                    "code": ErrorCode.INVALID_REQUEST,
                    "message": "request validation failed",
                    "errors": _serialise_errors(exc.errors()),
                }
            },
        )

    @app.exception_handler(ValidationError)
    async def pydantic_validation_handler(request: Request, exc: ValidationError):
        return JSONResponse(
            status_code=422,
            content={
                "detail": {
                    "code": ErrorCode.INVALID_REQUEST,
                    "message": "payload validation failed",
                    "errors": _serialise_errors(exc.errors()),
                }
            },
        )

    @app.exception_handler(Exception)
    async def unhandled_handler(request: Request, exc: Exception):
        logging.exception("unhandled_error", extra={"path": request.url.path})
        return JSONResponse(
            status_code=500,
            content={
                "detail": {
                    "code": ErrorCode.INTERNAL_ERROR,
                    "message": "internal server error",
                }
            },
        )

    api_prefix = "/api/v1"
    app.include_router(auth_router, prefix=api_prefix)
    app.include_router(users_router, prefix=api_prefix)
    app.include_router(organisations_router, prefix=api_prefix)
    app.include_router(members_router, prefix=api_prefix)
    app.include_router(messages_router, prefix=api_prefix)
    app.include_router(analytics_router, prefix=api_prefix)
    app.include_router(settings_router, prefix=api_prefix)
    app.include_router(logs_router, prefix=api_prefix)
    app.include_router(backup_router, prefix=api_prefix)

    app.include_router(webhooks_router, prefix=api_prefix)
    app.include_router(user_api_router, prefix=api_prefix)

    @app.get("/health", tags=["health"])
    async def health():
        return {"status": "ok", "app": settings.app_name, "env": settings.app_env}

    return app


app = create_app()


def main() -> None:
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)


if __name__ == "__main__":
    main()
