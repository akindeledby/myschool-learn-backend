import { z } from "zod";

export const InsightSchema =
  z.object({
    strongestSubject:
      z.string(),

    weakestSubject:
      z.string(),

    recommendedTopics:
      z.array(
        z.string()
      ),

    nextGoal:
      z.string(),
  });