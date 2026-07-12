import path from "node:path";
import SwaggerParser from "@apidevtools/swagger-parser";
import type { OpenAPIV3 } from "openapi-types";
import { ErrorCodes } from "../src/presentation/error-codes";

/**
 * `error-codes.ts` の ErrorCodes と `Error.yaml` の enum を突合し、
 * 差分があれば非0終了する。CLAUDE.md の「エラーコードの追加手順」で
 * 定める3箇所同時更新のうち、型は ErrorCodes から自動導出されるため、
 * ここでは ErrorCodes ↔ Error.yaml enum の2箇所のみを比較する。
 */
async function main() {
  const apiRoot = path.join(__dirname, "..");
  const specPath = path.join(apiRoot, "docs/openapi.yaml");

  const spec = (await SwaggerParser.dereference(specPath)) as OpenAPIV3.Document;
  const errorSchema = spec.components?.schemas?.Error as OpenAPIV3.SchemaObject | undefined;
  const yamlEnum = errorSchema?.properties?.code
    ? (errorSchema.properties.code as OpenAPIV3.SchemaObject).enum
    : undefined;

  if (!Array.isArray(yamlEnum) || !yamlEnum.every((code) => typeof code === "string")) {
    console.error(
      "[check-error-codes] ERROR: components.schemas.Error.properties.code.enum が見つかりません" +
        "(apps/api/docs/components/schemas/Error.yaml を確認してください)",
    );
    process.exit(1);
  }

  const tsCodes = new Set(Object.values(ErrorCodes));
  const yamlCodes = new Set(yamlEnum as string[]);

  const missingInYaml = [...tsCodes].filter((code) => !yamlCodes.has(code)).sort();
  const missingInTs = [...yamlCodes].filter((code) => !tsCodes.has(code)).sort();

  if (missingInYaml.length === 0 && missingInTs.length === 0) {
    console.info(`[check-error-codes] OK: ${tsCodes.size} codes are in sync`);
    return;
  }

  console.error("[check-error-codes] NG: error-codes.ts と Error.yaml のエラーコードが一致しません\n");

  if (missingInYaml.length > 0) {
    console.error("  Error.yaml の enum に不足 (error-codes.ts にのみ存在):");
    missingInYaml.forEach((code) => console.error(`    - ${code}`));
    console.error("");
  }

  if (missingInTs.length > 0) {
    console.error("  error-codes.ts の ErrorCodes に不足 (Error.yaml にのみ存在):");
    missingInTs.forEach((code) => console.error(`    - ${code}`));
    console.error("");
  }

  console.error(
    "エラーコード追加時は CLAUDE.md の「エラーコードの追加手順」を参照し、以下の2箇所を同時に更新してください" +
      "(ErrorCode 型は ErrorCodes から自動導出されるため更新不要です):\n" +
      "  1. apps/api/src/presentation/error-codes.ts の ErrorCodes 定数\n" +
      "  2. apps/api/docs/components/schemas/Error.yaml の enum",
  );
  process.exit(1);
}

main().catch((error) => {
  console.error("[check-error-codes] failed to parse OpenAPI spec", error);
  process.exit(1);
});
