import { createClient } from "@workspace/auth/client";

const apiUrl = process.env.NEXT_PUBLIC_API_URL;
if (!apiUrl) {
  throw new Error("NEXT_PUBLIC_API_URL is required");
}

/** API のベース URL（better-auth 以外の REST 呼び出しでも使う）。 */
export const apiBaseUrl = apiUrl;

export const authClient = createClient(apiUrl);
