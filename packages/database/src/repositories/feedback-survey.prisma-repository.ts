import { Prisma, PrismaClient } from "@prisma/client"
import {
  EmptyActiveFeedbackSurveyError,
  FeedbackChoice,
  FeedbackQuestionEntity,
  FeedbackSurveyEntity,
  FeedbackSurveySlugConflictError,
  IFeedbackSurveyRepository,
  parseFeedbackQuestionType,
} from "@workspace/domain"

type FeedbackSurveyWithQuestions = Prisma.FeedbackSurveyGetPayload<{
  include: {
    questions: {
      include: {
        choices: true
      }
    }
  }
}>

const SURVEY_INCLUDE = {
  questions: {
    include: {
      choices: {
        orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      },
    },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  },
} satisfies Prisma.FeedbackSurveyInclude

export class FeedbackSurveyPrismaRepository implements IFeedbackSurveyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findActive(): Promise<FeedbackSurveyEntity | null> {
    const survey = await this.prisma.feedbackSurvey.findFirst({
      where: { isActive: true },
      include: SURVEY_INCLUDE,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    })
    if (!survey) return null
    return this.toDomain(survey)
  }

  async findById(id: string): Promise<FeedbackSurveyEntity | null> {
    const survey = await this.prisma.feedbackSurvey.findUnique({
      where: { id },
      include: SURVEY_INCLUDE,
    })
    if (!survey) return null
    return this.toDomain(survey)
  }

  async findBySlug(slug: string): Promise<FeedbackSurveyEntity | null> {
    const survey = await this.prisma.feedbackSurvey.findUnique({
      where: { slug },
      include: SURVEY_INCLUDE,
    })
    if (!survey) return null
    return this.toDomain(survey)
  }

  /**
   * create 分岐と update 分岐で扱う範囲が意図的に非対称であることに注意。
   *
   * - create: 設問・選択肢をネストして一括作成する（回答が存在しないため安全）。
   * - update: スカラー (slug / title / isActive) だけを更新し、設問・選択肢には一切触らない。
   *
   * `FeedbackAnswer.choiceId` が `onDelete: Restrict`、`FeedbackChoice.question` が
   * `onDelete: Cascade` であるため、既存設問の入れ替えは回答済みデータに対して一般に失敗する。
   * `UserPrismaRepository.save` が `emailVerified` を触らないのと同じ形で、更新対象から外している。
   * したがって「既存アンケートに対して設問を変えて save しても設問は変わらない」。
   * 設問の編集は別途専用の経路（提出 0 件ガード付きの置き換え等）を設計する必要がある。
   */
  async save(entity: FeedbackSurveyEntity): Promise<FeedbackSurveyEntity> {
    try {
      const survey = await this.prisma.feedbackSurvey.upsert({
        where: { id: entity.id },
        update: {
          slug: entity.slug,
          title: entity.title,
          isActive: entity.isActive,
        },
        create: {
          id: entity.id,
          slug: entity.slug,
          title: entity.title,
          isActive: entity.isActive,
          questions: {
            create: entity.questions.map((question) => ({
              id: question.id,
              type: question.type,
              text: question.text,
              required: question.required,
              sortOrder: question.sortOrder,
              choices: {
                create: question.choices.map((choice) => ({
                  id: choice.id,
                  value: choice.value,
                  label: choice.label,
                  sortOrder: choice.sortOrder,
                })),
              },
            })),
          },
        },
        include: SURVEY_INCLUDE,
      })
      return this.toDomain(survey)
    } catch (error) {
      // slug の一意制約違反だけをドメインエラーへ翻訳する。use-case 側で findBySlug を
      // 事前チェックする方式は TOCTOU で結果的に 500 になるため採らない。
      if (isSlugUniqueViolation(error)) {
        throw new FeedbackSurveySlugConflictError(entity.slug)
      }
      throw error
    }
  }

  async delete(entity: FeedbackSurveyEntity): Promise<void> {
    await this.prisma.feedbackSurvey.delete({ where: { id: entity.id } })
  }

  /**
   * 「同時にアクティブなのは 1 件」を 1 つのトランザクションで保つ。
   * Prisma スキーマは `UNIQUE ... WHERE "isActive"` の部分ユニークを表現できないため DB 制約は張らない。
   * 有効化が同時に走ると両方アクティブになりうるが、admin 限定・低並行性のため許容し、
   * `findActive()` の並び順は決定的に保つ。
   *
   * 設問件数の確認を同じトランザクション内で行うため、配列形式ではなく
   * インタラクティブトランザクションを使う。これにより事前条件違反は
   * 「他を無効化したのに対象を有効化できず、アクティブ 0 件になる」中間状態を残さず
   * ロールバックされる。
   */
  async activateExclusively(entity: FeedbackSurveyEntity): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Entity 側の不変条件（設問 0 件は公開不可）を永続化状態に対しても検証する。
      // Entity は読み込み時点のスナップショットであり、その後に設問が消えている可能性がある。
      const survey = await tx.feedbackSurvey.findUnique({
        where: { id: entity.id },
        select: { _count: { select: { questions: true } } },
      })
      if (!survey || survey._count.questions === 0) {
        throw new EmptyActiveFeedbackSurveyError(entity.id)
      }
      await tx.feedbackSurvey.updateMany({
        where: { isActive: true, id: { not: entity.id } },
        data: { isActive: false },
      })
      await tx.feedbackSurvey.update({
        where: { id: entity.id },
        data: { isActive: true },
      })
    })
  }

  private toDomain(model: FeedbackSurveyWithQuestions): FeedbackSurveyEntity {
    try {
      const questions = model.questions.map((question) =>
        FeedbackQuestionEntity.reconstitute(
          question.id,
          parseFeedbackQuestionType(question.type),
          question.text,
          question.required,
          question.sortOrder,
          question.choices.map((choice) =>
            FeedbackChoice.reconstitute(
              choice.id,
              choice.value,
              choice.label,
              choice.sortOrder
            )
          )
        )
      )
      return FeedbackSurveyEntity.reconstitute(
        model.id,
        model.slug,
        model.title,
        model.isActive,
        questions
      )
    } catch (error) {
      throw new Error(
        `Failed to reconstitute FeedbackSurveyEntity (id=${model.id})`,
        {
          cause: error,
        }
      )
    }
  }
}

/**
 * P2002 が「FeedbackSurvey.slug の衝突」かどうかを判定する。
 *
 * save() の create 分岐は FeedbackQuestion / FeedbackChoice をネスト作成するため、
 * それらの主キーや `@@unique` 違反も同じ P2002 として到達しうる。しかも
 * ネストした設問の主キー衝突は `meta.modelName` が外側の "FeedbackSurvey" になるため、
 * モデル名では判別できない。違反した制約のフィールドで判定する必要がある。
 *
 * 判別できない場合は slug 衝突として扱わず、元のエラーをそのまま伝播させる。
 * 真因を隠して「slug 重複」として後続層に見せるより、500 として観測できる方が安全。
 */
function isSlugUniqueViolation(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return false
  }
  const fields = extractUniqueConstraintFields(error.meta)
  return fields !== null && fields.length === 1 && fields[0] === "slug"
}

/**
 * P2002 の meta から違反した一意制約のフィールド名を取り出す。判別できなければ null。
 *
 * Prisma 7 を driver adapter (Neon) 経由で使うと `meta.target` は設定されず、
 * `meta.driverAdapterError.cause.constraint.fields` に入る。素の engine 経由の
 * `meta.target` も将来のドライバ差異に備えて読む。
 */
function extractUniqueConstraintFields(meta: unknown): string[] | null {
  const target = asRecord(meta)?.["target"]
  if (Array.isArray(target)) return target.map(normalizeFieldName)
  if (typeof target === "string")
    return target.split(",").map(normalizeFieldName)

  const fields = asRecord(
    asRecord(asRecord(asRecord(meta)?.["driverAdapterError"])?.["cause"])?.[
      "constraint"
    ]
  )?.["fields"]
  if (Array.isArray(fields)) return fields.map(normalizeFieldName)

  return null
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null
}

// driver adapter は `"surveyId"` のように引用符付きのフィールド名を返すことがある。
function normalizeFieldName(field: unknown): string {
  return String(field).trim().replace(/^"|"$/g, "")
}
