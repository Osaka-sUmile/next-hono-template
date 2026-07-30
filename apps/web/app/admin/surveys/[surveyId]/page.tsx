"use client"

import Link from "next/link"
import { useState } from "react"
import { useParams } from "next/navigation"
import { Button } from "@workspace/ui/components/button"
import { AdminSurveyQuestionEditor } from "@/components/admin-survey-question-editor"
import { AdminSubmissionsTable } from "@/components/admin-submissions-table"
import { AdminSummaryChart } from "@/components/admin-summary-chart"

/**
 * アンケート詳細ページ。path param は useParams で取得し、集計と提出一覧へ渡す。
 */
export default function AdminSurveyDetailPage() {
  const { surveyId } = useParams<{ surveyId: string }>()
  const [revision, setRevision] = useState(0)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/surveys">アンケート一覧へ戻る</Link>
        </Button>
        <AdminSurveyQuestionEditor
          surveyId={surveyId}
          onSaved={() => setRevision((current) => current + 1)}
        />
      </div>
      <AdminSummaryChart key={revision} surveyId={surveyId} />
      <AdminSubmissionsTable key={revision} surveyId={surveyId} />
    </div>
  )
}
