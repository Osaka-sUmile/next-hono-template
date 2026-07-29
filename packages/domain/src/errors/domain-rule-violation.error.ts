import { DomainError } from "./domain.error"

/**
 * 形式上は正しい操作が業務ルールを満たさず、利用者が入力や操作を修正できる拒否。
 *
 * Domain は HTTP を知らないため、この型を直接 HTTP エラーへ変換しない。
 * Application 境界でユースケース固有の ApplicationError へ翻訳する。
 */
export abstract class DomainRuleViolationError extends DomainError {}
