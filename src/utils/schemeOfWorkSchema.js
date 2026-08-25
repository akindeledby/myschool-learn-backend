import { z } from "zod";

const topicSchema = z.object({
  week: z.preprocess((value) => {
    if (value === null || value === undefined || value === "" || value === 0 || value === "0") {
      return null;
    }

    if (typeof value === "string") {
      const num = Number(value.trim());
      return Number.isNaN(num) ? null : num;
    }

    return value;
  }, z.number().int().positive().nullable()),

  title: z.string().trim().min(1),

  lessonContents: z.array(z.string()).default([]),
});

const termSchema = z.object({
  name: z.string().trim().min(1),
  topics: z.array(topicSchema).default([]),
});

const classSchema = z.object({
  name: z.string().trim().min(1),
  terms: z.array(termSchema).default([]),
});

const subjectSchema = z.object({
  name: z.string().trim().min(1),
  classes: z.array(classSchema).default([]),
});

export const schemeOfWorkSchema = z.object({
  subjects: z.array(subjectSchema).default([]),
});
