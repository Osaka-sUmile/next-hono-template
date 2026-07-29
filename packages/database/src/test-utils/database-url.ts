type DatabaseEnvironment = {
  DATABASE_URL?: string
  TEST_DATABASE_URL?: string
}

/**
 * 結合テスト専用の接続文字列を取得し、安全なテスト DB であることを検証する。
 * 開発 DB への誤接続を防ぐため DATABASE_URL へのフォールバックは行わない。
 */
export function getTestDatabaseUrl(
  environment: DatabaseEnvironment = process.env
): string {
  const connectionString = environment.TEST_DATABASE_URL
  if (!connectionString) {
    throw new Error(
      "TEST_DATABASE_URL が未設定です。データベース名が _test で終わる結合テスト専用 DB を指定してください。"
    )
  }

  let url: URL
  try {
    url = new URL(connectionString)
  } catch {
    throw new Error(
      "TEST_DATABASE_URL には有効な PostgreSQL URL を指定してください。"
    )
  }

  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error(
      "TEST_DATABASE_URL には有効な PostgreSQL URL を指定してください。"
    )
  }

  const databaseName = decodeURIComponent(url.pathname.slice(1))
  if (!databaseName) {
    throw new Error(
      "TEST_DATABASE_URL に結合テスト専用のデータベース名を指定してください。"
    )
  }
  if (!databaseName.endsWith("_test")) {
    throw new Error(
      "TEST_DATABASE_URL のデータベース名は安全のため _test で終わる必要があります。"
    )
  }

  return connectionString
}
