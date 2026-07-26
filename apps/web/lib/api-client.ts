import createClient, {
  type ClientPathsWithMethod,
  type MaybeOptionalInit,
  type MethodResponse,
} from "openapi-fetch";
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
 * Cookie セッション認証のため `credentials: "include"` は必須。忘れると理由の分かりにくい
 * 401 になるので、raw client の生成時に一元化し、呼び出し側からは上書きできないようにする。
 */
const rawClient = createClient<paths>({
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
 * `Res` を rawClient が返す Promise の実際の型から推論させることで、
 * 戻り値 `NonNullable<Res["data"]>` がエンドポイントごとのレスポンス型を保つ
 * （`any` へのキャストや `@ts-expect-error` は使わない）。
 *
 * 内部の `data as NonNullable<Res["data"]>` は、`response.ok` が true の分岐では
 * openapi-fetch の判別共用体上 data が必ず存在することを型システムでは表現しきれないために
 * 必要な最小限のキャスト（公開 apiClient からは見えない）。
 */
async function unwrap<Res extends { data?: unknown; error?: unknown; response: Response }>(
  promise: Promise<Res>,
): Promise<NonNullable<Res["data"]>> {
  const { data, response } = await promise;
  if (!response.ok) throw new ApiError(response.status);
  return data as NonNullable<Res["data"]>;
}

type SupportedMethod = "get" | "post" | "put" | "patch" | "delete";

type RequiredKeys<T> = {
  [K in keyof T]-?: object extends Pick<T, K> ? never : K;
}[keyof T];

type InitParam<Init> =
  RequiredKeys<Init> extends never
    ? [(Init & { [key: string]: unknown })?]
    : [Init & { [key: string]: unknown }];

type ApiMethod<Method extends SupportedMethod> = <
  Path extends ClientPathsWithMethod<typeof rawClient, Method>,
  Init extends MaybeOptionalInit<paths[Path], Method>,
>(
  path: Path,
  ...init: InitParam<Init>
) => Promise<MethodResponse<typeof rawClient, Method, Path, Init>>;

type RawResult = { data?: unknown; error?: unknown; response: Response };
type RawRequest = (method: SupportedMethod, path: string, init?: object) => Promise<RawResult>;

/**
 * TypeScript は generic 関数の「入力型を保ったまま戻り値だけを変換する」型を
 * 実装から推論できないため、raw request との境界だけを非 generic な形に畳む。
 * 公開側の ApiMethod は OpenAPI 由来の path / init / response の関連を維持する。
 */
function createApiMethod<Method extends SupportedMethod>(method: Method): ApiMethod<Method> {
  const request = rawClient.request as unknown as RawRequest;
  return ((path: string, init?: object) =>
    unwrap(request(method, path, init))) as ApiMethod<Method>;
}

/**
 * バックエンド (apps/api) 呼び出しの唯一の入口。
 * コンポーネント・hooks から fetch や rawClient を直接呼ばず、必ずここを経由すること
 * (docs/frontend-guidelines.md「データフェッチ・API 呼び出し」)。
 *
 * `apps/api/openapi.json` から生成した型 (`lib/api-schema.d.ts`) を利用し、パス・メソッド・
 * body・params・レスポンスの形を API 実装と一致させる。openapi-fetch 固有の uppercase
 * メソッドと `{ data, error, response }` はここで吸収し、成功時は data を直接返す。
 *
 * better-auth のエンドポイントは authClient (lib/auth-client.ts) が担当するため対象外。
 */
export const apiClient: {
  get: ApiMethod<"get">;
  post: ApiMethod<"post">;
  put: ApiMethod<"put">;
  patch: ApiMethod<"patch">;
  delete: ApiMethod<"delete">;
} = {
  get: createApiMethod("get"),
  post: createApiMethod("post"),
  put: createApiMethod("put"),
  patch: createApiMethod("patch"),
  delete: createApiMethod("delete"),
};
