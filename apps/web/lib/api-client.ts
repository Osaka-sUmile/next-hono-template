import createClient from "openapi-fetch";
import { apiBaseUrl } from "./auth-client";
import type { paths } from "./api-schema";

/**
 * API が 2xx 以外を返したことを表すエラー。
 *
 * 「この status が想定内か」の判断は**呼び出し側に残す**。api-client が
 * 「4xx は全部想定内」と決めてしまうと reportError の fail-loud 原則
 * (docs/frontend-guidelines.md) に反し、観測漏れを生むため。
 * 呼び出し側は status を見て ExpectedError に包み替えるかを判断する。
 */
export class ApiError extends Error {
  constructor(readonly status: number) {
    super(`API request failed with status ${status}`);
    this.name = "ApiError";
  }
}

/**
 * バックエンド (apps/api) 呼び出しの唯一の入口。
 * コンポーネント・hooks から fetch を直接呼ばず、必ずここを経由すること
 * (docs/frontend-guidelines.md「データフェッチ・API 呼び出し」)。
 *
 * `apps/api/openapi.json` から生成した型 (`lib/api-schema.d.ts`) を openapi-fetch に
 * 渡すことで、パス・メソッド・リクエスト/レスポンスの形が API の実装とズレなくなる
 * (docs/architecture.md「API 型の共有方針」)。
 *
 * better-auth のエンドポイントは authClient (lib/auth-client.ts) が担当するため対象外。
 *
 * Cookie セッション認証のため `credentials: "include"` は必須。忘れると理由の分かりにくい
 * 401 になるので、ここで一元化し呼び出し側からは上書きできないようにする。
 */
export const apiClient = createClient<paths>({
  baseUrl: apiBaseUrl,
  credentials: "include",
  // fetch をラップする理由が 2 つある。
  //
  // 1. openapi-fetch は createClient() 呼び出し時点の globalThis.fetch をキャプチャする。
  //    省略するとテストで `global.fetch` を後から差し替えても（モジュール読み込みが先に
  //    走るため）反映されない。呼び出し時に都度引くことでモック可能な状態を保つ。
  // 2. openapi-fetch はリクエスト個別のオプションをインスタンスオプションへ上書きマージする。
  //    そのため上の `credentials: "include"` だけでは、呼び出し側が `credentials: "omit"` を
  //    渡すと Cookie が送られなくなる（= 認証が静かに壊れ、分かりにくい 401 になる）。
  //    ここで Request を作り直して include を強制し、上書きを効かなくする。
  fetch: (request) => fetch(new Request(request, { credentials: "include" })),
});

/**
 * openapi-fetch の `{ data, error, response }` を「成功なら data、失敗なら throw」に畳む。
 *
 * `Res` を `apiClient.GET/POST/...` が返す Promise の実際の型から推論させることで、
 * 戻り値 `NonNullable<Res["data"]>` がエンドポイントごとのレスポンス型を保つ
 * （`any` へのキャストや `@ts-expect-error` は使わない）。
 *
 * 内部の `data as NonNullable<Res["data"]>` は、`response.ok` が true の分岐では
 * openapi-fetch の判別共用体上 data が必ず存在することを型システムでは表現しきれないために
 * 必要な最小限のキャスト（`unwrap` の外からは効かない）。
 */
export async function unwrap<Res extends { data?: unknown; error?: unknown; response: Response }>(
  promise: Promise<Res>,
): Promise<NonNullable<Res["data"]>> {
  const { data, response } = await promise;
  if (!response.ok) throw new ApiError(response.status);
  return data as NonNullable<Res["data"]>;
}
