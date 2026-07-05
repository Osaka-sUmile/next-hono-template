import type { Env, Hono } from "hono";
import { swaggerUI } from "@hono/swagger-ui";
import openapiSpecification from "../generated/openapi.json";

/**
 * dereference 済みの OpenAPI spec (ビルド時に `bundle-openapi` スクリプトが生成) を
 * 静的 import して配信する。Cloudflare Workers には FS が無いため、
 * 実行時の YAML 読み込み・dereference は行わない（fail-fast はビルド時に移動済み）。
 */
export function setupSwagger<E extends Env>(app: Hono<E>): void {
  app.get("/api-docs/openapi.json", (c) => c.json(openapiSpecification));
  app.get("/api-docs", swaggerUI({ url: "/api-docs/openapi.json" }));
}
