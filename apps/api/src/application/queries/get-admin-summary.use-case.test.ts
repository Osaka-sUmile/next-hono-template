import { describe, expect, it, vi } from "vitest"
import type { IAdminQueryService } from "@workspace/domain"
import { GetAdminSummaryUseCase } from "./get-admin-summary.use-case"

describe("GetAdminSummaryUseCase", () => {
  it("query service の集計結果をレスポンス DTO として返す", async () => {
    const summary = {
      userCount: 12,
      adminCount: 2,
      surveyCount: 4,
      activeSurveyCount: 1,
      submissionCount: 30,
      submissionCountLast7Days: 8,
    }
    const summarize = vi.fn().mockResolvedValue(summary)
    const queryService = { summarize } satisfies IAdminQueryService
    const useCase = new GetAdminSummaryUseCase(queryService)

    await expect(useCase.execute()).resolves.toEqual(summary)
    expect(summarize).toHaveBeenCalledOnce()
  })

  it("query service が例外を投げた場合はそのまま reject する", async () => {
    const error = new Error("query failed")
    const queryService = {
      summarize: vi.fn().mockRejectedValue(error),
    } satisfies IAdminQueryService
    const useCase = new GetAdminSummaryUseCase(queryService)

    await expect(useCase.execute()).rejects.toBe(error)
  })
})
