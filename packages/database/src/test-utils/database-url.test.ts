import { afterEach, describe, expect, it, vi } from "vitest"
import { getTestDatabaseUrl } from "./database-url"
import { resetDatabase } from "./db"

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("getTestDatabaseUrl", () => {
  it("TEST_DATABASE_URL を返す", () => {
    expect(
      getTestDatabaseUrl({
        TEST_DATABASE_URL: "postgresql://user:password@localhost:5432/app_test",
      })
    ).toBe("postgresql://user:password@localhost:5432/app_test")
  })

  it("DATABASE_URL があっても TEST_DATABASE_URL がなければ拒否する", () => {
    expect(() =>
      getTestDatabaseUrl({
        DATABASE_URL: "postgresql://user:password@localhost:5432/app",
      })
    ).toThrow(/TEST_DATABASE_URL/)
  })

  it("データベース名が _test で終わらなければ拒否する", () => {
    expect(() =>
      getTestDatabaseUrl({
        TEST_DATABASE_URL: "postgresql://user:password@localhost:5432/app",
      })
    ).toThrow(/_test/)
  })

  it("クエリパラメータを除いたデータベース名を検証する", () => {
    expect(
      getTestDatabaseUrl({
        TEST_DATABASE_URL:
          "postgresql://user:password@localhost:5432/app_test?schema=public",
      })
    ).toBe("postgresql://user:password@localhost:5432/app_test?schema=public")
  })

  it("データベース名がなければ拒否する", () => {
    expect(() =>
      getTestDatabaseUrl({
        TEST_DATABASE_URL: "postgresql://user:password@localhost:5432",
      })
    ).toThrow(/データベース名/)
  })

  it("PostgreSQL URL でなければ拒否する", () => {
    expect(() =>
      getTestDatabaseUrl({ TEST_DATABASE_URL: "not-a-url" })
    ).toThrow(/PostgreSQL URL/)
  })
})

describe("resetDatabase", () => {
  it("安全でない TEST_DATABASE_URL では PrismaClient に触れる前に拒否する", async () => {
    vi.stubEnv(
      "TEST_DATABASE_URL",
      "postgresql://user:password@localhost:5432/app"
    )
    const prisma = new Proxy(
      {},
      {
        get() {
          throw new Error("PrismaClient にアクセスしました")
        },
      }
    )

    await expect(resetDatabase(prisma as never)).rejects.toThrow(/_test/)
  })
})
