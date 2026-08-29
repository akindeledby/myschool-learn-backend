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
      "ok, thanks"
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
    GET STUDENT VOICE PROFILE
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
      studentVoiceProfile?.gender ||
      null;

    /*
    ==========================================
    STREAMING STATE
    ==========================================
    */

    let sentenceSequence = 0;

    const sentenceResults = new Map();

    const completedSentences = new Map();

    const ttsTasks = [];

    const audioSegmentTasks = [];

    const audioSegments = [];

    /*
    ==========================================
    PERSISTENT CONTENT BLOCKS
    ==========================================
    */

    const contentBlocks = [];

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
    ORDERED DELIVERY STATE
    ==========================================
    */

    let nextSequenceToSend = 1;

    let deliveryRunning = false;

    let deliveryRequested = false;

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

      /*
      ========================================
      USE THE SENTENCES AVAILABLE SO FAR

      At this point we normally have reached
      sentence 2.

      We deliberately do NOT use fullResponse
      because Gemini may still be generating
      the rest of the answer.
      ========================================
      */

      const imageContext =
        Array.from(
          sentenceResults.values()
        )
          .sort(
            (a, b) =>
              a.sequence - b.sequence
          )
          .map(
            (result) =>
              result.text
          )
          .join(" ")
          .trim();

      /*
      ========================================
      FALLBACK

      This should only really matter for very
      short responses.
      ========================================
      */

      const tutorResponseForImage =
        imageContext ||
        fullResponse;

      imageGenerationTask =
        createTutorImage({
          studentMessage: message,

          tutorResponse:
            tutorResponseForImage,

          studentId:
            student.id,

          conversationId:
            conversation.id,

          afterSequence:
            IMAGE_INSERT_AFTER_SENTENCE,
        })
          .then((image) => {
            generatedImage =
              image || null;

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
    SEND IMAGE
    ==========================================
    */

    function sendImage() {
      if (
        imageDelivered ||
        !generatedImage
      ) {
        return;
      }

      res.write(
        `data: ${JSON.stringify({
          type: "image",

          image: generatedImage,

          afterSequence:
            generatedImage.afterSequence ??
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
    ORDERED SENTENCE DELIVERY
    ==========================================

    This function guarantees:

    S1
    S2
    IMAGE
    S3
    S4

    when an image exists.

    If no image exists:

    S1
    S2
    S3
    S4

    continues normally.
    ==========================================
    */

    async function sendOrderedSentences() {
      // console.log(
      // "[TutorStream] sendOrderedSentences called",
      // {
      //     nextSequenceToSend,
      //     availableSequences: Array.from(
      //       sentenceResults.keys()
      //     ),
      //     imageGenerationStarted,
      //     imageDelivered,
      //     generatedImage: Boolean(
      //       generatedImage
      //     ),
      //   }
      // );
      while (true) {
        const result =
          sentenceResults.get(
            nextSequenceToSend
          );

        /*
        --------------------------------------
        The next sentence is not ready yet.
        --------------------------------------
        */

        if (!result) {
          break;
        }

        /*
        ======================================
        IMAGE BARRIER
        ======================================

        Only applies when we are about to
        cross the image insertion point.

        If image generation is still running,
        wait for it.

        If it returns null, continue normally.

        If it returns an image, send it first.
        ======================================
        */

        if (
          !imageDelivered &&
          nextSequenceToSend >
            IMAGE_INSERT_AFTER_SENTENCE &&
          imageGenerationStarted
        ) {
          if (imageGenerationTask) {
            await imageGenerationTask;
          }

          /*
          ------------------------------------
          Image was generated.
          ------------------------------------
          */

          if (generatedImage) {
            sendImage();
          }

          /*
          ------------------------------------
          If generatedImage is null, there is
          simply no image.

          DO NOT BLOCK THE TEXT STREAM.
          ------------------------------------
          */
        }

        /*
        ======================================
        SEND SENTENCE
        ======================================
        */

        sentenceResults.delete(
          nextSequenceToSend
        );

        // console.log(
        //   `[TutorStream] >>> SENDING SENTENCE ${result.sequence} TO FRONTEND:`,
        //   result.text
        // );

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
    REQUEST ORDERED DELIVERY
    ==========================================

    Multiple TTS tasks can finish at the same
    time.

    This prevents multiple instances of
    sendOrderedSentences() from modifying
    nextSequenceToSend simultaneously.
    ==========================================
    */

    async function requestOrderedDelivery() {
      deliveryRequested = true;

      if (deliveryRunning) {
        return;
      }

      deliveryRunning = true;

      try {
        while (deliveryRequested) {
          deliveryRequested = false;

          await sendOrderedSentences();
        }
      } finally {
        deliveryRunning = false;
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
        GENERATE SPEECH
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
        STORE SENTENCE RESULT
        ======================================
        */

        // sentenceResults.set(
        //   sequence,
        //   {
        //     sequence,

        //     text:
        //       sentence,

        //     audio:
        //       speech?.audioBuffer
        //         ? speech.audioBuffer.toString(
        //             "base64"
        //           )
        //         : null,
        //   }
        // );

        const sentenceResult = {
  sequence,
  text: sentence,
  audio:
    speech?.audioBuffer
      ? speech.audioBuffer.toString("base64")
      : null,
};

sentenceResults.set(
  sequence,
  sentenceResult
);

completedSentences.set(
  sequence,
  {
    sequence,
    text: sentence,
  }
);

      // console.log(
      //   `[TutorStream] Sentence ${sequence} ready for delivery:`,
      //   sentence
      // );

        await requestOrderedDelivery();
      } catch (error) {
        console.error(
          `[TutorStream] TTS failed for sentence ${sequence}:`,
          error
        );

        /*
        ======================================
        TTS FAILURE

        The text must still be delivered.
        ======================================
        */

        // sentenceResults.set(
        //   sequence,
        //   {
        //     sequence,

        //     text:
        //       sentence,

        //     audio:
        //       null,
        //   }
        // );

        const sentenceResult = {
          sequence,
          text: sentence,
          audio: null,
        };

        sentenceResults.set(
          sequence,
          sentenceResult
        );

      completedSentences.set(
        sequence,
        {
          sequence,
          text: sentence,
        }
      );

        await requestOrderedDelivery();
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

          // console.log(
          //   `[TutorStream] >>> SENTENCE DETECTED ${currentSequence}:`,
          //   sentence
          // );

        /*
        ======================================
        START IMAGE AFTER SENTENCE 2
        ======================================

        Image generation starts in the
        background.

        It does NOT block TTS.
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
        ======================================
        */

        const ttsTask =
          processSentence(
            sentence,
            currentSequence
          );

        ttsTasks.push(
          ttsTask
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

      const currentSequence =
        sentenceSequence;

      /*
      ========================================
      IF RESPONSE IS SHORT

      We may never have reached sentence 2,
      so start image generation now.
      ========================================
      */

      if (
        !imageGenerationStarted
      ) {
        startImageGeneration();
      }

      const ttsTask =
        processSentence(
          remainingText,
          currentSequence
        );

      ttsTasks.push(
        ttsTask
      );
    }

    /*
    ==========================================
    WAIT FOR ALL TTS
    ==========================================

    This is now only for ensuring all TTS
    operations have completed before the
    final persistence stage.

    Sentences have already been streamed
    whenever they became available.
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

    if (imageGenerationTask) {
      await imageGenerationTask;
    }

    /*
    ==========================================
    FINAL ORDERED DELIVERY
    ==========================================

    This catches anything that may still be
    waiting in the ordered queue.
    ==========================================
    */

    await requestOrderedDelivery();

    /*
    ==========================================
    FINAL IMAGE FALLBACK
    ==========================================

    If an image exists but there was no
    sentence after the insertion point,
    deliver it now.

    Example:

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
    BUILD PERSISTENT CONTENT BLOCKS
    ==========================================
    */

    // for (
    //   const result
    //     of sentenceResults.values()
    // ) {
    //   contentBlocks.push({
    //     type: "text",

    //     sequence:
    //       result.sequence,

    //     text:
    //       result.text,
    //   });
    // }

    for (const result of completedSentences.values()) {
  contentBlocks.push({
    type: "text",
    sequence: result.sequence,
    text: result.text,
  });
}

    /*
    ==========================================
    ADD IMAGE CONTENT BLOCK
    ==========================================
    */

    if (generatedImage) {
      contentBlocks.push({
        type: "image",

        afterSequence:
          generatedImage.afterSequence ??
          IMAGE_INSERT_AFTER_SENTENCE,

        image:
          generatedImage,
      });
    }

    /*
    ==========================================
    SORT CONTENT BLOCKS
    ==========================================

    Text:

    1
    2
    3
    4

    Image:

    2.5

    Result:

    TEXT 1
    TEXT 2
    IMAGE
    TEXT 3
    TEXT 4
    ==========================================
    */

    contentBlocks.sort(
      (a, b) => {
        const orderA =
          a.type === "text"
            ? a.sequence
            : a.afterSequence + 0.5;

        const orderB =
          b.type === "text"
            ? b.sequence
            : b.afterSequence + 0.5;

        return orderA - orderB;
      }
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

      contentBlocks,

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
          message:
            "Tutor failed",
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

//     /*
//     ==========================================
//     VALIDATE MESSAGE
//     ==========================================
//     */

//     if (!message?.trim()) {
//       return res.status(400).json({
//         success: false,
//         message: "Message is required",
//       });
//     }

//     /*
//     ==========================================
//     RESOLVE STUDENT
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
//     SUBSCRIPTION ACCESS
//     ==========================================
//     */

//     const access =
//       await checkSubscriptionAccess({
//         userId,
//         feature:
//           SUBSCRIPTION_FEATURES.AI_CHAT,
//       });

//     if (!access.success) {
//       return res.status(403).json(access);
//     }

//     /*
//     ==========================================
//     CLASSIFY QUESTION
//     ==========================================
//     */

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
//       "thank you",
//       "good",
//       "ok",
//       "ok thanks",
//     ];

//     if (
//       classification !== "ACADEMIC" &&
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
//     BUILD TUTOR CONTEXT
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

//         context:
//           tutorContext,
//       });

//     /*
//     ==========================================
//     GET OR CREATE CONVERSATION
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
//     }

//     /*
//     ==========================================
//     SAVE USER MESSAGE
//     ==========================================
//     */

//     await saveMessage({
//       conversationId:
//         conversation.id,

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
//             id:
//               conversation.id,

//             title:
//               conversation.title,

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
//     START TUTOR STREAM
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
//     ==========================================
//     GET STUDENT GENDER
//     ==========================================
//     */

//     const studentVoiceProfile =
//       await db.student.findUnique({
//         where: {
//           id: student.id,
//         },

//         select: {
//           gender: true,
//         },
//       });

//     const studentGender =
//       studentVoiceProfile?.gender ||
//       null;

//     /*
//     ==========================================
//     SENTENCE / AUDIO STATE
//     ==========================================
//     */

//     let sentenceSequence = 0;

//     /*
//     sentenceResults is the temporary
//     ordered delivery queue.

//     IMPORTANT:

//     We DO NOT destroy the information
//     needed for contentBlocks.
//     */

//     const sentenceResults = new Map();

//     /*
//     This permanently keeps every completed
//     sentence for database persistence.
//     */

//     const completedSentences = [];

//     const ttsTasks = [];

//     const audioSegmentTasks = [];

//     const audioSegments = [];

//     /*
//     ==========================================
//     IMAGE STATE
//     ==========================================
//     */

//     const IMAGE_INSERT_AFTER_SENTENCE = 2;

//     let imageGenerationStarted = false;

//     let imageGenerationTask = null;

//     let generatedImage = null;

//     let imageDelivered = false;

//     let nextSequenceToSend = 1;

//     /*
//     ==========================================
//     START IMAGE GENERATION
//     ==========================================
//     */

//     function startImageGeneration() {
//       if (imageGenerationStarted) {
//         return;
//       }

//       imageGenerationStarted = true;

//       /*
//       IMPORTANT:

//       At this point fullResponse contains
//       everything received from Gemini so far.

//       This intentionally allows image
//       generation to run concurrently with
//       the remainder of the tutor response.
//       */

//       const imageResponse =
//         fullResponse;

//       imageGenerationTask =
//         createTutorImage({
//           studentMessage:
//             message,

//           tutorResponse:
//             imageResponse,

//           studentId:
//             student.id,

//           conversationId:
//             conversation.id,

//           afterSequence:
//             IMAGE_INSERT_AFTER_SENTENCE,
//         })
//           .then((image) => {
//             generatedImage =
//               image || null;

//             return generatedImage;
//           })
//           .catch((error) => {
//             console.error(
//               "[TutorStream] Image generation task failed:",
//               error
//             );

//             generatedImage =
//               null;

//             return null;
//           });
//     }

//     /*
//     ==========================================
//     SEND IMAGE
//     ==========================================
//     */

//     function sendImage() {
//       if (
//         imageDelivered ||
//         !generatedImage
//       ) {
//         return;
//       }

//       res.write(
//         `data: ${JSON.stringify({
//           type: "image",

//           image:
//             generatedImage,

//           afterSequence:
//             generatedImage.afterSequence ??
//             IMAGE_INSERT_AFTER_SENTENCE,
//         })}\n\n`
//       );

//       if (res.flush) {
//         res.flush();
//       }

//       imageDelivered = true;
//     }

//     /*
//     ==========================================
//     SEND ORDERED SENTENCES
//     ==========================================
    
//     IMPORTANT FIX:

//     We no longer delete the sentence from
//     sentenceResults.

//     Instead, we only move the delivery
//     pointer forward.

//     This means completed sentence data
//     remains available for persistence.
//     */

//     async function sendOrderedSentences() {
//       while (true) {
//         const result =
//           sentenceResults.get(
//             nextSequenceToSend
//           );

//         /*
//         No next sentence available yet.
//         */

//         if (!result) {
//           break;
//         }

//         /*
//         ======================================
//         IMAGE BARRIER
//         ======================================

//         S1
//         S2
//         IMAGE
//         S3
//         S4
//         ======================================
//         */

//         if (
//           !imageDelivered &&
//           nextSequenceToSend >
//             IMAGE_INSERT_AFTER_SENTENCE &&
//           imageGenerationStarted
//         ) {
//           if (imageGenerationTask) {
//             await imageGenerationTask;
//           }

//           sendImage();
//         }

//         /*
//         ======================================
//         SEND SENTENCE
//         ======================================
//         */

//         res.write(
//           `data: ${JSON.stringify({
//             type: "sentence",

//             sequence:
//               result.sequence,

//             text:
//               result.text,

//             audio:
//               result.audio,

//             audioMimeType:
//               "audio/mpeg",
//           })}\n\n`
//         );

//         if (res.flush) {
//           res.flush();
//         }

//         /*
//         ======================================
//         IMPORTANT

//         DO NOT DELETE:

//         sentenceResults.delete(...)

//         We only advance the pointer.
//         ======================================
//         */

//         nextSequenceToSend++;
//       }
//     }

//     /*
//     ==========================================
//     PROCESS ONE SENTENCE
//     ==========================================
//     */

//     async function processSentence(
//       sentence,
//       sequence
//     ) {
//       try {
//         /*
//         ======================================
//         GENERATE TTS
//         ======================================
//         */

//         const speech =
//           await generateTutorSpeech({
//             text:
//               sentence,

//             gender:
//               studentGender,

//             voice:
//               "default",

//             speed: 1,
//           });

//         /*
//         ======================================
//         STORE AUDIO FOR REPLAY
//         ======================================
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

//                   text:
//                     sentence,

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
//         ======================================
//         BUILD SENTENCE RESULT
//         ======================================
//         */

//         const result = {
//           sequence,

//           text:
//             sentence,

//           audio:
//             speech?.audioBuffer
//               ? speech.audioBuffer.toString(
//                   "base64"
//                 )
//               : null,
//         };

//         /*
//         ======================================
//         STORE IN DELIVERY QUEUE
//         ======================================
//         */

//         sentenceResults.set(
//           sequence,
//           result
//         );

//         /*
//         ======================================
//         IMPORTANT FIX

//         Keep a permanent copy for
//         contentBlocks.

//         This is NOT deleted when the
//         sentence is streamed.
//         ======================================
//         */

//         completedSentences.push(
//           {
//             sequence,

//             text:
//               sentence,
//           }
//         );
//       } catch (error) {
//         console.error(
//           `[TutorStream] TTS failed for sentence ${sequence}:`,
//           error
//         );

//         /*
//         ======================================
//         TTS FAILURE

//         The text must still be streamed
//         and persisted.
//         ======================================
//         */

//         const result = {
//           sequence,

//           text:
//             sentence,

//           audio:
//             null,
//         };

//         sentenceResults.set(
//           sequence,
//           result
//         );

//         /*
//         Keep text even if TTS failed.
//         */

//         completedSentences.push(
//           {
//             sequence,

//             text:
//               sentence,
//           }
//         );
//       }
//     }

//     /*
//     ==========================================
//     READ GEMINI STREAM
//     ==========================================
//     */

//     for await (const chunk of stream) {
//       const text =
//         chunk.text;

//       if (!text) {
//         continue;
//       }

//       /*
//       ========================================
//       ACCUMULATE COMPLETE RESPONSE
//       ========================================
//       */

//       fullResponse += text;

//       sentenceBuffer += text;

//       const {
//         sentences,
//         remainder,
//       } =
//         extractCompleteSentences(
//           sentenceBuffer
//         );

//       sentenceBuffer =
//         remainder;

//       /*
//       ========================================
//       PROCESS COMPLETE SENTENCES
//       ========================================
//       */

//       for (const sentence of sentences) {
//         sentenceSequence++;

//         const currentSequence =
//           sentenceSequence;

//         /*
//         ======================================
//         START IMAGE AFTER SENTENCE 2
//         ======================================
//         */

//         if (
//           !imageGenerationStarted &&
//           currentSequence >=
//             IMAGE_INSERT_AFTER_SENTENCE
//         ) {
//           startImageGeneration();
//         }

//         /*
//         ======================================
//         START TTS
//         ======================================
//         */

//         const task =
//           processSentence(
//             sentence,
//             currentSequence
//           );

//         ttsTasks.push(task);
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

//       const currentSequence =
//         sentenceSequence;

//       /*
//       ========================================
//       SHORT RESPONSE IMAGE
//       ========================================
//       */

//       if (
//         !imageGenerationStarted
//       ) {
//         startImageGeneration();
//       }

//       const task =
//         processSentence(
//           remainingText,
//           currentSequence
//         );

//       ttsTasks.push(task);
//     }

//     /*
//     ==========================================
//     WAIT FOR ALL TTS
//     ==========================================
//     */

//     await Promise.all(
//       ttsTasks
//     );

//     /*
//     ==========================================
//     WAIT FOR IMAGE
//     ==========================================
//     */

//     if (imageGenerationTask) {
//       await imageGenerationTask;
//     }

//     /*
//     ==========================================
//     STREAM ALL SENTENCES IN ORDER
//     ==========================================
//     */

//     await sendOrderedSentences();

//     /*
//     ==========================================
//     FINAL IMAGE FALLBACK
//     ==========================================

//     If there is an image and there was
//     no sentence after the insertion point,
//     send the image at the end.

//     Example:

//     S1
//     S2
//     IMAGE
//     ==========================================
//     */

//     if (
//       generatedImage &&
//       !imageDelivered
//     ) {
//       sendImage();
//     }

//     /*
//     ==========================================
//     WAIT FOR AUDIO STORAGE
//     ==========================================
//     */

//     await Promise.allSettled(
//       audioSegmentTasks
//     );

//     /*
//     ==========================================
//     SORT AUDIO SEGMENTS
//     ==========================================
//     */

//     audioSegments.sort(
//       (a, b) =>
//         a.sequence -
//         b.sequence
//     );

//     /*
//     ==========================================
//     BUILD PERSISTENT CONTENT BLOCKS
//     ==========================================

//     IMPORTANT:

//     We use completedSentences here,
//     NOT sentenceResults.

//     completedSentences survives the
//     streaming delivery process.

//     Therefore the database receives:

//     TEXT 1
//     TEXT 2
//     IMAGE
//     TEXT 3
//     TEXT 4
//     ...
//     ==========================================
//     */

//     const contentBlocks = [];

//     /*
//     ==========================================
//     TEXT BLOCKS
//     ==========================================
//     */

//     for (
//       const result of completedSentences
//     ) {
//       contentBlocks.push({
//         type:
//           "text",

//         sequence:
//           result.sequence,

//         text:
//           result.text,
//       });
//     }

//     /*
//     ==========================================
//     IMAGE BLOCK
//     ==========================================
//     */

//     if (generatedImage) {
//       contentBlocks.push({
//         type:
//           "image",

//         afterSequence:
//           generatedImage.afterSequence ??
//           IMAGE_INSERT_AFTER_SENTENCE,

//         image:
//           generatedImage,
//       });
//     }

//     /*
//     ==========================================
//     SORT CONTENT BLOCKS
//     ==========================================

//     Example result:

//     sequence 1
//     sequence 2
//     image after sequence 2
//     sequence 3
//     sequence 4
//     ==========================================
//     */

//     contentBlocks.sort(
//       (a, b) => {
//         const orderA =
//           a.type === "text"
//             ? a.sequence
//             : a.afterSequence + 0.5;

//         const orderB =
//           b.type === "text"
//             ? b.sequence
//             : b.afterSequence + 0.5;

//         return (
//           orderA -
//           orderB
//         );
//       }
//     );

//     /*
//     ==========================================
//     SAVE COMPLETE ASSISTANT RESPONSE
//     ==========================================
//     */

//     await saveMessage({
//       conversationId:
//         conversation.id,

//       role:
//         "assistant",

//       content:
//         fullResponse,

//       /*
//       ======================================
//       NEW PERSISTENT CONTENT BLOCKS
//       ======================================
//       */

//       contentBlocks,

//       /*
//       ======================================
//       IMAGE COLLECTION
//       ======================================
//       */

//       images:
//         generatedImage
//           ? [generatedImage]
//           : undefined,

//       /*
//       ======================================
//       AUDIO COLLECTION
//       ======================================
//       */

//       audioSegments:
//         audioSegments.length > 0
//           ? audioSegments
//           : undefined,
//     });

//     /*
//     ==========================================
//     UPDATE CONVERSATION
//     ==========================================
//     */

//     await db.tutorConversation.update({
//       where: {
//         id:
//           conversation.id,
//       },

//       data: {
//         updatedAt:
//           new Date(),
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
//         studentId:
//           student.id,

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

//     /*
//     ==========================================
//     ERROR BEFORE SSE STARTED
//     ==========================================
//     */

//     if (!res.headersSent) {
//       return res.status(500).json({
//         success: false,
//         message:
//           "Internal server error",
//       });
//     }

//     /*
//     ==========================================
//     ERROR AFTER SSE STARTED
//     ==========================================
//     */

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

