"use client"

import { useEffect, useRef, useState } from "react"
import { Badge } from "@workspace/ui/components/badge"
import { Button } from "@workspace/ui/components/button"
import { Input } from "@workspace/ui/components/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"
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
import { authClient } from "@/lib/auth-client"
import { useApiResource } from "@/hooks/use-api-resource"
import { AdminPagination } from "@/components/admin-pagination"
import { AdminUserRoleSelect } from "@/components/admin-user-role-select"

const PAGE_SIZE = 20
const SEARCH_DEBOUNCE_MS = 300

const ROLE_FILTERS = [
  { value: "all", label: "すべてのロール" },
  { value: "user", label: "一般" },
  { value: "admin", label: "管理者" },
] as const

type RoleFilter = (typeof ROLE_FILTERS)[number]["value"]

const COLUMN_COUNT = 5

/**
 * ユーザー一覧(検索・ロールフィルタ・ページング・ロール変更)。
 * `GET /api/v1/admin/users` を表示し、行内の `AdminUserRoleSelect` から
 * `PATCH .../role` で書き込む。成功時は一覧を reload する(楽観更新はしない)。
 *
 * ページング・検索の状態は `useState` に置き、URL には持たせない
 * (`useSearchParams` は Suspense 境界が必要になり静的レンダリングから外れるため。
 * URL 同期は follow-up)。
 */
export function AdminUsersTable() {
  // 操作者自身の行のロール変更を disable するために参照する。
  // AdminGuard の内側で描画されるため、セッションは通常存在する。
  const { data: session } = authClient.useSession()
  const currentUserId = session?.user.id

  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all")
  const [offset, setOffset] = useState(0)

  const { data, error, isLoading, reload } = useApiResource(() =>
    apiClient.get("/api/v1/admin/users", {
      params: {
        query: {
          limit: PAGE_SIZE,
          offset,
          ...(search === "" ? {} : { search }),
          ...(roleFilter === "all" ? {} : { role: roleFilter }),
        },
      },
    })
  )

  // reload の結果 total が現在のページより手前まで減った場合(例: role フィルタ中に
  // ページ最後の 1 件のロールを変更した場合)、最終ページへ巻き戻す。
  // レンダー中の状態調整パターン。offset の変更は下の effect が reload に変換する
  if (data && offset > 0 && data.total <= offset) {
    setOffset(Math.max(0, Math.floor((data.total - 1) / PAGE_SIZE) * PAGE_SIZE))
  }

  // 検索入力のデバウンス。確定時に 1 ページ目へ戻す
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim())
      setOffset(0)
    }, SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [searchInput])

  // useApiResource は reload() でのみ再取得するため、検索条件・ページの変更を
  // reload に変換する。初回マウント時はフック自身が取得するのでスキップする
  const isFirstRun = useRef(true)
  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false
      return
    }
    reload()
  }, [search, roleFilter, offset, reload])

  function handleRoleFilterChange(value: string) {
    const next = ROLE_FILTERS.find((f) => f.value === value)?.value
    if (next === undefined) return
    setRoleFilter(next)
    setOffset(0)
  }

  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-lg border border-destructive/50 p-6"
      >
        <p className="text-sm text-destructive">
          ユーザー一覧の取得に失敗しました。
        </p>
        <Button variant="outline" size="sm" onClick={reload}>
          再読み込み
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="メール・名前・表示名で検索"
          aria-label="ユーザーを検索"
          // API 側 ListUsersQuerySchema の search 上限(100 文字)のミラー。
          // 超過入力をそのまま送ると 400 になり、エラーパネルから復帰できない
          maxLength={100}
          className="max-w-xs"
        />
        <Select value={roleFilter} onValueChange={handleRoleFilterChange}>
          <SelectTrigger aria-label="ロールで絞り込み">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROLE_FILTERS.map((filter) => (
              <SelectItem key={filter.value} value={filter.value}>
                {filter.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>メールアドレス</TableHead>
              <TableHead>名前</TableHead>
              <TableHead>表示名</TableHead>
              <TableHead>ロール</TableHead>
              <TableHead>ロール変更</TableHead>
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
                  該当するユーザーがいません。
                </TableCell>
              </TableRow>
            ) : (
              data.items.map((user) => {
                const isSelf = user.id === currentUserId
                return (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      <span className="inline-flex items-center gap-2">
                        {user.email}
                        {isSelf && <Badge variant="outline">自分</Badge>}
                      </span>
                    </TableCell>
                    <TableCell>{user.name || "—"}</TableCell>
                    <TableCell>{user.displayName ?? "—"}</TableCell>
                    <TableCell>
                      {user.role === "admin" ? (
                        <Badge>管理者</Badge>
                      ) : (
                        <Badge variant="secondary">一般</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <AdminUserRoleSelect
                        userId={user.id}
                        role={user.role}
                        userEmail={user.email}
                        disabled={isSelf}
                        onChanged={reload}
                      />
                    </TableCell>
                  </TableRow>
                )
              })
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
    </div>
  )
}
