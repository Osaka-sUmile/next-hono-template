import { apiBaseUrl } from "./auth-client";

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

type RequestOptions = {
  /** 追加ヘッダー。body があるときの Content-Type は固定で、ここからは上書きできない。 */
  headers?: Record<string, string>;
};

async function request<T>(
  path: string,
  method: string,
  body: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const hasBody = body !== undefined;
  const res = await fetch(`${apiBaseUrl}${path}`, {
    method,
    // Cookie セッション認証のため必須。忘れると理由の分かりにくい 401 になるので
    // ここで一元化し、呼び出し側からは上書きできないようにする。
    credentials: "include",
    headers: {
      ...options.headers,
      // body は必ず JSON.stringify するため、Content-Type は後に置いて上書きを防ぐ。
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
    },
    ...(hasBody ? { body: JSON.stringify(body) } : {}),
  });

  // エラー本文の形に依存しないよう、status だけを持って投げる。
  if (!res.ok) throw new ApiError(res.status);
  // 204 No Content は本文が空で res.json() が失敗するため読まない。
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/**
 * バックエンド (apps/api) 呼び出しの唯一の入口。
 * コンポーネント・hooks から fetch を直接呼ばず、必ずここを経由すること
 * (docs/frontend-guidelines.md「データフェッチ・API 呼び出し」)。
 *
 * better-auth のエンドポイントは authClient (lib/auth-client.ts) が担当するため対象外。
 */
export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, "GET", undefined, options),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, "POST", body, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, "PATCH", body, options),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, "DELETE", undefined, options),
};
