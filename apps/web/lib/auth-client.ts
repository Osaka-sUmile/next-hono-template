import { createClient } from "@workspace/auth/client";

export const authClient = createClient(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080",
);
