import { Prisma, PrismaClient } from "@prisma/client"
import {
  IUserQueryService,
  UserQueryResult,
  UserSearchParams,
  UserSearchResult,
  parseUserRole,
} from "@workspace/domain"

export class UserQueryService implements IUserQueryService {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<UserQueryResult | null> {
    const raw = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        displayName: true,
        image: true,
        emailVerified: true,
        createdAt: true,
      },
    })
    if (!raw) return null
    try {
      return { ...raw, role: parseUserRole(raw.role) }
    } catch (err) {
      throw new Error(
        `Failed to map user query result (id=${raw.id}, role="${raw.role}"): ${String(err)}`
      )
    }
  }

  async search({
    limit,
    offset,
    search,
    role,
  }: UserSearchParams): Promise<UserSearchResult> {
    const where: Prisma.UserWhereInput = {
      ...(role === undefined ? {} : { role }),
      ...(search === undefined
        ? {}
        : {
            OR: [
              { email: { contains: search, mode: "insensitive" } },
              { name: { contains: search, mode: "insensitive" } },
              { displayName: { contains: search, mode: "insensitive" } },
            ],
          }),
    }

    const [total, rows] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          displayName: true,
          image: true,
          emailVerified: true,
          createdAt: true,
        },
        skip: offset,
        take: limit,
        // createdAt が同一のレコード間でも順序を決定的にするため id を tie-breaker に加える。
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      }),
    ])

    const items = rows.map((raw) => {
      try {
        return { ...raw, role: parseUserRole(raw.role) }
      } catch (err) {
        throw new Error(
          `Failed to map user query result (id=${raw.id}, role="${raw.role}"): ${String(err)}`
        )
      }
    })

    return { items, total }
  }
}
