"use client"

import { useEffect, useRef, useState } from "react"
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
import { AdminPagination } from "@/components/admin-pagination"
import { useApiResource } from "@/hooks/use-api-resource"
import { ApiError, apiClient } from "@/lib/api-client"

const PAGE_SIZE = 20
const COLUMN_COUNT = 4
const DATE_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
})

type AdminSubmissionsTableProps = {
  surveyId: string
}

function removeResponseBody(error: unknown): unknown {
  return error instanceof ApiError ? new ApiError(error.status) : error
}

/**
 * 回答者の氏名・メール・自由記述を含む admin 限定の提出一覧。
 *
 * API エラーの body は PII を含みうるため、UI 状態には元エラーを保持する一方、
 * reportError へは status だけを持つ ApiError を渡す。
 */
export function AdminSubmissionsTable({
  surveyId,
}: AdminSubmissionsTableProps) {
  const [offset, setOffset] = useState(0)
  const { data, error, isLoading, reload } = useApiResource(
    () =>
      apiClient.get("/api/v1/admin/feedback/submissions", {
        params: {
          query: {
            surveyId,
            limit: PAGE_SIZE,
            offset,
          },
        },
      }),
    { mapErrorForReporting: removeResponseBody }
  )

  if (data && offset > 0 && data.total <= offset) {
    setOffset(Math.max(0, Math.floor((data.total - 1) / PAGE_SIZE) * PAGE_SIZE))
  }

  const isFirstRun = useRef(true)
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }
    reload()
  }, [offset, reload])

  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-lg border border-destructive/50 p-6"
      >
        <p className="text-sm text-destructive">
          提出一覧の取得に失敗しました。
        </p>
        <Button variant="outline" size="sm" onClick={reload}>
          再読み込み
        </Button>
      </div>
    )
  }

  return (
    <section
      className="flex flex-col gap-4"
      aria-labelledby="submissions-title"
    >
      <div>
        <h2 id="submissions-title" className="text-lg font-semibold">
          提出一覧
        </h2>
        <p className="text-xs text-muted-foreground">
          回答者情報と回答内容は管理者のみ閲覧できます。
        </p>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>回答者</TableHead>
              <TableHead>メールアドレス</TableHead>
              <TableHead>提出日時</TableHead>
              <TableHead>回答内容</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading || !data ? (
              Array.from({ length: 3 }, (_, row) => (
                <TableRow key={row}>
                  {Array.from({ length: COLUMN_COUNT }, (_, cell) => (
                    <TableCell key={cell}>
                      <Skeleton className="h-4 w-full max-w-32" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : data.items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={COLUMN_COUNT}
                  className="py-8 text-center text-muted-foreground"
                >
                  このアンケートへの提出はまだありません。
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((submission) => (
                <TableRow key={submission.id}>
                  <TableCell className="font-medium">
                    <span>{submission.user.name || "—"}</span>
                    {submission.user.displayName &&
                      submission.user.displayName !== submission.user.name && (
                        <span className="block text-xs font-normal text-muted-foreground">
                          {submission.user.displayName}
                        </span>
                      )}
                  </TableCell>
                  <TableCell>{submission.user.email}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {DATE_FORMATTER.format(new Date(submission.createdAt))}
                  </TableCell>
                  <TableCell className="min-w-80 whitespace-normal">
                    <dl className="flex flex-col gap-2">
                      {submission.answers.map((answer) => (
                        <div key={answer.questionId}>
                          <dt className="text-xs font-medium">
                            {answer.questionText}
                          </dt>
                          <dd className="mt-0.5 wrap-break-word text-muted-foreground">
                            {answer.textValue ??
                              answer.choiceLabel ??
                              answer.choiceValue ??
                              "未回答"}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {data && (
        <AdminPagination
          total={data.total}
          offset={offset}
          limit={PAGE_SIZE}
          onOffsetChange={setOffset}
        />
      )}
    </section>
  )
}
