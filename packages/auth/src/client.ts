import { createAuthClient } from "better-auth/react";
import { emailOTPClient, inferAdditionalFields } from "better-auth/client/plugins";
import type { AuthInstance } from "./server";

export function createClient(baseURL: string) {
  return createAuthClient({
    baseURL,
    plugins: [
      emailOTPClient(),
      inferAdditionalFields<AuthInstance>(),
    ],
  });
}
