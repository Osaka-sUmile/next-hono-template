"use client";

import { forwardRef } from "react";
import { useTheme } from "next-themes";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";

const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
if (!siteKey) {
  throw new Error("NEXT_PUBLIC_TURNSTILE_SITE_KEY is required");
}

type TurnstileWidgetProps = {
  onSuccess: (token: string) => void;
  onExpire?: () => void;
};

/**
 * Cloudflare Turnstile(Managed モード)のウィジェット。ウィジェットのモード自体は
 * Cloudflare ダッシュボード側のサイトキー設定で決まる(issue #41)。
 */
export const TurnstileWidget = forwardRef<TurnstileInstance, TurnstileWidgetProps>(
  function TurnstileWidget({ onSuccess, onExpire }, ref) {
    const { resolvedTheme } = useTheme();

    return (
      <Turnstile
        ref={ref}
        siteKey={siteKey}
        onSuccess={onSuccess}
        onExpire={onExpire}
        options={{ theme: resolvedTheme === "dark" ? "dark" : "light" }}
      />
    );
  },
);
