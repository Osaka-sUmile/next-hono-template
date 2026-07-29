"use client"

import { Button } from "@workspace/ui/components/button"

type AdminPaginationProps = {
  /** フィルタ適用後の総件数 */
  total: number
  offset: number
  limit: number
  onOffsetChange: (offset: number) => void
}

/**
 * offset ベースの一覧用ページネーション。「n–m / total 件」と前へ/次へボタンを表示する。
 *
 * shadcn の `pagination` はアンカー(`<Link>`)ベースでページ番号を URL に持つ前提のため
 * 使わない。この画面群はページ状態を `useState` に置く方針
 * (URL 同期は follow-up。App Router で `useSearchParams` を使うと Suspense 境界が
 * 必要になり静的レンダリングから外れるため)。
 */
export function AdminPagination({
  total,
  offset,
  limit,
  onOffsetChange,
}: AdminPaginationProps) {
  // 呼び出し側の外で total が減り offset が範囲外になっても、start > end の
  // 不整合な表示(「21–5 / 5 件」等)にならないよう total で clamp する
  const start = total === 0 ? 0 : Math.min(offset + 1, total)
  const end = Math.min(offset + limit, total)
  const hasPrev = offset > 0
  const hasNext = end < total

  return (
    <div className="flex items-center justify-between gap-4">
      <p className="text-xs text-muted-foreground tabular-nums">
        {total === 0 ? "0 件" : `${start}–${end} / ${total} 件`}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!hasPrev}
          onClick={() => onOffsetChange(Math.max(0, offset - limit))}
        >
          前へ
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!hasNext}
          onClick={() => onOffsetChange(offset + limit)}
        >
          次へ
        </Button>
      </div>
    </div>
  )
}
