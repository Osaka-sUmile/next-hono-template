import type { ZodError } from "zod";

/** Convert Zod issues into the established compact API error message. */
export function formatZodError(err: ZodError): string {
  return err.issues
    .map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    })
    .join("; ");
}
