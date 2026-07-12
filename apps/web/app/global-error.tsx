"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function GlobalError({ error, reset }: Props) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center gap-4">
          <h1 className="text-4xl font-bold">深刻なエラーが発生しました</h1>
          <p>ページを再読み込みしてください。</p>
          <button onClick={reset}>再試行</button>
        </div>
      </body>
    </html>
  );
}
