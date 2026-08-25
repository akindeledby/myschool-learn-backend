import { db } from "../../../lib/db.js";
import { resolveStudent } from "../elevenLabs/studentResolver.service.js";

export async function verifyConversationOwnership({
  userId,
  studentId,
  conversationId,
}) {
  
  const student =
    await resolveStudent({
      userId,
      studentId,
    });

  if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

  const conversation =
    await db.tutorConversation.findFirst({
      where: {
        id: conversationId,
        studentId: student.id,
      },
    });

  return conversation;
}