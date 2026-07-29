"use client"

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { apiClient } from "@/lib/api-client"
import { useApiResource } from "@/hooks/use-api-resource"

const KPI_DEFINITIONS = [
  { key: "userCount", label: "ユーザー数" },
  { key: "adminCount", label: "管理者数" },
  { key: "surveyCount", label: "アンケート数" },
  { key: "activeSurveyCount", label: "有効なアンケート" },
  { key: "submissionCount", label: "総回答数" },
  { key: "submissionCountLast7Days", label: "直近7日の回答数" },
] as const

/**
 * 管理ダッシュボードの KPI タイル。
 * `GET /api/v1/admin/summary` を取得し、6 つの数値をカードグリッドで表示する。
 */
export function AdminKpiCards() {
  const { data, error, isLoading, reload } = useApiResource(() =>
    apiClient.get("/api/v1/admin/summary")
  )

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {KPI_DEFINITIONS.map((kpi) => (
          <Card key={kpi.key}>
            <CardHeader>
              <CardDescription>{kpi.label}</CardDescription>
              <Skeleton className="h-8 w-20" />
            </CardHeader>
          </Card>
        ))}
      </div>
    )
  }

  if (error || !data) {
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-lg border border-destructive/50 p-6"
      >
        <p className="text-sm text-destructive">
          サマリーの取得に失敗しました。
        </p>
        <Button variant="outline" size="sm" onClick={reload}>
          再読み込み
        </Button>
      </div>
    )
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {KPI_DEFINITIONS.map((kpi) => (
        <Card key={kpi.key}>
          <CardHeader>
            <CardDescription>{kpi.label}</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {data[kpi.key].toLocaleString("ja-JP")}
            </CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}
