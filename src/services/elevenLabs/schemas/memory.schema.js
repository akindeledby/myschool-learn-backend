import { z } from "zod";

export const MemorySchema =
  z.object({
    memories: z.array(
      z.object({
        key: z.string(),

        value: z.string(),

        importance: z
          .number()
          .min(1)
          .max(10),

        category: z.enum([
          "learning_style",
          "strength",
          "weakness",
          "interest",
          "goal",
          "subject_preference",
          "behavior",
          "general",
        ]),
      })
    ),
  });