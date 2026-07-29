import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(callback: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY)
  mql.addEventListener("change", callback)
  return () => mql.removeEventListener("change", callback)
}

/**
 * shadcn 生成版は useEffect 内で同期 setState していて
 * react-hooks/set-state-in-effect に違反するため、
 * useSyncExternalStore ベースの等価実装に置き換えている。
 * SSR では false(デスクトップ扱い)を返す。
 */
export function useIsMobile() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false
  )
}
