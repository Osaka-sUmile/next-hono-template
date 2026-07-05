import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import SwaggerParser from "@apidevtools/swagger-parser";

/**
 * ビルド時に OpenAPI YAML (複数ファイル分割) を dereference し、
 * 単一の JSON として `src/generated/openapi.json` に書き出す。
 *
 * Cloudflare Workers は FS を持たないため、実行時に YAML を読み込むことができない。
 * そのため dereference 済みの spec をビルド成果物として静的 import する方式に変更し、
 * OpenAPI の破損は本スクリプトの失敗（非0終了）でビルド時に検知する。
 */
async function main() {
  const apiRoot = path.join(__dirname, "..");
  const specPath = path.join(apiRoot, "docs/openapi.yaml");
  const outDir = path.join(apiRoot, "src/generated");
  const outPath = path.join(outDir, "openapi.json");

  const openapiSpecification = await SwaggerParser.dereference(specPath);

  await mkdir(outDir, { recursive: true });
  await writeFile(outPath, JSON.stringify(openapiSpecification, null, 2));

  console.info(`[bundle-openapi] wrote ${path.relative(apiRoot, outPath)}`);
}

main().catch((error) => {
  console.error("[bundle-openapi] failed to bundle OpenAPI spec", error);
  process.exit(1);
});
