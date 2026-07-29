"use client"

import Link from "next/link"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { apiClient } from "@/lib/api-client"
import { useApiResource } from "@/hooks/use-api-resource"
import { AdminSurveyActiveSwitch } from "@/components/admin-survey-active-switch"
import { AdminSurveyCreateForm } from "@/components/admin-survey-create-form"

const DATE_FORMATTER = new Intl.DateTimeFormat("ja-JP", { dateStyle: "medium" })

/**
 * アンケート一覧。`GET /api/v1/admin/feedback/surveys` を取得して表で表示する。
 *
 * 作成(ダイアログ)と有効化(スイッチ)の成功時はどちらも `reload` で一覧を取り直す。
 * 有効化は「同時にアクティブなのは 1 件」のため他の行の isActive も変わる副作用があり、
 * 楽観更新では整合が取れない。
 */
export function AdminSurveysTable() {
  const { data, error, isLoading, reload } = useApiResource(() =>
    apiClient.get("/api/v1/admin/feedback/surveys")
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <AdminSurveyCreateForm onCreated={reload} />
      </div>
      {isLoading ? (
        <div className="flex flex-col gap-2" aria-label="読み込み中">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : error || !data ? (
        <div
          role="alert"
          className="flex flex-col items-start gap-3 rounded-lg border border-destructive/50 p-6"
        >
          <p className="text-sm text-destructive">
            アンケート一覧の取得に失敗しました。
          </p>
          <Button variant="outline" size="sm" onClick={reload}>
            再読み込み
          </Button>
        </div>
      ) : data.items.length === 0 ? (
        <p className="rounded-lg border p-6 text-sm text-muted-foreground">
          アンケートはまだありません。「アンケートを作成」から追加してください。
        </p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>タイトル</TableHead>
                <TableHead>slug</TableHead>
                <TableHead className="text-right">設問数</TableHead>
                <TableHead className="text-right">回答数</TableHead>
                <TableHead>作成日</TableHead>
                <TableHead>有効</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((survey) => (
                <TableRow key={survey.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/admin/surveys/${survey.id}`}
                      className="hover:underline"
                    >
                      {survey.title}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {survey.slug}
                    </code>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {survey.questionCount.toLocaleString("ja-JP")}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {survey.submissionCount.toLocaleString("ja-JP")}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {DATE_FORMATTER.format(new Date(survey.createdAt))}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <AdminSurveyActiveSwitch
                        surveyId={survey.id}
                        title={survey.title}
                        isActive={survey.isActive}
                        onChanged={reload}
                      />
                      <Badge variant={survey.isActive ? "default" : "outline"}>
                        {survey.isActive ? "有効" : "無効"}
                      </Badge>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
