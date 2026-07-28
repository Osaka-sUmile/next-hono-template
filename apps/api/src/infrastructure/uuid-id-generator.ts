import type { IIdGenerator } from "@workspace/domain";

/**
 * Web Crypto の randomUUID() を使う IIdGenerator 実装。
 *
 * ドメイン層は「ID を採番できる何か」しか知らないため、採番方式はここに閉じる。
 * Cloudflare Workers / Node.js の双方で globalThis.crypto から利用できるので、
 * 追加依存なしで衝突耐性のある識別子を得られる。
 */
export class UuidIdGenerator implements IIdGenerator {
  generate(): string {
    return crypto.randomUUID();
  }
}
