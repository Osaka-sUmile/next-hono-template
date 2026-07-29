import "dotenv/config"
import { defineConfig } from "prisma/config"
import { getTestDatabaseUrl } from "./src/test-utils/database-url"

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: getTestDatabaseUrl(),
  },
})
