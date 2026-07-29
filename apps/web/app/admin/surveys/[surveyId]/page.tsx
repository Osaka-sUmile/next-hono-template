"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import { Button } from "@workspace/ui/components/button"
import { AdminSubmissionsTable } from "@/components/admin-submissions-table"
import { AdminSummaryChart } from "@/components/admin-summary-chart"

/**
 * アンケート詳細ページ。path param は useParams で取得し、集計と提出一覧へ渡す。
 */
export default function AdminSurveyDetailPage() {
  const { surveyId } = useParams<{ surveyId: string }>()

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/surveys">アンケート一覧へ戻る</Link>
        </Button>
      </div>
      <AdminSummaryChart surveyId={surveyId} />
      <AdminSubmissionsTable surveyId={surveyId} />
    </div>
  )
}
