import { createClient } from "@workspace/auth/client";

const apiUrl = process.env.NEXT_PUBLIC_API_URL;
if (!apiUrl) {
  throw new Error("NEXT_PUBLIC_API_URL is required");
}

export const authClient = createClient(apiUrl);
