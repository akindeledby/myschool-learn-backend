import { z } from "zod";

export const TopicSchema = z.object({
  topic: z.string(),

  subject: z
    .string()
    .optional(),

  masteryScore: z
    .number()
    .min(0)
    .max(100),

  strengths: z.array(
    z.string()
  ),

  weaknesses: z.array(
    z.string()
  ),
});