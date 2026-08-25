import { z } from "zod";

export const LessonPlanSchema = z.object({
  title: z.string(),

  scenes: z.array(
    z.object({
      sceneType: z.string(),
      title: z.string(),
      targetSeconds: z.number().positive(),
    })
  ),
});