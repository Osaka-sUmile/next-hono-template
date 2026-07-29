import { Prisma, PrismaClient } from "@prisma/client"
import {
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
   */
  async activateExclusively(id: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.feedbackSurvey.updateMany({
        where: { isActive: true, id: { not: id } },
        data: { isActive: false },
      }),
      this.prisma.feedbackSurvey.update({
        where: { id },
        data: { isActive: true },
      }),
    ])
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

function isSlugUniqueViolation(error: unknown): boolean {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== "P2002"
  ) {
    return false
  }
  const target = error.meta?.["target"]
  // target の形はドライバ・バージョンによって配列と文字列のどちらもありうる。
  if (Array.isArray(target)) return target.includes("slug")
  if (typeof target === "string") return target.includes("slug")
  // target が取れない場合、FeedbackSurvey の他の一意制約は id (主キー) のみであり、
  // id 衝突は upsert の update 分岐に入るためここには来ない。slug 衝突として扱う。
  return true
}
