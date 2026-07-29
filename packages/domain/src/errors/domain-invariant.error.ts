import { DomainError } from "./domain.error"

/**
 * 永続化データの破損やプログラム上の前提違反など、利用者には修正できない不整合。
 *
 * Application / Presentation で想定内エラーへ変換せず、500 と監視の対象にする。
 */
export abstract class DomainInvariantError extends DomainError {}
