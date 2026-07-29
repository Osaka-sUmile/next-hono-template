import "dotenv/config"

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"])

function printUsage(): void {
  console.error(
    "Usage: pnpm --filter @workspace/database promote-admin -- <email> [--local]"
  )
}

function parseArguments(args: string[]): {
  email: string
  forceLocal: boolean
} {
  const forceLocal = args.includes("--local")
  const positional = args.filter((arg) => arg !== "--local" && arg !== "--")

  if (positional.length !== 1 || positional[0]?.startsWith("-")) {
    printUsage()
    process.exit(1)
  }

  return { email: positional[0], forceLocal }
}

function isLocalDatabase(connectionString: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(connectionString).hostname)
  } catch {
    console.error("DATABASE_URL is not a valid URL.")
    process.exit(1)
  }
}

async function main(): Promise<void> {
  const { email, forceLocal } = parseArguments(process.argv.slice(2))
  const url = process.env.DATABASE_URL

  if (!url) {
    console.error(
      "DATABASE_URL is not set. Configure packages/database/.env or pass it as an environment variable."
    )
    process.exit(1)
  }

  const localProxy = forceLocal || isLocalDatabase(url)
  const { createPrismaClient } = await import("../src/client")
  const prisma = createPrismaClient(url, { localProxy })

  try {
    const user = await prisma.user.update({
      where: { email },
      data: { role: "admin" },
      select: { email: true },
    })
    console.log(`Promoted ${user.email} to admin.`)
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === "P2025"
    ) {
      console.error(
        `User not found: ${email}. Sign up with this email before running the script.`
      )
      process.exitCode = 1
      return
    }
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

await main()
