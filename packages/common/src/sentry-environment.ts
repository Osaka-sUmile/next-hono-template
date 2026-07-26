/**
 * Sentry の environment を決める。
 *
 * API の Worker binding は検証前の unknown、web の process.env は string | undefined なので、
 * 両方を受けられるようにする。空文字・空白のみ・非文字列は未設定として扱い、優先値が
 * 無効なら fallback を使う。
 */
export function resolveSentryEnvironment(preferred: unknown, fallback: unknown): string | undefined {
  const normalize = (value: unknown): string | undefined => {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    return trimmed === "" ? undefined : trimmed;
  };

  return normalize(preferred) ?? normalize(fallback);
}
