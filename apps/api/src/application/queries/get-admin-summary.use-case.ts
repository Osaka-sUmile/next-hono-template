import type { IAdminQueryService } from "@workspace/domain"
import type { AdminSummaryResponseDto } from "../dtos"
import { BaseQueryUseCase } from "./base.query"

export class GetAdminSummaryUseCase extends BaseQueryUseCase<
  void,
  AdminSummaryResponseDto
> {
  constructor(private readonly adminQueryService: IAdminQueryService) {
    super()
  }

  async execute(): Promise<AdminSummaryResponseDto> {
    const summary = await this.adminQueryService.summarize()

    return {
      userCount: summary.userCount,
      adminCount: summary.adminCount,
      surveyCount: summary.surveyCount,
      activeSurveyCount: summary.activeSurveyCount,
      submissionCount: summary.submissionCount,
      submissionCountLast7Days: summary.submissionCountLast7Days,
    }
  }
}
