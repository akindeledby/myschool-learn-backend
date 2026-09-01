import { db } from "../../../lib/db.js";

import {
createConversation,
saveMessage,
} from "../../services/elevenLabs/conversation.service.js";

import {
continueCompletedTutorLesson,
} from "./continueCompletedTutorLesson.js";

export async function handleCompletedTutorLesson({
req,
res,
userId,
studentId,
topic,
objectives,
lessonProgress,
teachingState,
}) {
try {
// console.log(
// "[COMPLETED LESSON] Handler entered"
// );

if (!studentId) { 
  const error = new Error( 
    "studentId is required." 
  ); 

  error.statusCode = 400; 

  throw error; 
} 

if (!topic?.id) { 
  const error = new Error( 
    "A valid lesson topic is required." 
  ); 

  error.statusCode = 400; 

  throw error; 
} 

// console.log( 
//   "[COMPLETED LESSON] Loading student:", 
//   studentId 
// ); 

const student = 
  await db.student.findUnique({ 
    where: { 
      id: studentId, 
    }, 

    select: { 
      id: true, 
      firstName: true, 
      lastName: true, 
      classLevel: true, 
      gender: true, 
      userId: true, 
    }, 
  }); 

if (!student) { 
  const error = new Error( 
    "Student not found." 
  ); 

  error.statusCode = 404; 

  throw error; 
} 

// console.log( 
//   "[COMPLETED LESSON] Student loaded:", 
//   student.id 
// ); 

// if ( 
//   student.userId && 
//   student.userId !== userId 
// ) { 
//   const error = new Error( 
//     "Access denied." 
//   ); 

//   error.statusCode = 403; 

//   throw error; 
// } 

// console.log( 
//   "[COMPLETED LESSON] Finding conversation for topic..." 
// ); 

let conversation = 
  await db.tutorConversation.findFirst({ 
    where: { 
      studentId, 

      title: { 
        contains: 
          topic.title, 
      }, 
    }, 

    orderBy: { 
      updatedAt: "desc", 
    }, 

    include: { 
      messages: { 
        orderBy: { 
          createdAt: "asc", 
        }, 

        take: 50, 
      }, 
    }, 
  }); 

let isNewConversation = false; 

if (!conversation) { 
  // console.log( 
  //   "[COMPLETED LESSON] No existing conversation found." 
  // ); 

  // console.log( 
  //   "[COMPLETED LESSON] Creating conversation..." 
  // ); 

  conversation = 
    await createConversation({ 
      studentId, 

      title: 
        topic.title, 
    }); 

  isNewConversation = true; 

  // console.log( 
  //   "[COMPLETED LESSON] Conversation created:", 
  //   conversation?.id 
  // ); 

  if (!conversation?.id) { 
    const error = new Error( 
      "Unable to create the Tutor conversation." 
    ); 

    error.statusCode = 500; 

    throw error; 
  } 

  conversation = 
    await db.tutorConversation.findUnique({ 
      where: { 
        id: 
          conversation.id, 
      }, 

      include: { 
        messages: { 
          orderBy: { 
            createdAt: "asc", 
          }, 

          take: 50, 
        }, 
      }, 
    }); 
} else { 
  console.log( 
    "[COMPLETED LESSON] Existing conversation found:", 
    conversation.id 
  ); 
} 

if (!conversation?.id) { 
  const error = new Error( 
    "Unable to load the Tutor conversation." 
  ); 

  error.statusCode = 500; 

  throw error; 
} 

const message = 
  typeof req.body?.message === "string" 
    ? req.body.message.trim() 
    : ""; 

const normalizedMessage = 
  message || 
  `I want to continue with ${topic.title}.`; 

// console.log( 
//   "[COMPLETED LESSON] User message:", 
//   normalizedMessage 
// ); 

// console.log( 
//   "[COMPLETED LESSON] Saving user message..." 
// ); 

const savedUserMessage = 
  await saveMessage({ 
    conversationId: 
      conversation.id, 

    lessonSessionId: 
      null, 

    role: 
      "user", 

    content: 
      normalizedMessage, 
  }); 

if (!savedUserMessage?.id) { 
  const error = new Error( 
    "Unable to save the Tutor user message." 
  ); 

  error.statusCode = 500; 

  throw error; 
} 

// console.log( 
//   "[COMPLETED LESSON] User message saved:", 
//   savedUserMessage.id 
// ); 

// console.log( 
//   "[COMPLETED LESSON] Passing completed lesson to continuation handler..." 
// ); 

return await continueCompletedTutorLesson({ 
  req, 
  res, 

  student, 

  topic, 

  objectives, 

  lessonProgress, 

  teachingState, 

  message: 
    normalizedMessage, 

  conversation, 

  userMessage: 
    savedUserMessage, 

  isNewConversation, 
}); 

} catch (error) {
console.error(
"[COMPLETED LESSON] ERROR:",
error
);

if (!res.headersSent) { 
  const statusCode = 
    Number.isInteger( 
      error?.statusCode 
    ) 
      ? error.statusCode 
      : 500; 

  return res.status( 
    statusCode 
  ).json({ 
    success: false, 

    message: 
      error?.message || 
      "Unable to continue the completed Tutor lesson.", 
  }); 
} 

try { 
  res.write( 
    `data: ${JSON.stringify({ 
      type: "error", 

      message: 
        "Tutor failed while handling the completed lesson.", 
    })}\n\n` 
  ); 

  if (res.flush) { 
    res.flush(); 
  } 
} catch {} 

try { 
  res.end(); 
} catch {} 

return; 

}
}


// import { db } from "../../../lib/db.js";

// import {
//   createConversation,
// } from "../../services/elevenLabs/conversation.service.js";

// import {
//   continueCompletedTutorLesson,
// } from "./continueCompletedTutorLesson.js";

// export async function handleCompletedTutorLesson({
//   req,
//   res,
//   studentId,
//   topic,
//   objectives,
//   lessonProgress,
//   teachingState,
// }) {
//   try {
//     console.log(
//       "[COMPLETED LESSON] Handler entered"
//     );

//     if (!studentId) {
//       const error = new Error(
//         "studentId is required."
//       );

//       error.statusCode = 400;

//       throw error;
//     }

//     if (!topic?.id) {
//       const error = new Error(
//         "A valid lesson topic is required."
//       );

//       error.statusCode = 400;

//       throw error;
//     }

//     if (!teachingState?.isComplete) {
//       const error = new Error(
//         "The lesson has not been completed."
//       );

//       error.statusCode = 400;

//       throw error;
//     }

//     // console.log(
//     //   "[COMPLETED LESSON] Loading student:",
//     //   studentId
//     // );

//     const student =
//       await db.student.findUnique({
//         where: {
//           id: studentId,
//         },

//         select: {
//           id: true,
//           firstName: true,
//           lastName: true,
//           classLevel: true,
//           gender: true,
//         },
//       });

//     if (!student) {
//       const error = new Error(
//         "Student not found."
//       );

//       error.statusCode = 404;

//       throw error;
//     }

//     console.log(
//       "[COMPLETED LESSON] Lesson completion confirmed:"
//     );

//     console.log({
//       topicId: topic.id,
//       topicTitle: topic.title,
//       status: teachingState.status,
//       progressPercent:
//         teachingState.progressPercent,
//       completedObjectives:
//         teachingState.completedObjectives,
//       totalObjectives:
//         teachingState.totalObjectives,
//     });


//     let conversation =
//       await db.tutorConversation.findFirst({
//         where: {
//           studentId,

//           title: {
//             contains: topic.title,
//           },
//         },

//         orderBy: {
//           updatedAt: "desc",
//         },

//         include: {
//           messages: {
//             orderBy: {
//               createdAt: "asc",
//             },

//             take: 50,
//           },
//         },
//       });

//     let isNewConversation = false;

//     if (!conversation) {
//       // console.log(
//       //   "[COMPLETED LESSON] No existing conversation found."
//       // );

//       // console.log(
//       //   "[COMPLETED LESSON] Creating conversation..."
//       // );

//       conversation =
//         await createConversation({
//           studentId,

//           title: topic.title,
//         });

//       isNewConversation = true;

//       // console.log(
//       //   "[COMPLETED LESSON] Conversation created:",
//       //   conversation?.id
//       // );

//       if (!conversation?.id) {
//         const error = new Error(
//           "Unable to create the Tutor conversation."
//         );

//         error.statusCode = 500;

//         throw error;
//       }

//       conversation =
//         await db.tutorConversation.findUnique({
//           where: {
//             id: conversation.id,
//           },

//           include: {
//             messages: {
//               orderBy: {
//                 createdAt: "asc",
//               },

//               take: 50,
//             },
//           },
//         });
//     } else {
//       // console.log(
//       //   "[COMPLETED LESSON] Existing conversation found:",
//       //   conversation.id
//       // );
//     }

//     if (!conversation?.id) {
//       const error = new Error(
//         "Unable to load the Tutor conversation."
//       );

//       error.statusCode = 500;

//       throw error;
//     }

//     const message =
//       typeof req.body?.message === "string"
//         ? req.body.message.trim()
//         : "";

//     // console.log(
//     //   "[COMPLETED LESSON] Incoming message:",
//     //   message || "[NONE]"
//     // );

//     // console.log(
//     //   "[COMPLETED LESSON] Passing completed lesson to continuation handler..."
//     // );

//     return await continueCompletedTutorLesson({
//       req,
//       res,

//       student,

//       topic,

//       objectives,

//       lessonProgress,

//       teachingState,

//       message,

//       conversation,

//       isNewConversation,
//     });
//   } catch (error) {
//     console.error(
//       "[COMPLETED LESSON] ERROR:",
//       error
//     );

//     if (!res.headersSent) {
//       const statusCode =
//         Number.isInteger(
//           error?.statusCode
//         )
//           ? error.statusCode
//           : 500;

//       return res.status(
//         statusCode
//       ).json({
//         success: false,

//         message:
//           error?.message ||
//           "Unable to continue the completed Tutor lesson.",
//       });
//     }

//     try {
//       res.write(
//         `data: ${JSON.stringify({
//           type: "error",
//           message:
//             "Tutor failed while handling the completed lesson.",
//         })}\n\n`
//       );

//       if (res.flush) {
//         res.flush();
//       }
//     } catch {}

//     try {
//       res.end();
//     } catch {}

//     return;
//   }
// }
