import { schemeOfWorkSchema } from "./schemeOfWorkSchema.js";

export function validateSchemeOfWork(data) {
  const result = schemeOfWorkSchema.safeParse(data);

  if (!result.success) {
    console.error(
      "❌ Scheme of Work Validation Error:",
      JSON.stringify(result.error.format(), null, 2)
    );

    throw new Error("Invalid Scheme of Work structure.");
  }

  return result.data;
}
