import { db } from "../../../lib/db.js";

import { streamTutorResponse } from "../../services/elevenLabs/aiTutorStream.service.js";
import { generateTutorSpeech } from "../../services/audio/aITutorTTS.service.js";
import { uploadTutorAudio } from "../../services/elevenLabs/tutorAudioStorage.js";
import { createTutorImage } from "../../services/elevenLabs/createTutorImage.js";
import { extractCompleteSentences } from "../../services/elevenLabs/extractCompleteSentences.service.js";
import { saveMessage } from "../../services/elevenLabs/conversation.service.js";
import { updateTutorMemory } from "../../services/elevenLabs/tutorMemory.service.js";
import { generateConversationSummary } from "../../services/elevenLabs/tutorSessionSummary.service.js";
import { generateLearningInsights } from "../../services/elevenLabs/learningInsights.service.js";
import { updateLearningProfile } from "../../services/elevenLabs/learningProfile.service.js";
import { checkAchievements } from "../../services/elevenLabs/achievement.service.js";


const IMAGE_INSERT_AFTER_SENTENCE = 2;


export async function streamTutorConversationResponse({
  req,
  res,

  student,

  conversation,

  message,

  userMessage = null,

  systemPrompt,

  isNewConversation = false,

  lessonSessionId = null,

  streamType = "GENERAL",

  sendLessonCompletedEvent = false,

  lessonCompletedEvent = null,
}) {
  try {
    /*
    ============================================================
    VALIDATION
    ============================================================
    */

    if (!student?.id) {
      const error = new Error(
        "A valid student is required for Tutor streaming."
      );

      error.statusCode = 400;

      throw error;
    }

    if (!conversation?.id) {
      const error = new Error(
        "A valid Tutor conversation is required for streaming."
      );

      error.statusCode = 400;

      throw error;
    }

    if (
      typeof message !== "string" ||
      !message.trim()
    ) {
      const error = new Error(
        "A valid Tutor message is required."
      );

      error.statusCode = 400;

      throw error;
    }

    if (
      typeof systemPrompt !== "string" ||
      !systemPrompt.trim()
    ) {
      const error = new Error(
        "A valid Tutor system prompt is required."
      );

      error.statusCode = 500;

      throw error;
    }


    /*
    ============================================================
    NORMALIZE MESSAGE
    ============================================================
    */

    const normalizedMessage =
      message.trim();


    /*
    ============================================================
    PREVIOUS MESSAGES
    ============================================================
    *
    * The incoming user message has already been saved by the
    * controller.
    *
    * Therefore it must not be included in previousMessages.
    *
    * If userMessage is available, exclude it explicitly.
    *
    ============================================================
    */

    let previousMessages =
      conversation.messages || [];

    if (userMessage?.id) {
      previousMessages =
        previousMessages.filter(
          (msg) =>
            msg.id !== userMessage.id
        );
    } else {
      previousMessages =
        previousMessages.slice(0, -1);
    }

    previousMessages =
      previousMessages
        .slice(-20)
        .map((msg) => ({
          role:
            msg.role === "assistant"
              ? "model"
              : "user",

          parts: [
            {
              text:
                msg.content || "",
            },
          ],
        }));


    // console.log(
    //   "[TutorConversationStream] Starting stream:",
    //   {
    //     streamType,
    //     studentId: student.id,
    //     conversationId: conversation.id,
    //     lessonSessionId,
    //     previousMessages:
    //       previousMessages.length,
    //   }
    // );


    /*
    ============================================================
    SSE HEADERS
    ============================================================
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

    res.setHeader(
      "X-Accel-Buffering",
      "no"
    );

    if (res.flushHeaders) {
      res.flushHeaders();
    }


    /*
    ============================================================
    NEW CONVERSATION EVENT
    ============================================================
    */

    if (isNewConversation) {
      res.write(
        `data: ${JSON.stringify({
          type: "conversation",

          conversation: {
            id:
              conversation.id,

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
    ============================================================
    LESSON COMPLETION EVENT
    ============================================================
    *
    * This is used by continueCompletedTutorLesson.
    *
    * The normal chat flow does not send this event.
    *
    ============================================================
    */

    if (
      sendLessonCompletedEvent &&
      lessonCompletedEvent
    ) {
      res.write(
        `data: ${JSON.stringify(
          lessonCompletedEvent
        )}\n\n`
      );

      if (res.flush) {
        res.flush();
      }

      // console.log(
      //   "[TutorConversationStream] lessonCompleted event sent."
      // );
    }


    /*
    ============================================================
    START GEMINI STREAM
    ============================================================
    */

    const stream =
      await streamTutorResponse({
        systemPrompt,

        message:
          normalizedMessage,

        previousMessages,
      });


    /*
    ============================================================
    STUDENT VOICE PROFILE
    ============================================================
    */

    const studentVoiceProfile =
      await db.student.findUnique({
        where: {
          id:
            student.id,
        },

        select: {
          gender: true,
        },
      });

    const studentGender =
      studentVoiceProfile?.gender ||
      null;


    /*
    ============================================================
    RESPONSE STATE
    ============================================================
    */

    let fullResponse = "";

    let sentenceBuffer = "";

    let sentenceSequence = 0;


    /*
    ============================================================
    SENTENCE STATE
    ============================================================
    */

    const sentenceResults =
      new Map();

    const completedSentences =
      new Map();

    const ttsTasks = [];

    const audioSegmentTasks = [];

    const audioSegments = [];


    /*
    ============================================================
    IMAGE STATE
    ============================================================
    */

    let imageGenerationStarted =
      false;

    let imageGenerationTask =
      null;

    let generatedImage =
      null;

    let imageDelivered =
      false;


    /*
    ============================================================
    ORDERED DELIVERY STATE
    ============================================================
    */

    let nextSequenceToSend = 1;

    let deliveryRunning = false;

    let deliveryRequested = false;


    /*
    ============================================================
    IMAGE GENERATION
    ============================================================
    */

    function startImageGeneration() {
      if (imageGenerationStarted) {
        return;
      }

      imageGenerationStarted =
        true;

      const imageContext =
        Array.from(
          sentenceResults.values()
        )
          .sort(
            (a, b) =>
              a.sequence -
              b.sequence
          )
          .map(
            (result) =>
              result.text
          )
          .join(" ")
          .trim();

      const tutorResponseForImage =
        imageContext ||
        fullResponse;

      // console.log(
      //   "[TutorConversationStream] Starting Tutor image generation."
      // );

      imageGenerationTask =
        createTutorImage({
          studentMessage:
            normalizedMessage,

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
              "[TutorConversationStream] Image generation failed:",
              error
            );

            generatedImage =
              null;

            return null;
          });
    }


    /*
    ============================================================
    SEND IMAGE
    ============================================================
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

          image:
            generatedImage,

          afterSequence:
            generatedImage.afterSequence ??
            IMAGE_INSERT_AFTER_SENTENCE,
        })}\n\n`
      );

      if (res.flush) {
        res.flush();
      }

      imageDelivered = true;

      // console.log(
      //   "[TutorConversationStream] Image delivered."
      // );
    }


    /*
    ============================================================
    ORDERED SENTENCE DELIVERY
    ============================================================
    */

    async function sendOrderedSentences() {
      while (true) {
        const result =
          sentenceResults.get(
            nextSequenceToSend
          );

        if (!result) {
          break;
        }


        /*
        --------------------------------------------------------
        INSERT IMAGE AFTER SENTENCE 2
        --------------------------------------------------------
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

          if (generatedImage) {
            sendImage();
          }
        }


        /*
        --------------------------------------------------------
        REMOVE FROM WAITING QUEUE
        --------------------------------------------------------
        */

        sentenceResults.delete(
          nextSequenceToSend
        );


        /*
        --------------------------------------------------------
        SEND SENTENCE
        --------------------------------------------------------
        */

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
    ============================================================
    REQUEST ORDERED DELIVERY
    ============================================================
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
    ============================================================
    PROCESS SENTENCE
    ============================================================
    */

    async function processSentence(
      sentence,
      sequence
    ) {
      try {
        /*
        --------------------------------------------------------
        GENERATE TTS
        --------------------------------------------------------
        */

        const speech =
          await generateTutorSpeech({
            text:
              sentence,

            gender:
              studentGender,

            voice:
              "default",

            speed:
              1,
          });


        /*
        --------------------------------------------------------
        STORE AUDIO FOR REPLAY
        --------------------------------------------------------
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
                  `[TutorConversationStream] Failed to store audio segment ${sequence}:`,
                  error
                );
              });

          audioSegmentTasks.push(
            uploadTask
          );
        }


        /*
        --------------------------------------------------------
        BUILD SENTENCE RESULT
        --------------------------------------------------------
        */

        const sentenceResult = {
          sequence,

          text:
            sentence,

          audio:
            speech?.audioBuffer
              ? speech.audioBuffer.toString(
                  "base64"
                )
              : null,
        };


        /*
        --------------------------------------------------------
        STORE FOR ORDERED DELIVERY
        --------------------------------------------------------
        */

        sentenceResults.set(
          sequence,
          sentenceResult
        );


        /*
        --------------------------------------------------------
        STORE FOR CONTENT BLOCKS
        --------------------------------------------------------
        */

        completedSentences.set(
          sequence,
          {
            sequence,

            text:
              sentence,
          }
        );


        /*
        --------------------------------------------------------
        DELIVER IN ORDER
        --------------------------------------------------------
        */

        await requestOrderedDelivery();
      } catch (error) {
        console.error(
          `[TutorConversationStream] TTS failed for sentence ${sequence}:`,
          error
        );


        /*
        --------------------------------------------------------
        *
        * Even if TTS fails, the text must continue streaming.
        *
        --------------------------------------------------------
        */

        const sentenceResult = {
          sequence,

          text:
            sentence,

          audio:
            null,
        };

        sentenceResults.set(
          sequence,
          sentenceResult
        );

        completedSentences.set(
          sequence,
          {
            sequence,

            text:
              sentence,
          }
        );

        await requestOrderedDelivery();
      }
    }


    /*
    ============================================================
    READ AI STREAM
    ============================================================
    */

    for await (const chunk of stream) {
      const text =
        chunk?.text;

      if (!text) {
        continue;
      }

      fullResponse += text;

      sentenceBuffer += text;


      /*
      ----------------------------------------------------------
      EXTRACT COMPLETE SENTENCES
      ----------------------------------------------------------
      */

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
      ----------------------------------------------------------
      PROCESS COMPLETE SENTENCES
      ----------------------------------------------------------
      */

      for (const sentence of sentences) {
        sentenceSequence++;

        const currentSequence =
          sentenceSequence;


        /*
        --------------------------------------------------------
        START IMAGE GENERATION AFTER SENTENCE 2
        --------------------------------------------------------
        */

        if (
          !imageGenerationStarted &&
          currentSequence >=
            IMAGE_INSERT_AFTER_SENTENCE
        ) {
          startImageGeneration();
        }


        /*
        --------------------------------------------------------
        PROCESS TTS WITHOUT BLOCKING AI STREAM
        --------------------------------------------------------
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
    ============================================================
    HANDLE REMAINING TEXT
    ============================================================
    */

    const remainingText =
      sentenceBuffer.trim();

    if (remainingText) {
      sentenceSequence++;

      const currentSequence =
        sentenceSequence;

      if (!imageGenerationStarted) {
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
    ============================================================
    WAIT FOR SENTENCE PROCESSING
    ============================================================
    */

    await Promise.all(
      ttsTasks
    );


    /*
    ============================================================
    WAIT FOR IMAGE
    ============================================================
    */

    if (imageGenerationTask) {
      await imageGenerationTask;
    }


    /*
    ============================================================
    FLUSH REMAINING SENTENCES
    ============================================================
    */

    await requestOrderedDelivery();


    /*
    ============================================================
    DELIVER IMAGE IF NOT ALREADY DELIVERED
    ============================================================
    */

    if (
      generatedImage &&
      !imageDelivered
    ) {
      sendImage();
    }


    /*
    ============================================================
    WAIT FOR AUDIO STORAGE
    ============================================================
    */

    await Promise.allSettled(
      audioSegmentTasks
    );


    /*
    ============================================================
    SORT AUDIO SEGMENTS
    ============================================================
    */

    audioSegments.sort(
      (a, b) =>
        a.sequence -
        b.sequence
    );


    /*
    ============================================================
    BUILD CONTENT BLOCKS
    ============================================================
    */

    const contentBlocks = [];


    for (
      const result of
      completedSentences.values()
    ) {
      contentBlocks.push({
        type:
          "text",

        sequence:
          result.sequence,

        text:
          result.text,
      });
    }


    if (generatedImage) {
      contentBlocks.push({
        type:
          "image",

        afterSequence:
          generatedImage.afterSequence ??
          IMAGE_INSERT_AFTER_SENTENCE,

        image:
          generatedImage,
      });
    }


    /*
    ============================================================
    SORT CONTENT BLOCKS
    ============================================================
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
    ============================================================
    SAVE ASSISTANT MESSAGE
    ============================================================
    */

    // console.log(
    //   "[TutorConversationStream] Saving ASSISTANT message:",
    //   {
    //     streamType,
    //     conversationId:
    //       conversation.id,
    //   }
    // );

    const savedAssistantMessage =
      await saveMessage({
        conversationId:
          conversation.id,

        lessonSessionId:
          lessonSessionId || null,

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


    // console.log(
    //   "[TutorConversationStream] ASSISTANT message saved:",
    //   savedAssistantMessage?.id ||
    //     "(no id returned)"
    // );


    /*
    ============================================================
    UPDATE CONVERSATION
    ============================================================
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
    ============================================================
    SEND DONE
    ============================================================
    */

    res.write(
      `data: ${JSON.stringify({
        type:
          "done",
      })}\n\n`
    );

    if (res.flush) {
      res.flush();
    }

    res.end();


    /*
    ============================================================
    BACKGROUND TASKS
    ============================================================
    */

    const backgroundTasks = [
      {
        name:
          "TutorMemory",

        task:
          updateTutorMemory({
            conversationId:
              conversation.id,

            studentId:
              student.id,
          }),
      },

      {
        name:
          "ConversationSummary",

        task:
          generateConversationSummary(
            conversation.id,
            student.id
          ),
      },

      {
        name:
          "LearningInsights",

        task:
          generateLearningInsights(
            student.id
          ),
      },

      {
        name:
          "LearningProfile",

        task:
          updateLearningProfile(
            conversation.id,
            student.id
          ),
      },

      {
        name:
          "Achievements",

        task:
          checkAchievements(
            student.id
          ),
      },
    ];


    Promise.allSettled(
      backgroundTasks.map(
        async ({
          name,
          task,
        }) => {
          try {
            // console.log(
            //   `[TutorConversationStream] Background task STARTED: ${name}`
            // );

            await task;

            // console.log(
            //   `[TutorConversationStream] Background task COMPLETED: ${name}`
            // );
          } catch (error) {
            console.error(
              `[TutorConversationStream] Background task FAILED: ${name}`,
              error
            );
          }
        }
      )
    );


    return {
      success:
        true,

      conversationId:
        conversation.id,

      assistantMessageId:
        savedAssistantMessage?.id ||
        null,
    };
  } catch (error) {
    /*
    ============================================================
    CENTRAL ERROR HANDLING
    ============================================================
    */

    console.error(
      "[TutorConversationStream] ERROR:",
      error
    );


    /*
    ============================================================
    ERROR BEFORE SSE
    ============================================================
    */

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
        success:
          false,

        message:
          error?.message ||
          "Tutor streaming failed.",
      });
    }


    /*
    ============================================================
    ERROR AFTER SSE
    ============================================================
    */

    try {
      res.write(
        `data: ${JSON.stringify({
          type:
            "error",

          message:
            "Tutor failed while generating the response.",
        })}\n\n`
      );

      if (res.flush) {
        res.flush();
      }
    } catch {}


    try {
      res.end();
    } catch {}
  }
}