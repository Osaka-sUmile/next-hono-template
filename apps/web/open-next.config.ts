import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// 最小構成。現時点で ISR / "use cache" は未使用のため incrementalCache は指定しない。
// 将来 ISR や "use cache" を導入する場合は、R2 バケットを用意した上で
// `incrementalCache: r2IncrementalCache` を追加すること。
// see: https://opennext.js.org/cloudflare/caching
export default defineCloudflareConfig({});
