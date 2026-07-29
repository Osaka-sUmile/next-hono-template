import { PrismaClient } from "@prisma/client"
import type { AdminSummaryView, IAdminQueryService } from "@workspace/domain"

const LAST_7_DAYS_IN_MILLISECONDS = 7 * 24 * 60 * 60 * 1000

export class AdminQueryService implements IAdminQueryService {
  constructor(private readonly prisma: PrismaClient) {}

  async summarize(): Promise<AdminSummaryView> {
    const sevenDaysAgo = new Date(Date.now() - LAST_7_DAYS_IN_MILLISECONDS)
    const [
      userCount,
      adminCount,
      surveyCount,
      activeSurveyCount,
      submissionCount,
      submissionCountLast7Days,
    ] = await this.prisma.$transaction([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { role: "admin" } }),
      this.prisma.feedbackSurvey.count(),
      this.prisma.feedbackSurvey.count({ where: { isActive: true } }),
      this.prisma.feedbackSubmission.count(),
      this.prisma.feedbackSubmission.count({
        where: { createdAt: { gte: sevenDaysAgo } },
      }),
    ])

    return {
      userCount,
      adminCount,
      surveyCount,
      activeSurveyCount,
      submissionCount,
      submissionCountLast7Days,
    }
  }
}
