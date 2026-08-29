import { db } from "../../lib/db.js";
import { classifyQuestion } from "../services/elevenLabs/questionModeration.service.js";
import { buildTutorPrompt } from "../services/elevenLabs/tutorPrompt.service.js";
import { verifyConversationOwnership } from "../services/elevenLabs/conversationOwnership.service.js";
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
import { generateTutorSpeech } from "../services/audio/aITutorTTS.service.js";

import { createTutorImage } from "../services/elevenLabs/createTutorImage.js";

import { uploadTutorAudio } from "../services/elevenLabs/tutorAudioStorage.js";


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

    /*
    ==========================================
    VALIDATE MESSAGE
    ==========================================
    */

    if (!message?.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message is required",
      });
    }

    /*
    ==========================================
    RESOLVE STUDENT
    ==========================================
    */

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

    /*
    ==========================================
    SUBSCRIPTION ACCESS
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

    /*
    ==========================================
    CLASSIFY QUESTION
    ==========================================
    */

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
      "thank you",
      "good",
      "ok",
      "ok thanks",
    ];

    if (
      classification !== "ACADEMIC" &&
      !greetings.includes(
        normalizedMessage
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "I am an educational tutor and can only assist with academic learning.",
      });
    }

    /*
    ==========================================
    BUILD TUTOR CONTEXT
    ==========================================
    */

    const tutorContext =
      await buildTutorContext(
        student.id
      );

    const systemPrompt =
      buildTutorPrompt({
        firstName:
          student.firstName ||
          "Student",

        classLevel:
          student.classLevel ||
          "Unknown",

        context: tutorContext,
      });

    /*
    ==========================================
    GET OR CREATE CONVERSATION
    ==========================================
    */

    let conversation;
    let isNewConversation = false;

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
      conversationId:
        conversation.id,

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

            title:
              conversation.title,

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
STREAMING ORCHESTRATION
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
GET STUDENT GENDER FOR TUTOR VOICE
==========================================
*/

const studentVoiceProfile =
  await db.student.findUnique({
    where: {
      id: student.id,
    },

    select: {
      gender: true,
    },
  });

const studentGender =
  studentVoiceProfile?.gender || null;

/*
==========================================
SENTENCE / AUDIO STATE
==========================================
*/

let sentenceSequence = 0;

const sentenceResults = new Map();

const ttsTasks = [];

const audioSegmentTasks = [];

const audioSegments = [];

/*
==========================================
IMAGE STATE
==========================================
*/

const IMAGE_INSERT_AFTER_SENTENCE = 2;

let imageGenerationStarted = false;

let imageGenerationTask = null;

let generatedImage = null;

let imageDelivered = false;

/*
==========================================
DELIVERY STATE
==========================================

IMPORTANT:

Only this delivery coordinator writes
sentence/image events to res.

TTS workers NEVER write directly to res.
==========================================
*/

let nextSequenceToSend = 1;

/*
==========================================
START IMAGE GENERATION
==========================================
*/

function startImageGeneration() {
  if (imageGenerationStarted) {
    return;
  }

  imageGenerationStarted = true;

  const imageResponse =
    fullResponse;

  console.log(
    "[TutorStream] Starting image generation..."
  );

  console.log(
    "[TutorStream] Image response length:",
    imageResponse.length
  );

  imageGenerationTask =
    createTutorImage({
      studentMessage: message,

      tutorResponse:
        imageResponse,

      studentId:
        student.id,

      conversationId:
        conversation.id,
    })
      .then((image) => {
        console.log(
          "[TutorStream] Image generation completed:",
          Boolean(image)
        );

        generatedImage = image || null;

        return generatedImage;
      })
      .catch((error) => {
        console.error(
          "[TutorStream] Image generation task failed:",
          error
        );

        generatedImage = null;

        return null;
      });
}

/*
==========================================
WRITE IMAGE EVENT
==========================================
*/

function sendImage() {
  if (
    imageDelivered ||
    !generatedImage
  ) {
    return;
  }

  console.log(
    "[TutorStream] Sending image after sentence:",
    IMAGE_INSERT_AFTER_SENTENCE
  );

  res.write(
    `data: ${JSON.stringify({
      type: "image",

      image: generatedImage,

      afterSequence:
        IMAGE_INSERT_AFTER_SENTENCE,
    })}\n\n`
  );

  if (res.flush) {
    res.flush();
  }

  imageDelivered = true;
}

/*
==========================================
SEND NEXT ORDERED SENTENCE
==========================================
*/

async function sendOrderedSentences() {
  while (true) {
    const result =
      sentenceResults.get(
        nextSequenceToSend
      );

    /*
    --------------------------------------
    No next sentence available yet.
    --------------------------------------
    */

    if (!result) {
      break;
    }

    /*
    ======================================
    IMAGE BARRIER
    ======================================

    If we are about to send sentence 3,
    the image must be resolved first.

    Therefore:

    S1
    S2
    IMAGE
    S3

    is guaranteed.
    ======================================
    */

    if (
      !imageDelivered &&
      nextSequenceToSend >
        IMAGE_INSERT_AFTER_SENTENCE &&
      imageGenerationStarted
    ) {
      console.log(
        "[TutorStream] Waiting for image before sending sentence:",
        nextSequenceToSend
      );

      if (imageGenerationTask) {
        await imageGenerationTask;
      }

      /*
      ------------------------------------
      Image generation has completed.
      ------------------------------------
      */

      sendImage();
    }

    /*
    ======================================
    SEND SENTENCE
    ======================================
    */

    sentenceResults.delete(
      nextSequenceToSend
    );

    console.log(
      "[TutorStream] Sending sentence:",
      result.sequence
    );

    res.write(
      `data: ${JSON.stringify({
        type: "sentence",

        sequence:
          result.sequence,

        text:
          result.text,

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

/*
==========================================
GENERATE TTS FOR ONE SENTENCE
==========================================
*/

async function processSentence(
  sentence,
  sequence
) {
  try {
    /*
    ======================================
    GENERATE TTS
    ======================================
    */

    const speech =
      await generateTutorSpeech({
        text: sentence,

        gender:
          studentGender,

        voice:
          "default",

        speed: 1,
      });

    /*
    ======================================
    STORE AUDIO FOR REPLAY
    ======================================
    */

    if (
      speech?.audioBuffer &&
      speech.audioBuffer.length > 0
    ) {
      const uploadTask =
        uploadTutorAudio({
          buffer:
            speech.audioBuffer,

          mimeType:
            "audio/mpeg",

          studentId:
            student.id,

          conversationId:
            conversation.id,

          sequence,
        })
          .then((uploaded) => {
            if (!uploaded?.url) {
              throw new Error(
                "Tutor audio upload did not return a URL."
              );
            }

            audioSegments.push({
              sequence,

              text:
                sentence,

              url:
                uploaded.url,

              mimeType:
                uploaded.mimeType ||
                "audio/mpeg",

              storageKey:
                uploaded.storageKey,
            });
          })
          .catch((error) => {
            console.error(
              `[TutorStream] Failed to store audio segment ${sequence}:`,
              error
            );
          });

      audioSegmentTasks.push(
        uploadTask
      );
    }

    /*
    ======================================
    STORE COMPLETED SENTENCE
    ======================================

    Do NOT write to SSE here.

    The delivery coordinator handles that.
    ======================================
    */

    sentenceResults.set(
      sequence,
      {
        sequence,

        text:
          sentence,

        audio:
          speech?.audioBuffer
            ? speech.audioBuffer.toString(
                "base64"
              )
            : null,
      }
    );

  } catch (error) {
    console.error(
      `[TutorStream] TTS failed for sentence ${sequence}:`,
      error
    );

    /*
    ======================================
    TTS FAILURE

    Still place the sentence in the
    ordered queue so streaming cannot
    become stuck.
    ======================================
    */

    sentenceResults.set(
      sequence,
      {
        sequence,

        text:
          sentence,

        audio:
          null,
      }
    );
  }
}

/*
==========================================
READ GEMINI STREAM
==========================================
*/

for await (const chunk of stream) {
  const text = chunk.text;

  if (!text) {
    continue;
  }

  /*
  ========================================
  ACCUMULATE COMPLETE RESPONSE
  ========================================
  */

  fullResponse += text;

  sentenceBuffer += text;

  const {
    sentences,
    remainder,
  } =
    extractCompleteSentences(
      sentenceBuffer
    );

  sentenceBuffer =
    remainder;

  /*
  ========================================
  PROCESS COMPLETE SENTENCES
  ========================================
  */

  for (const sentence of sentences) {
    sentenceSequence++;

    const currentSequence =
      sentenceSequence;

    /*
    ======================================
    START IMAGE AFTER SENTENCE 2
    ======================================

    We start image generation as soon as
    sentence 2 has been identified.

    TTS continues independently.
    ======================================
    */

    if (
      !imageGenerationStarted &&
      currentSequence >=
        IMAGE_INSERT_AFTER_SENTENCE
    ) {
      startImageGeneration();
    }

    /*
    ======================================
    START TTS

    TTS runs concurrently.

    It only places its result into
    sentenceResults.

    It does NOT touch res.
    ======================================
    */

    ttsTasks.push(
      processSentence(
        sentence,
        currentSequence
      )
    );

    /*
    ======================================
    ATTEMPT DELIVERY

    We do not wait for this TTS task
    here.

    If the sentence is not ready yet,
    the coordinator simply stops.

    When all TTS tasks finish, we flush
    the ordered queue.
    ======================================
    */

    /*
    Do not call sendOrderedSentences()
    here.

    This is intentional.
    */
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

  const currentSequence =
    sentenceSequence;

  /*
  ========================================
  START IMAGE IF RESPONSE IS SHORT
  ========================================

  If the response never reached sentence
  2, start image generation using the
  complete response.
  ========================================
  */

  if (
    !imageGenerationStarted
  ) {
    startImageGeneration();
  }

  ttsTasks.push(
    processSentence(
      remainingText,
      currentSequence
    )
  );
}

/*
==========================================
WAIT FOR ALL TTS
==========================================
*/

await Promise.all(
  ttsTasks
);

/*
==========================================
WAIT FOR IMAGE
==========================================
*/

if (
  imageGenerationTask
) {
  await imageGenerationTask;
}

/*
==========================================
FLUSH ORDERED SENTENCES
==========================================

At this point every TTS operation has
finished and the image task has finished.

The coordinator now has everything it
needs to construct:

S1
S2
IMAGE
S3
S4
...
==========================================
*/

await sendOrderedSentences();

/*
==========================================
FINAL IMAGE FALLBACK
==========================================

If there was an image but no sentence
after the insertion point, make sure the
image is still delivered.

For example:

S1
S2
IMAGE
==========================================
*/

if (
  generatedImage &&
  !imageDelivered
) {
  sendImage();
}

/*
==========================================
WAIT FOR AUDIO STORAGE
==========================================
*/

await Promise.allSettled(
  audioSegmentTasks
);

/*
==========================================
SORT AUDIO SEGMENTS
==========================================
*/

audioSegments.sort(
  (a, b) =>
    a.sequence - b.sequence
);

/*
==========================================
SAVE COMPLETE ASSISTANT RESPONSE
==========================================
*/

await saveMessage({
  conversationId:
    conversation.id,

  role:
    "assistant",

  content:
    fullResponse,

  images:
    generatedImage
      ? [generatedImage]
      : undefined,

  audioSegments:
    audioSegments.length > 0
      ? audioSegments
      : undefined,
});

/*
==========================================
UPDATE CONVERSATION
==========================================
*/

await db.tutorConversation.update({
  where: {
    id:
      conversation.id,
  },

  data: {
    updatedAt:
      new Date(),
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
        studentId:
          student.id,

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
//       "thanks",
//       "thank you",
//       "Good",
//       "ok",
//       "ok thanks"
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
//         ?.slice(0, -1)
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

//     let sentenceBuffer = "";

//     const stream =
//       await streamTutorResponse({
//         systemPrompt,
//         message,
//         previousMessages,
//       });

    
//     /*
// ==========================================
// GET STUDENT GENDER FOR TUTOR VOICE
// ==========================================
// */

// const studentVoiceProfile =
//   await db.student.findUnique({
//     where: {
//       id: student.id,
//     },

//     select: {
//       gender: true,
//     },
//   });

// const studentGender =
//   studentVoiceProfile?.gender || null;

//     /*
//     ==========================================
//     PROCESS GEMINI CHUNKS
//     ==========================================
//     */

//     let sentenceSequence = 0;

//     const ttsTasks = [];

//     const audioSegmentTasks = [];

//     const audioSegments = [];

//     const pendingSentences = new Map();

//     let nextSequenceToSend = 1;

//     async function processSentence(
//       sentence,
//       sequence
//     ) {
//       try {
//         const speech =
//           await generateTutorSpeech({
//             text: sentence,
//             gender: studentGender,
//             voice: "default",
//             speed: 1,
//           });

//         /*
//         ========================================
//         STORE AUDIO FOR REPLAY
//         ========================================
//         */

//         if (
//           speech?.audioBuffer &&
//           speech.audioBuffer.length > 0
//         ) {
//           const uploadTask =
//             uploadTutorAudio({
//               buffer:
//                 speech.audioBuffer,

//               mimeType:
//                 "audio/mpeg",

//               studentId:
//                 student.id,

//               conversationId:
//                 conversation.id,

//               sequence,
//             })
//               .then((uploaded) => {
//                 if (!uploaded?.url) {
//                   throw new Error(
//                     "Tutor audio upload did not return a URL."
//                   );
//                 }

//                 audioSegments.push({
//                   sequence,

//                   text: sentence,

//                   url:
//                     uploaded.url,

//                   mimeType:
//                     uploaded.mimeType ||
//                     "audio/mpeg",

//                   storageKey:
//                     uploaded.storageKey,
//                 });
//               })
//               .catch((error) => {

//                 console.error(
//                   `[TutorStream] Failed to store audio segment ${sequence}:`,
//                   error
//                 );
//               });

//           audioSegmentTasks.push(
//             uploadTask
//           );
//         }

//         /*
//         ========================================
//         PREPARE LIVE AUDIO
//         ========================================
//         */

//         pendingSentences.set(
//           sequence,
//           {
//             sequence,

//             text: sentence,

//             audio:
//               speech?.audioBuffer
//                 ? speech.audioBuffer.toString(
//                     "base64"
//                   )
//                 : null,
//           }
//         );

//         /*
//         ========================================
//         SEND COMPLETED SENTENCES IN ORDER
//         ========================================
//         */

//         while (
//           pendingSentences.has(
//             nextSequenceToSend
//           )
//         ) {
//           const result =
//             pendingSentences.get(
//               nextSequenceToSend
//             );

//           pendingSentences.delete(
//             nextSequenceToSend
//           );

//           res.write(
//             `data: ${JSON.stringify({
//               type: "sentence",

//               sequence:
//                 result.sequence,

//               text:
//                 result.text,

//               audio:
//                 result.audio,

//               audioMimeType:
//                 "audio/mpeg",
//             })}\n\n`
//           );

//           if (res.flush) {
//             res.flush();
//           }

//           nextSequenceToSend++;
//         }
        

//       } catch (error) {
//         console.error(
//           `[TutorStream] TTS failed for sentence ${sequence}:`,
//           error
//         );

//         pendingSentences.set(
//           sequence,
//           {
//             sequence,

//             text: sentence,

//             audio: null,
//           }
//         );

//         while (
//           pendingSentences.has(
//             nextSequenceToSend
//           )
//         ) {
//           const result =
//             pendingSentences.get(
//               nextSequenceToSend
//             );

//           pendingSentences.delete(
//             nextSequenceToSend
//           );

//           res.write(
//             `data: ${JSON.stringify({
//               type: "sentence",

//               sequence:
//                 result.sequence,

//               text:
//                 result.text,

//               audio:
//                 result.audio,

//               audioMimeType:
//                 "audio/mpeg",
//             })}\n\n`
//           );

//           if (res.flush) {
//             res.flush();
//           }

//           nextSequenceToSend++;
//         }
//       }
//     }

//     for await (const chunk of stream) {
//       const text = chunk.text;

//       if (!text) {
//         continue;
//       }

//       fullResponse += text;

//       sentenceBuffer += text;

//       const {
//         sentences,
//         remainder,
//       } = extractCompleteSentences(
//         sentenceBuffer
//       );

//       sentenceBuffer = remainder;

//       /*
//       ========================================
//       START TTS IMMEDIATELY
//       ========================================
//       */

//       for (const sentence of sentences) {
//         sentenceSequence++;

//         ttsTasks.push(
//           processSentence(
//             sentence,
//             sentenceSequence
//           )
//         );
//       }
//     }

//     /*
//     ==========================================
//     HANDLE REMAINING TEXT
//     ==========================================
//     */

//     const remainingText =
//       sentenceBuffer.trim();

//     if (remainingText) {
//       sentenceSequence++;

//       ttsTasks.push(
//         processSentence(
//           remainingText,
//           sentenceSequence
//         )
//       );
//     }

//     /*
//     ==========================================
//     WAIT FOR ALL TTS
//     ==========================================
//     */

//     await Promise.all(ttsTasks);

//     await Promise.allSettled(
//       audioSegmentTasks
//     );

//     audioSegments.sort(
//       (a, b) =>
//         a.sequence - b.sequence
//     );

//     /*
//     ==========================================
//     GENERATE OPTIONAL TUTOR IMAGE
//     ==========================================
//     */

//     let generatedImage = null;

//     try {
//       generatedImage =
//         await createTutorImage({
//           studentMessage: message,

//           tutorResponse:
//             fullResponse,

//           studentId:
//             student.id,

//           conversationId:
//             conversation.id,
//         });
//     } catch (imageError) {
//       console.error(
//         "[TutorStream] Tutor image generation failed:",
//         imageError
//       );

//       generatedImage = null;
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

//       images: generatedImage
//         ? [generatedImage]
//         : undefined,

//       audioSegments:
//         audioSegments.length > 0
//           ? audioSegments
//           : undefined,
//     });
    

//     if (generatedImage) {
//       res.write(
//         `data: ${JSON.stringify({
//           type: "image",
//           image: generatedImage,
//         })}\n\n`
//       );

//       if (res.flush) {
//         res.flush();
//       }
//     }

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

