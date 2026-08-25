import { db } from "../../../lib/db.js";

export async function createConversation({
  studentId,
  title,
}) {
  return db.tutorConversation.create({
    data: {
      studentId,
      title,
    },
  });
}

export async function saveMessage({
  conversationId,
  role,
  content,
}) {
  const message =
    await db.tutorMessage.create({
      data: {
        conversationId,
        role,
        content,
      },
    });

  await db.tutorConversation.update({
    where: {
      id: conversationId,
    },
    data: {
      updatedAt: new Date(),
    },
  });

  return message;
}

export async function getConversation(
  conversationId
) {
  return db.tutorConversation.findUnique({
    where: {
      id: conversationId,
    },
    include: {
      messages: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });
}

export async function getStudentConversations(
  studentId
) {
  return db.tutorConversation.findMany({
    where: {
      studentId,
    },
    orderBy: {
      updatedAt: "desc",
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function deleteConversation(
  conversationId
) {
  return db.tutorConversation.delete({
    where: {
      id: conversationId,
    },
  });
}