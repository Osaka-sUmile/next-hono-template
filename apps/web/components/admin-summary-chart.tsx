"use client"

import { Bar, BarChart, CartesianGrid, Cell, LabelList, XAxis } from "recharts"
import { Button } from "@workspace/ui/components/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@workspace/ui/components/chart"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { apiClient } from "@/lib/api-client"
import { useApiResource } from "@/hooks/use-api-resource"

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const

const LEGEND_COLOR_CLASSES = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-4",
  "bg-chart-5",
] as const

const CHART_CONFIG = {
  count: {
    label: "回答数",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

type AdminSummaryChartProps = {
  surveyId: string
}

/**
 * アンケート詳細と回答集計を join し、単一選択設問ごとの棒グラフを表示する。
 * summary に現れない選択肢も、詳細側の全選択肢を基準に 0 件として残す。
 */
export function AdminSummaryChart({ surveyId }: AdminSummaryChartProps) {
  const { data, error, isLoading, reload } = useApiResource(async () => {
    const [survey, summary] = await Promise.all([
      apiClient.get("/api/v1/admin/feedback/surveys/{surveyId}", {
        params: { path: { surveyId } },
      }),
      apiClient.get("/api/v1/admin/feedback/summary", {
        params: { query: { surveyId } },
      }),
    ])
    return { survey, summary }
  })

  if (isLoading) {
    return (
      <section className="flex flex-col gap-4" aria-label="集計を読み込み中">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-72 w-full" />
      </section>
    )
  }

  if (error || !data) {
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-lg border border-destructive/50 p-6"
      >
        <p className="text-sm text-destructive">
          アンケート集計の取得に失敗しました。
        </p>
        <Button variant="outline" size="sm" onClick={reload}>
          再読み込み
        </Button>
      </div>
    )
  }

  const singleChoiceQuestions = data.survey.questions.filter(
    (question) => question.type === "single_choice"
  )
  const tallyByChoice = new Map(
    data.summary.tallies.map((tally) => [
      `${tally.questionId}\u0000${tally.choiceValue}`,
      tally.count,
    ])
  )

  return (
    <section className="flex flex-col gap-4" aria-labelledby="survey-summary">
      <div className="flex flex-col gap-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="survey-summary" className="text-xl font-semibold">
            {data.survey.title}
          </h2>
          <p className="text-sm font-medium tabular-nums">
            回答者数 {data.summary.respondentCount.toLocaleString("ja-JP")} 人
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          集計は各ユーザーの最新提出のみを数えています。
        </p>
      </div>

      {singleChoiceQuestions.length === 0 ? (
        <p className="rounded-lg border p-6 text-sm text-muted-foreground">
          集計対象の単一選択設問はありません。
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {singleChoiceQuestions.map((question) => {
            const chartData = question.choices.map((choice, index) => ({
              choice: choice.label,
              count:
                tallyByChoice.get(`${question.id}\u0000${choice.value}`) ?? 0,
              color: CHART_COLORS[index % CHART_COLORS.length],
              colorClass:
                LEGEND_COLOR_CLASSES[index % LEGEND_COLOR_CLASSES.length],
            }))

            return (
              <Card key={question.id}>
                <CardHeader>
                  <CardTitle>{question.text}</CardTitle>
                  <CardDescription>
                    {chartData.length.toLocaleString("ja-JP")} 個の選択肢
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <ChartContainer
                    config={CHART_CONFIG}
                    className="aspect-auto h-64 w-full"
                    initialDimension={{ width: 480, height: 256 }}
                    aria-label={`${question.text}の回答グラフ`}
                  >
                    <BarChart
                      data={chartData}
                      accessibilityLayer
                      margin={{ top: 16, right: 16, left: 16, bottom: 24 }}
                    >
                      <CartesianGrid vertical={false} />
                      <XAxis
                        dataKey="choice"
                        tickLine={false}
                        axisLine={false}
                        interval={0}
                      />
                      <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent />}
                      />
                      <Bar dataKey="count" name="回答数" radius={4}>
                        {chartData.map((item) => (
                          <Cell key={item.choice} fill={item.color} />
                        ))}
                        <LabelList
                          dataKey="count"
                          position="top"
                          className="fill-foreground"
                        />
                      </Bar>
                    </BarChart>
                  </ChartContainer>

                  <dl
                    className="grid gap-2 sm:grid-cols-2"
                    aria-label={`${question.text}の回答数`}
                  >
                    {chartData.map((item) => (
                      <div
                        key={item.choice}
                        className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                      >
                        <dt className="flex min-w-0 items-center gap-2">
                          <span
                            aria-hidden="true"
                            className={`size-2.5 shrink-0 rounded-full ${item.colorClass}`}
                          />
                          <span className="truncate">{item.choice}</span>
                        </dt>
                        <dd className="font-medium tabular-nums">
                          {item.count.toLocaleString("ja-JP")} 件
                        </dd>
                      </div>
                    ))}
                  </dl>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </section>
  )
}
