/**
 * リクエストボディの JSON パースに失敗したことを表す Presentation 層のエラー。
 *
 * `c.req.json()` が送出する汎用的な `SyntaxError` を、この専用型に変換して投げることで、
 * 中央エラーハンドラ (onError) が「不正 JSON ボディ = 400 VALIDATION_ERROR」だけを
 * 正確に写像できるようにする。アプリケーション内部（ユースケースや外部データ処理）で
 * 発生する `SyntaxError` を誤って 400 と判定し Sentry 送信を握り潰さないための境界マーカー。
 */
export class InvalidJsonBodyError extends Error {
  constructor(cause?: unknown) {
    super("Invalid JSON in request body", { cause });
    this.name = "InvalidJsonBodyError";
  }
}
