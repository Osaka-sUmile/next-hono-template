export type AdminSummaryView = {
  userCount: number
  adminCount: number
  surveyCount: number
  activeSurveyCount: number
  submissionCount: number
  submissionCountLast7Days: number
}

export interface IAdminQueryService {
  /** 管理ダッシュボードに表示する全体 KPI を返す。 */
  summarize(): Promise<AdminSummaryView>
}
