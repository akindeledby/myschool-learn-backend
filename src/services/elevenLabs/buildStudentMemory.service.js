import { db } from "../../../lib/db.js";

export async function buildStudentMemory(
  studentId
) {
  const memories =
    await db.tutorMemory.findMany({
      where: {
        studentId,
      },

      orderBy: [
        {
          importance: "desc",
        },
        {
          updatedAt: "desc",
        },
      ],

      take: 30,
    });

  if (!memories.length) {
    return "No stored memory.";
  }

  const grouped = {};

  for (const memory of memories) {
    const category =
      memory.category ||
      "general";

    if (!grouped[category]) {
      grouped[category] = [];
    }

    grouped[category].push(
      `${memory.key}: ${memory.value}`
    );
  }

    return Object.entries(
      grouped
    )
      .map(
        ([category, items]) => `
    ${category.toUpperCase()}

    ${items
      .map(
        (item) => `• ${item}`
      )
      .join("\n")}
    `
    )
    .join("\n");
}