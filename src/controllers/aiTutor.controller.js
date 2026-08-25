import { db } from "../../lib/db.js";
import { classifyQuestion } from "../services/elevenLabs/questionModeration.service.js";
import { buildTutorPrompt } from "../services/elevenLabs/tutorPrompt.service.js";
import { verifyConversationOwnership } from "../services/elevenLabs/conversationOwnership.service.js";
import { buildStudentMemory } from "../services/elevenLabs/buildStudentMemory.service.js";
import { resolveStudent } from "../services/elevenLabs/studentResolver.service.js";
import { createConversation, saveMessage, getConversation, getStudentConversations } from "../services/elevenLabs/conversation.service.js";
import { streamTutorResponse } from "../services/elevenLabs/aiTutorStream.service.js";
import { buildTutorContext } from "../services/elevenLabs/tutorContext.service.js";
import { updateTutorMemory } from "../services/elevenLabs/tutorMemory.service.js";
import { generateConversationSummary } from "../services/elevenLabs/tutorSessionSummary.service.js";
import { updateTopicProgress } from "../services/elevenLabs/topicProgress.service.js";
import { generateLearningInsights } from "../services/elevenLabs/learningInsights.service.js";
import { updateLearningProfile } from "../services/elevenLabs/learningProfile.service.js";
import { checkAchievements } from "../services/elevenLabs/achievement.service.js";
import { checkSubscriptionAccess } from "../services/subscription/subscription.access.js";
import { SUBSCRIPTION_FEATURES } from "../services/subscription/subscription.constants.js";
import { generateTutorSpeech } from "../services/audio/tts.service.js";


export function extractCompleteSentences(buffer) {
  if (!buffer) {
    return {
      sentences: [],
      remainder: "",
    };
  }

  const sentences = [];

  /*
  ==========================================
  Sentence detection
  ==========================================
  */

  const regex =
    /([\s\S]*?[.!?]+)(?=\s+(?=[A-Z0-9"'“‘(])|$)/g;

  let match;
  let consumedLength = 0;

  while ((match = regex.exec(buffer)) !== null) {
    const sentence = match[1].trim();

    if (!sentence) {
      continue;
    }

    /*
    ========================================
    Avoid treating decimal numbers as
    sentence endings.
    ========================================
    */

    if (
      /^\d+\.\d+$/.test(sentence) ||
      /\b\d+\.\d+$/.test(sentence)
    ) {
      continue;
    }

    sentences.push(sentence);

    consumedLength = regex.lastIndex;
  }

  /*
  ==========================================
  Remaining incomplete sentence
  ==========================================
  */

  const remainder =
    consumedLength > 0
      ? buffer.slice(consumedLength)
      : buffer;

  return {
    sentences,
    remainder,
  };
}

export async function chatWithTutorStream(req, res) {
  try {
    const userId = req.user.userId;

    const {
      studentId,
      conversationId,
      message,
    } = req.body;

    if (!message?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    const student = await resolveStudent({
      userId,
      studentId,
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    const access =
      await checkSubscriptionAccess({
        userId,
        feature: SUBSCRIPTION_FEATURES.AI_CHAT,
      });

    if (!access.success) {
      return res.status(403).json(access);
    }

    const classification =
      await classifyQuestion(message);

    const normalizedMessage =
      message.trim().toLowerCase();

    const greetings = [
      "hello",
      "hi",
      "hey",
      "thanks",
      "that is good",
      "that's good",
      "that is great",
      "that's great",
    ];

    if (
      classification !== "ACADEMIC" &&
      !greetings.includes(normalizedMessage)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "I am an educational tutor and can only assist with academic learning.",
      });
    }

    const tutorContext =
      await buildTutorContext(student.id);

    const systemPrompt =
      buildTutorPrompt({
        firstName:
          student.firstName || "Student",

        classLevel:
          student.classLevel || "Unknown",

        context: tutorContext,
      });

    let conversation;
    let isNewConversation = false;

    /*
    ==========================================
    GET OR CREATE CONVERSATION
    ==========================================
    */

    if (conversationId) {
      const ownedConversation =
        await verifyConversationOwnership({
          userId,
          studentId,
          conversationId,
        });

      if (!ownedConversation) {
        return res.status(403).json({
          success: false,
          message: "Access denied",
        });
      }

      conversation =
        await getConversation(
          conversationId
        );

      if (!conversation) {
        return res.status(404).json({
          success: false,
          message:
            "Conversation not found",
        });
      }
    } else {
      const title =
        message.length > 50
          ? `${message.substring(0, 50)}...`
          : message;

      conversation =
        await createConversation({
          studentId: student.id,
          title,
        });

      isNewConversation = true;
    }

    /*
    ==========================================
    SAVE USER MESSAGE
    ==========================================
    */

    await saveMessage({
      conversationId: conversation.id,
      role: "user",
      content: message,
    });

    /*
    ==========================================
    REFRESH CONVERSATION
    ==========================================
    */

    conversation =
      await getConversation(
        conversation.id
      );

    const previousMessages =
      conversation.messages
        ?.slice(0, -1)
        ?.slice(-20)
        ?.map((msg) => ({
          role:
            msg.role === "assistant"
              ? "model"
              : "user",

          parts: [
            {
              text: msg.content,
            },
          ],
        })) || [];

    /*
    ==========================================
    SSE HEADERS
    ==========================================
    */

    res.setHeader(
      "Content-Type",
      "text/event-stream"
    );

    res.setHeader(
      "Cache-Control",
      "no-cache, no-transform"
    );

    res.setHeader(
      "Connection",
      "keep-alive"
    );

    if (res.flushHeaders) {
      res.flushHeaders();
    }

    /*
    ==========================================
    NEW CONVERSATION EVENT
    ==========================================
    */

    if (isNewConversation) {
      res.write(
        `data: ${JSON.stringify({
          type: "conversation",
          conversation: {
            id: conversation.id,
            title: conversation.title,
            createdAt:
              conversation.createdAt,
            updatedAt:
              conversation.updatedAt,
          },
        })}\n\n`
      );

      if (res.flush) {
        res.flush();
      }
    }

    /*
    ==========================================
    START GEMINI STREAM
    ==========================================
    */

    /*
==========================================
START GEMINI STREAM
==========================================
*/

    let fullResponse = "";

    let sentenceBuffer = "";

    const stream =
      await streamTutorResponse({
        systemPrompt,
        message,
        previousMessages,
      });

    /*
    ==========================================
    SEND TEXT + AUDIO TO FRONTEND
    ==========================================
    */



    /*
    ==========================================
    PROCESS GEMINI CHUNKS
    ==========================================
    */

    let sentenceSequence = 0;

    const ttsTasks = [];

    const pendingSentences = new Map();

    let nextSequenceToSend = 1;

    async function processSentence(
      sentence,
      sequence
    ) {
      try {
        const speech =
          await generateTutorSpeech({
            text: sentence,
            voice: "default",
            speed: 1,
          });

        // pendingSentences.set(
        //   sequence,
        //   {
        //     sequence,
        //     text: speech?.text || sentence,
        //     audio: speech?.audioBuffer
        //       ? speech.audioBuffer.toString("base64")
        //       : null,
        //   }
        // );
        pendingSentences.set(
          sequence,
          {
            sequence,
            text: sentence,
            audio: speech?.audioBuffer
              ? speech.audioBuffer.toString("base64")
              : null,
          }
        );

        /*
        ========================================
        Send completed sentences in order
        ========================================
        */

        while (
          pendingSentences.has(
            nextSequenceToSend
          )
        ) {
          const result =
            pendingSentences.get(
              nextSequenceToSend
            );

          pendingSentences.delete(
            nextSequenceToSend
          );

          res.write(
            `data: ${JSON.stringify({
              type: "sentence",
              sequence:
                result.sequence,
              text: result.text,
              audio:
                result.audio,
              audioMimeType:
                "audio/mpeg",
            })}\n\n`
          );

          if (res.flush) {
            res.flush();
          }

          // console.log(
          //   "[TutorStream] Sentence + audio sent:",
          //   {
          //     sequence:
          //       result.sequence,
          //     timestamp:
          //       new Date().toISOString(),
          //   }
          // );

          nextSequenceToSend++;
        }

      } catch (error) {
        console.error(
          `[TutorStream] TTS failed for sentence ${sequence}:`,
          error
        );

        /*
        ========================================
        Mark failed sentence as completed
        so later sentences are not blocked
        ========================================
        */

        pendingSentences.set(
          sequence,
          {
            sequence,
            text: sentence,
            audio: null,
          }
        );

        while (
          pendingSentences.has(
            nextSequenceToSend
          )
        ) {
          const result =
            pendingSentences.get(
              nextSequenceToSend
            );

          pendingSentences.delete(
            nextSequenceToSend
          );

          res.write(
            `data: ${JSON.stringify({
              type: "sentence",
              sequence:
                result.sequence,
              text: result.text,
              audio:
                result.audio,
              audioMimeType:
                "audio/mpeg",
            })}\n\n`
          );

          if (res.flush) {
            res.flush();
          }

          nextSequenceToSend++;
        }
      }
    }

    for await (const chunk of stream) {
      const text = chunk.text;

      if (!text) {
        continue;
      }

      // console.log(
      //   "[Backend] Gemini chunk:",
      //   new Date().toISOString(),
      //   JSON.stringify(text)
      // );

      fullResponse += text;

      sentenceBuffer += text;

      const {
        sentences,
        remainder,
      } = extractCompleteSentences(
        sentenceBuffer
      );

      sentenceBuffer = remainder;

      /*
      ========================================
      START TTS IMMEDIATELY
      ========================================
      */

      for (const sentence of sentences) {
        sentenceSequence++;

        ttsTasks.push(
          processSentence(
            sentence,
            sentenceSequence
          )
        );
      }
    }

    /*
    ==========================================
    HANDLE REMAINING TEXT
    ==========================================
    */

    const remainingText =
      sentenceBuffer.trim();

    if (remainingText) {
      sentenceSequence++;

      ttsTasks.push(
        processSentence(
          remainingText,
          sentenceSequence
        )
      );
    }

    /*
    ==========================================
    WAIT FOR ALL TTS
    ==========================================
    */

    await Promise.all(ttsTasks);

    /*
    ==========================================
    SAVE COMPLETE ASSISTANT RESPONSE
    ==========================================
    */

    await saveMessage({
      conversationId: conversation.id,
      role: "assistant",
      content: fullResponse,
    });

    await db.tutorConversation.update({
      where: {
        id: conversation.id,
      },

      data: {
        updatedAt: new Date(),
      },
    });

    /*
    ==========================================
    STREAM COMPLETE
    ==========================================
    */

    res.write(
      `data: ${JSON.stringify({
        type: "done",
      })}\n\n`
    );

    if (res.flush) {
      res.flush();
    }

    res.end();

    /*
    ==========================================
    BACKGROUND TASKS
    ==========================================
    */

    Promise.allSettled([
      updateTutorMemory({
        studentId: student.id,
        conversationId:
          conversation.id,
      }),

      generateConversationSummary(
        conversation.id,
        student.id
      ),

      updateTopicProgress(
        conversation.id,
        student.id
      ),

      generateLearningInsights(
        student.id
      ),

      updateLearningProfile(
        conversation.id,
        student.id
      ),

      checkAchievements(
        student.id
      ),
    ]).catch(console.error);

  } catch (error) {
    console.error(
      "AI Tutor Stream Error:",
      error
    );

    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message:
          "Internal server error",
      });
    }

    try {
      res.write(
        `data: ${JSON.stringify({
          type: "error",
          message: "Tutor failed",
        })}\n\n`
      );
    } catch {}

    try {
      res.end();
    } catch {}
  }
}

// export async function chatWithTutorStream(req, res) {
//   try {
//     const userId = req.user.userId;

//     const {
//       studentId,
//       conversationId,
//       message,
//     } = req.body;

//     if (!message?.trim()) {
//       return res.status(400).json({
//         success: false,
//         message: "Message is required",
//       });
//     }

//     const student = await resolveStudent({
//       userId,
//       studentId,
//     });

//     if (!student) {
//       return res.status(404).json({
//         success: false,
//         message: "Student not found",
//       });
//     }

//     const access =
//       await checkSubscriptionAccess({
//         userId,
//         feature: SUBSCRIPTION_FEATURES.AI_CHAT,
//       });

//     if (!access.success) {
//       return res.status(403).json(access);
//     }

//     const classification =
//       await classifyQuestion(message);

//     const normalizedMessage =
//       message.trim().toLowerCase();

//     const greetings = [
//       "hello",
//       "hi",
//       "hey",
//       "thanks",
//       "that is good",
//       "that's good",
//       "that is great",
//       "that's great",
//     ];

//     if (
//       classification !== "ACADEMIC" &&
//       !greetings.includes(normalizedMessage)
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "I am an educational tutor and can only assist with academic learning.",
//       });
//     }

//     const tutorContext =
//       await buildTutorContext(student.id);

//     const systemPrompt =
//       buildTutorPrompt({
//         firstName:
//           student.firstName || "Student",

//         classLevel:
//           student.classLevel || "Unknown",

//         context: tutorContext,
//       });

//     let conversation;
//     let isNewConversation = false;

//     /*
//     ==========================================
//     GET OR CREATE CONVERSATION
//     ==========================================
//     */

//     if (conversationId) {
//       const ownedConversation =
//         await verifyConversationOwnership({
//           userId,
//           studentId,
//           conversationId,
//         });

//       if (!ownedConversation) {
//         return res.status(403).json({
//           success: false,
//           message: "Access denied",
//         });
//       }

//       conversation =
//         await getConversation(
//           conversationId
//         );

//       if (!conversation) {
//         return res.status(404).json({
//           success: false,
//           message:
//             "Conversation not found",
//         });
//       }
//     } else {
//       const title =
//         message.length > 50
//           ? `${message.substring(0, 50)}...`
//           : message;

//       conversation =
//         await createConversation({
//           studentId: student.id,
//           title,
//         });

//       isNewConversation = true;
//     }

//     /*
//     ==========================================
//     SAVE USER MESSAGE
//     ==========================================
//     */

//     await saveMessage({
//       conversationId: conversation.id,
//       role: "user",
//       content: message,
//     });

//     /*
//     ==========================================
//     REFRESH CONVERSATION
//     ==========================================
//     */

//     conversation =
//       await getConversation(
//         conversation.id
//       );

//     const previousMessages =
//       conversation.messages
//         ?.slice(-20)
//         ?.map((msg) => ({
//           role:
//             msg.role === "assistant"
//               ? "model"
//               : "user",

//           parts: [
//             {
//               text: msg.content,
//             },
//           ],
//         })) || [];

//     /*
//     ==========================================
//     SSE HEADERS
//     ==========================================
//     */

//     res.setHeader(
//       "Content-Type",
//       "text/event-stream"
//     );

//     res.setHeader(
//       "Cache-Control",
//       "no-cache, no-transform"
//     );

//     res.setHeader(
//       "Connection",
//       "keep-alive"
//     );

//     if (res.flushHeaders) {
//       res.flushHeaders();
//     }

//     /*
//     ==========================================
//     NEW CONVERSATION EVENT
//     ==========================================
//     */

//     if (isNewConversation) {
//       res.write(
//         `data: ${JSON.stringify({
//           type: "conversation",
//           conversation: {
//             id: conversation.id,
//             title: conversation.title,
//             createdAt:
//               conversation.createdAt,
//             updatedAt:
//               conversation.updatedAt,
//           },
//         })}\n\n`
//       );

//       if (res.flush) {
//         res.flush();
//       }
//     }

//     /*
//     ==========================================
//     START GEMINI STREAM
//     ==========================================
//     */

//     let fullResponse = "";

//     const stream =
//       await streamTutorResponse({
//         systemPrompt,
//         message,
//         previousMessages,
//       });

//     /*
//     ==========================================
//     FORWARD EACH GEMINI CHUNK IMMEDIATELY
//     ==========================================
//     */

//    for await (const chunk of stream) {
//       const text = chunk.text;

//       if (!text) {
//         continue;
//       }

//       console.log(
//         "[Backend] Gemini chunk:",
//         new Date().toISOString(),
//         JSON.stringify(text)
//       );

//       fullResponse += text;

//       res.write(
//         `data: ${JSON.stringify({
//           type: "chunk",
//           text,
//         })}\n\n`
//       );

//       if (res.flush) {
//         res.flush();
//       }
//     }

//     /*
//     ==========================================
//     SAVE COMPLETE ASSISTANT RESPONSE
//     ==========================================
//     */

//     await saveMessage({
//       conversationId: conversation.id,
//       role: "assistant",
//       content: fullResponse,
//     });

//     await db.tutorConversation.update({
//       where: {
//         id: conversation.id,
//       },

//       data: {
//         updatedAt: new Date(),
//       },
//     });

//     /*
//     ==========================================
//     STREAM COMPLETE
//     ==========================================
//     */

//     res.write(
//       `data: ${JSON.stringify({
//         type: "done",
//       })}\n\n`
//     );

//     if (res.flush) {
//       res.flush();
//     }

//     res.end();

//     /*
//     ==========================================
//     BACKGROUND TASKS
//     ==========================================
//     */

//     Promise.allSettled([
//       updateTutorMemory({
//         studentId: student.id,
//         conversationId:
//           conversation.id,
//       }),

//       generateConversationSummary(
//         conversation.id,
//         student.id
//       ),

//       updateTopicProgress(
//         conversation.id,
//         student.id
//       ),

//       generateLearningInsights(
//         student.id
//       ),

//       updateLearningProfile(
//         conversation.id,
//         student.id
//       ),

//       checkAchievements(
//         student.id
//       ),
//     ]).catch(console.error);

//   } catch (error) {
//     console.error(
//       "AI Tutor Stream Error:",
//       error
//     );

//     if (!res.headersSent) {
//       return res.status(500).json({
//         success: false,
//         message:
//           "Internal server error",
//       });
//     }

//     try {
//       res.write(
//         `data: ${JSON.stringify({
//           type: "error",
//           message: "Tutor failed",
//         })}\n\n`
//       );
//     } catch {}

//     try {
//       res.end();
//     } catch {}
//   }
// }

// export async function chatWithTutorStream(req, res) {
//   try {
//     /*
//     ==========================================
//     Request
//     ==========================================
//     */

//     const userId = req.user.userId;

//     const {
//       studentId,
//       conversationId,
//       message,
//     } = req.body;

//     if (!message?.trim()) {
//       return res.status(400).json({
//         success: false,
//         message: "Message is required",
//       });
//     }

//     /*
//     ==========================================
//     Resolve Student
//     ==========================================
//     */

//     const student = await resolveStudent({
//       userId,
//       studentId,
//     });

//     if (!student) {
//       return res.status(404).json({
//         success: false,
//         message: "Student not found",
//       });
//     }

//     /*
//     ==========================================
//     Subscription Access
//     ==========================================
//     */

//     const access =
//       await checkSubscriptionAccess({
//         userId,
//         feature:
//           SUBSCRIPTION_FEATURES.AI_CHAT,
//       });

//     if (!access.success) {
//       return res
//         .status(403)
//         .json(access);
//     }

//     /*
//     ==========================================
//     Moderate Question
//     ==========================================
//     */

//     const classification =
//       await classifyQuestion(message);

//     const normalizedMessage =
//       message.trim().toLowerCase();

//     const greetings = [
//       "Hello",
//       "hello",
//       "Hi",
//       "hi",
//       "Hey",
//       "hey",
//       "thanks",
//       "Thanks",
//       "That is good",
//       "That's good",
//       "That is great",
//       "That's great"
//     ];

//     if (
//       classification !==
//         "ACADEMIC" &&
//       !greetings.includes(
//         normalizedMessage
//       )
//     ) {
//       return res.status(400).json({
//         success: false,
//         message:
//           "I am an educational tutor and can only assist with academic learning.",
//       });
//     }

//     /*
//     ==========================================
//     Build Tutor Context
//     ==========================================
//     */

//     const tutorContext =
//       await buildTutorContext(
//         student.id
//       );

//     const systemPrompt =
//       buildTutorPrompt({
//         firstName:
//           student.firstName ||
//           "Student",

//         classLevel:
//           student.classLevel ||
//           "Unknown",

//         context: tutorContext,
//       });

//     /*
//     ==========================================
//     Conversation
//     ==========================================
//     */

//     let conversation;

//     let isNewConversation = false;

//     if (conversationId) {
//       const ownedConversation =
//         await verifyConversationOwnership({
//           userId,
//           studentId,
//           conversationId,
//         });

//       if (!ownedConversation) {
//         return res.status(403).json({
//           success: false,
//           message: "Access denied",
//         });
//       }

//       conversation =
//         await getConversation(
//           conversationId
//         );

//       if (!conversation) {
//         return res.status(404).json({
//           success: false,
//           message:
//             "Conversation not found",
//         });
//       }

//     } else {

//       const title =
//         message.length > 50
//           ? `${message.substring(0, 50)}...`
//           : message;

//       conversation =
//         await createConversation({
//           studentId: student.id,
//           title,
//         });

//       isNewConversation = true;

//       // console.log(
//       //   "Created conversation:",
//       //   conversation.id
//       // );
//     }

//     /*
//     ==========================================
//     Save User Message
//     ==========================================
//     */

//     await saveMessage({
//       conversationId:
//         conversation.id,

//       role: "user",

//       content: message,
//     });

//         /*
//     ==========================================
//     Reload Conversation
//     ==========================================
//     */

//     conversation =
//       await getConversation(
//         conversation.id
//       );

//     const previousMessages =
//       conversation.messages
//         ?.slice(-20)
//         ?.map((msg) => ({
//           role:
//             msg.role === "assistant"
//               ? "model"
//               : "user",

//           parts: [
//             {
//               text: msg.content,
//             },
//           ],
//         })) || [];

//     /*
//     ==========================================
//     SSE Headers
//     ==========================================
//     */

//     res.setHeader(
//       "Content-Type",
//       "text/event-stream"
//     );

//     res.setHeader(
//       "Cache-Control",
//       "no-cache"
//     );

//     res.setHeader(
//       "Connection",
//       "keep-alive"
//     );

//     if (res.flushHeaders) {
//       res.flushHeaders();
//     }

//     /*
//     ==========================================
//     Notify Frontend
//     ==========================================
//     */

//     if (isNewConversation) {
//       res.write(
//         `data: ${JSON.stringify({
//           type: "conversation",
//           conversation: {
//             id: conversation.id,
//             title: conversation.title,
//             createdAt: conversation.createdAt,
//             updatedAt: conversation.updatedAt,
//           },
//         })}\n\n`
//       );

//         // console.log(
//         // "New conversation event sent:",
//         //   conversation.id
//         // );
//       }

//     /*
//     ==========================================
//     Stream Gemini Response
//     ==========================================
//     */

//     // console.log(
//     //   "Starting Gemini stream..."
//     // );

//     let fullResponse = "";

//     const stream =
//       await streamTutorResponse({
//         systemPrompt,
//         message,
//         previousMessages,
//       });

//     for await (const chunk of stream) {
//       const text = chunk.text;

//       if (!text) {
//         continue;
//       }

//       fullResponse += text;

//       // console.log(
//       //   "Chunk:",
//       //   text
//       // );

//       res.write(
//         `data: ${JSON.stringify({
//           type: "chunk",
//           text,
//         })}\n\n`
//       );
//     }

//       /*
//     ==========================================
//     Save Assistant Message
//     ==========================================
//     */

//     await saveMessage({
//       conversationId: conversation.id,
//       role: "assistant",
//       content: fullResponse,
//     });

//     // console.log(
//     //   "Assistant message saved"
//     // );

//     /*
//     ==========================================
//     Update Conversation Timestamp
//     ==========================================
//     */

//     await db.tutorConversation.update({
//       where: {
//         id: conversation.id,
//       },

//       data: {
//         updatedAt: new Date(),
//       },
//     });

//     // console.log(
//     //   "Conversation updated"
//     // );

//     /*
//     ==========================================
//     Notify Frontend Stream Complete
//     ==========================================
//     */

//     res.write(
//       `data: ${JSON.stringify({
//         type: "done",
//       })}\n\n`
//     );

//     res.end();

//     // console.log(
//     //   "Stream finished"
//     // );

//     /*
//     ==========================================
//     Background Processing
//     ==========================================
//     */

//     Promise.allSettled([
//       updateTutorMemory({
//         studentId: student.id,
//         conversationId: conversation.id,
//       }),

//       generateConversationSummary(
//         conversation.id,
//         student.id
//       ),

//       updateTopicProgress(
//         conversation.id,
//         student.id
//       ),

//       generateLearningInsights(
//         student.id
//       ),

//       updateLearningProfile(
//         conversation.id,
//         student.id
//       ),

//       checkAchievements(
//         student.id
//       ),
//     ]).catch(console.error);

//     return;

//     } catch (error) {
//     console.error(
//       "AI Tutor Stream Error:",
//       error
//     );

//     if (!res.headersSent) {
//       return res.status(500).json({
//         success: false,
//         message:
//           "Internal server error",
//       });
//     }

//     try {
//       res.write(
//         `data: ${JSON.stringify({
//           type: "error",
//           message:
//             "Tutor failed",
//         })}\n\n`
//       );
//     } catch {}

//     try {
//       res.end();
//     } catch {}
//   }
// }


export async function getConversations(
  req,
  res
) {
  try {
    const userId = req.user.userId;
    const { studentId } = req.query;

    const student = await resolveStudent({
        userId,
        studentId,
      });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Students not found",
      });
    }

    // console.log(
    //   "student:",
    //   student
    // );

     /*
    ==========================================
    Check Subscription Access
    ==========================================
    */

    const access =
      await checkSubscriptionAccess({
        userId,
        feature:
          SUBSCRIPTION_FEATURES.AI_CHAT,
      });

    if (!access.success) {
      return res.status(403).json(access);
    }

    const conversations =
      await getStudentConversations(
        student.id
      );

    return res.status(200).json({
      success: true,
      conversations,
    });
  } catch (error) {
    console.error(
      "Get conversations error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to fetch conversations",
    });
  }
}

export async function getConversationById(
  req,
  res
) {
  try {
    const userId = req.user.userId;
    const { studentId } = req.query;
    
    const { id } = req.params;

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

     /*
    ==========================================
    Check Subscription Access
    ==========================================
    */

    const access =
      await checkSubscriptionAccess({
        userId,
        feature:
          SUBSCRIPTION_FEATURES.AI_CHAT,
      });

    if (!access.success) {
      return res.status(403).json(access);
    }

    const conversation =
      await db.tutorConversation.findFirst({
        where: {
          id,
          studentId: student.id,
        },
        include: {
          messages: {
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message:
          "Conversation not found",
      });
    }

    return res.status(200).json({
      success: true,
      conversation,
    });
  } catch (error) {
    console.error(
      "Get conversation error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to fetch conversation",
    });
  }
}

export async function deleteConversationById(
  req,
  res
) {
  try {
    const userId = req.user.userId;
    const { studentId } = req.query;
    const { id } = req.params;

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
          id,
          studentId: student.id,
        },
      });

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message:
          "Conversation not found",
      });
    }

    await db.tutorConversation.delete({
      where: {
        id,
      },
    });

    return res.status(200).json({
      success: true,
      message:
        "Conversation deleted successfully",
    });
  } catch (error) {
    console.error(
      "Delete conversation error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "Unable to delete conversation",
    });
  }
}

