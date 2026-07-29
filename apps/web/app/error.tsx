"use client"

import { useEffect } from "react"
import * as Sentry from "@sentry/nextjs"

type Props = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function Error({ error, reset }: Props) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">エラーが発生しました</h1>
      <p className="text-muted-foreground">予期せぬエラーが発生しました。</p>
      <button
        onClick={reset}
        className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
      >
        再試行
      </button>
    </div>
  )
}
