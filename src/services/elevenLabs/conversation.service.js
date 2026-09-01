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
  lessonSessionId = null,
  role,
  content,
  contentBlocks,
  images,
  audioSegments,
}) {
  const message = await db.tutorMessage.create({
    data: {
      conversationId,

      lessonSessionId,

      role,

      content,

      ...(contentBlocks !== undefined && {
        contentBlocks,
      }),

      ...(images !== undefined && {
        images,
      }),

      ...(audioSegments !== undefined && {
        audioSegments,
      }),
    },
  });

  /*
   * Keep the conversation's updatedAt timestamp current.
   *
   * This is important for both:
   *
   * 1. Normal Tutor Chat
   * 2. Curriculum based Tutor Lessons
   */
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

// export async function saveMessage({
//   conversationId,
//   role,
//   content,
//   contentBlocks,
//   images,
//   audioSegments,
// }) {
//   const message =
//     await db.tutorMessage.create({
//       data: {
//         conversationId,
//         role,
//         content,

//         contentBlocks:
//           contentBlocks?.length > 0
//             ? contentBlocks
//             : undefined,

//         images:
//           images?.length > 0
//             ? images
//             : undefined,

//         audioSegments:
//           audioSegments?.length > 0
//             ? audioSegments
//             : undefined,
//       },
//     });

//   await db.tutorConversation.update({
//     where: {
//       id: conversationId,
//     },

//     data: {
//       updatedAt: new Date(),
//     },
//   });

//   return message;
// }


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