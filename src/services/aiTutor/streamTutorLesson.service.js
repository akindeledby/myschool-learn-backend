import { db } from "../../../lib/db.js";

import { streamTutorResponse } from "../../services/elevenLabs/aiTutorStream.service.js";
import { generateTutorSpeech } from "../../services/audio/aITutorTTS.service.js";
import { uploadTutorAudio } from "../../services/elevenLabs/tutorAudioStorage.js";
import { createTutorImage } from "../../services/elevenLabs/createTutorImage.js";
import { extractCompleteSentences } from "../../services/elevenLabs/extractCompleteSentences.service.js";
import { saveMessage } from "../../services/elevenLabs/conversation.service.js";
import { completeTutorObjective } from "../../services/aiTutor/completeTutorObjective.service.js";

import {
  updateTutorMemory,
  generateConversationSummary,
  updateTopicProgress,
  generateLearningInsights,
  updateLearningProfile,
  checkAchievements,
} from "./backgroundTutorTasks.service.js";

/*
============================================================
STREAM TUTOR LESSON
============================================================

This service is responsible only for the live Tutor lesson
response.

The important rule is:

    LIVE STREAM FIRST
    DATABASE PERSISTENCE SECOND
    BACKGROUND ANALYTICS LAST

The student should receive text, audio and images without
waiting for unrelated database work.

The current objective is completed after the AI response has
finished streaming.

The objective is NOT dependent on whether the student answered
a question correctly.

============================================================
*/

export async function streamTutorLesson({
  res,
  studentId,
  topic,
  session,
  lessonProgress,
  teachingState,
  prompt,
}) {

  /*
  ============================================================
  VALIDATION
  ============================================================
  */

  if (!studentId) {
    const error = new Error(
      "A valid student is required to stream a tutor lesson."
    );

    error.statusCode = 400;

    throw error;
  }

  if (!topic?.id) {
    const error = new Error(
      "A valid topic is required to stream a tutor lesson."
    );

    error.statusCode = 400;

    throw error;
  }

  if (!session?.id) {
    const error = new Error(
      "A valid Tutor lesson session is required."
    );

    error.statusCode = 400;

    throw error;
  }

  if (!lessonProgress?.id) {
    const error = new Error(
      "A valid Tutor lesson progress is required."
    );

    error.statusCode = 400;

    throw error;
  }

  if (!prompt) {
    const error = new Error(
      "A valid Tutor lesson prompt is required."
    );

    error.statusCode = 400;

    throw error;
  }


  /*
  ============================================================
  LESSON IDS
  ============================================================
  */

  const lessonProgressId =
    lessonProgress.id;

  const lessonSessionId =
    session.id;


  /*
  ============================================================
  GET CONVERSATION
  ============================================================
  */

  const conversation =
    session.conversation ||
    await db.tutorConversation.findUnique({
      where: {
        id: session.conversationId,
      },

      include: {
        messages: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

  if (!conversation?.id) {
    const error = new Error(
      "A valid Tutor conversation is required."
    );

    error.statusCode = 500;

    throw error;
  }


  /*
  ============================================================
  PREVIOUS CONVERSATION
  ============================================================
  */

  const conversationMessages =
    conversation.messages || [];

  const previousMessages =
    conversationMessages
      .slice(-20)
      .map((msg) => ({
        role:
          msg.role === "assistant"
            ? "model"
            : "user",

        parts: [
          {
            text: msg.content,
          },
        ],
      }));


  /*
  ============================================================
  GET STUDENT VOICE PROFILE
  ============================================================
  */

  const student =
    await db.student.findUnique({
      where: {
        id: studentId,
      },

      select: {
        id: true,
        gender: true,
      },
    });

  if (!student) {
    const error = new Error(
      "Student could not be found."
    );

    error.statusCode = 404;

    throw error;
  }

  const studentGender =
    student.gender || null;


  /*
  ============================================================
  CURRENT OBJECTIVE
  ============================================================
  
  Capture this BEFORE the lesson state is updated.

  This is the objective that the current AI response is
  teaching.

  ============================================================
  */

  const currentObjectiveId =
    teachingState?.objective?.id ||
    lessonProgress?.currentObjectiveId;

  if (!currentObjectiveId) {
    const error = new Error(
      "Unable to determine the current Tutor lesson objective."
    );

    error.statusCode = 500;

    throw error;
  }


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
  SEND CONVERSATION
  ============================================================
  */

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


  /*
  ============================================================
  START AI STREAM
  ============================================================
  */

  let fullResponse = "";

  let sentenceBuffer = "";

  const stream =
    await streamTutorResponse({
      systemPrompt:
        prompt,

      message:
        "Begin teaching this lesson.",

      previousMessages,
    });


  /*
  ============================================================
  STREAMING STATE
  ============================================================
  */

  let sentenceSequence = 0;

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

  const IMAGE_INSERT_AFTER_SENTENCE = 2;

  let imageGenerationStarted = false;

  let imageGenerationTask = null;

  let generatedImage = null;

  let imageDelivered = false;


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

    imageGenerationStarted = true;

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

    imageGenerationTask =
      createTutorImage({
        studentMessage:
          `Teach the topic: ${topic.title}`,

        tutorResponse:
          tutorResponseForImage,

        studentId,

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
            "[TutorLessonStream] Image generation failed:",
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
      Insert image after sentence 2.
      */

      if (
        !imageDelivered &&
        nextSequenceToSend >
          IMAGE_INSERT_AFTER_SENTENCE
      ) {

        if (imageGenerationTask) {
          await imageGenerationTask;
        }

        if (generatedImage) {
          sendImage();
        }
      }


      sentenceResults.delete(
        nextSequenceToSend
      );


      /*
      Send sentence to frontend.
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
  
  TTS is part of the live experience.

  Audio upload is NOT.

  Therefore audio upload is deliberately started without
  blocking sentence delivery.

  ============================================================
  */

  async function processSentence(
    sentence,
    sequence
  ) {

    try {

      /*
      ----------------------------------------
      GENERATE TTS
      ----------------------------------------
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
      ----------------------------------------
      PREPARE AUDIO
      ----------------------------------------
      */

      const audio =
        speech?.audioBuffer
          ? speech.audioBuffer.toString(
              "base64"
            )
          : null;


      /*
      ----------------------------------------
      START AUDIO STORAGE
      ----------------------------------------
      
      Do NOT await this.

      The frontend should not wait for cloud
      storage before receiving the sentence.
      ----------------------------------------
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

            studentId,

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
                `[TutorLessonStream] Failed to store audio segment ${sequence}:`,
                error
              );
            });

        audioSegmentTasks.push(
          uploadTask
        );
      }


      /*
      ----------------------------------------
      STORE SENTENCE
      ----------------------------------------
      */

      const sentenceResult = {
        sequence,

        text:
          sentence,

        audio,
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


      /*
      ----------------------------------------
      DELIVER TO FRONTEND
      ----------------------------------------
      */

      await requestOrderedDelivery();

    } catch (error) {

      console.error(
        `[TutorLessonStream] TTS failed for sentence ${sequence}:`,
        error
      );


      /*
      ----------------------------------------
      TTS FAILURE MUST NOT STOP TEXT
      ----------------------------------------
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

  for await (
    const chunk of stream
  ) {

    const text =
      chunk.text;

    if (!text) {
      continue;
    }


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


    for (
      const sentence of sentences
    ) {

      sentenceSequence++;

      const currentSequence =
        sentenceSequence;


      /*
      ----------------------------------------
      START IMAGE GENERATION
      ----------------------------------------
      */

      if (
        !imageGenerationStarted &&
        currentSequence >=
          IMAGE_INSERT_AFTER_SENTENCE
      ) {

        startImageGeneration();
      }


      /*
      ----------------------------------------
      PROCESS SENTENCE
      ----------------------------------------
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
  WAIT FOR ALL SENTENCES
  ============================================================
  
  This waits for TTS generation and sentence delivery.

  It does NOT wait for audio uploads.
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
  FLUSH ANY REMAINING SENTENCES
  ============================================================
  */

  await requestOrderedDelivery();


  /*
  ============================================================
  SEND IMAGE IF NOT ALREADY INSERTED
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
  WAIT FOR AUDIO UPLOADS
  ============================================================
  
  This is persistence work.

  It is deliberately done AFTER the live sentence/image
  stream has finished.

  The frontend has already received the complete teaching
  response at this point.
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
  SAVE ASSISTANT MESSAGE
  ============================================================
  
  This happens after all live content has been delivered.

  ============================================================
  */

  let messageSaveSucceeded = true;

  try {

    await saveMessage({
      conversationId:
        conversation.id,

      lessonSessionId,

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

  } catch (error) {

    messageSaveSucceeded = false;

    console.error(
      "[TutorLessonStream] Failed to save assistant message:",
      error
    );
  }


  /*
  ============================================================
  UPDATE CONVERSATION
  ============================================================
  */

  try {

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

  } catch (error) {

    console.error(
      "[TutorLessonStream] Failed to update conversation:",
      error
    );
  }


  /*
  ============================================================
  COMPLETE CURRENT OBJECTIVE
  ============================================================
  
  IMPORTANT:

  This happens after the AI teaching response is completely
  streamed.

  It does NOT depend on whether the student answered a
  question correctly.

  The completion means:

      "The Tutor has finished teaching this objective."

  ============================================================
  */

  let objectiveCompletion = null;

  try {

    objectiveCompletion =
      await completeTutorObjective({
        lessonProgressId,

        objectiveId:
          currentObjectiveId,
      });

  } catch (error) {

    console.error(
      "[TutorLessonStream] Failed to complete Tutor objective:",
      error
    );

    /*
    The live teaching response has already been delivered.

    Therefore we should not destroy the SSE connection here.

    Send a controlled lesson error state instead.
    */

    res.write(
      `data: ${JSON.stringify({
        type:
          "lesson_progress_error",

        message:
          "The lesson was taught successfully, but lesson progress could not be updated.",
      })}\n\n`
    );

    if (res.flush) {
      res.flush();
    }
  }


  /*
  ============================================================
  GET UPDATED LESSON PROGRESS
  ============================================================
  */

  const updatedLessonProgress =
    objectiveCompletion?.lessonProgress ||
    null;


  /*
  ============================================================
  UPDATE LESSON SESSION
  ============================================================
  */

  if (updatedLessonProgress) {

    try {

      await db.tutorLessonSession.update({
        where: {
          id:
            lessonSessionId,
        },

        data: {

          endingObjectiveId:
            updatedLessonProgress.currentObjectiveId ??
            null,

          endingStep:
            updatedLessonProgress.currentStep ??
            null,
        },
      });

    } catch (error) {

      console.error(
        "[TutorLessonStream] Failed to update lesson session:",
        error
      );
    }
  }


  /*
  ============================================================
  SEND FINAL DONE EVENT
  ============================================================
  
  This is the important frontend synchronization point.

  The frontend receives the new lesson state here.

  ============================================================
  */

  res.write(
    `data: ${JSON.stringify({
      type:
        "done",

      lessonProgress:
        updatedLessonProgress
          ? {
              id:
                updatedLessonProgress.id,

              currentObjectiveId:
                updatedLessonProgress.currentObjectiveId,

              currentStep:
                updatedLessonProgress.currentStep,

              progressPercent:
                updatedLessonProgress.progressPercent,

              status:
                updatedLessonProgress.status,
            }
          : null,

      objective:
        updatedLessonProgress
          ? {
              completed:
                true,

              completedObjectiveId:
                currentObjectiveId,

              nextObjectiveId:
                objectiveCompletion
                  ?.nextObjective
                  ?.id ??
                null,
            }
          : {
              completed:
                false,

              completedObjectiveId:
                currentObjectiveId,

              nextObjectiveId:
                null,
            },

      persistence:
        {
          messageSaved:
            messageSaveSucceeded,
        },
    })}\n\n`
  );

  if (res.flush) {
    res.flush();
  }


  /*
  ============================================================
  END SSE CONNECTION
  ============================================================
  */

  res.end();


  /*
  ============================================================
  BACKGROUND TASKS
  ============================================================
  
  IMPORTANT:

  Everything below happens AFTER res.end().

  None of these operations should determine whether the
  frontend receives the completed lesson response.

  ============================================================
  */

  const backgroundTasks = [];


  backgroundTasks.push(
    updateTutorMemory({
      studentId,

      conversationId:
        conversation.id,
    })
  );


  backgroundTasks.push(
    generateConversationSummary(
      conversation.id,
      studentId
    )
  );


  backgroundTasks.push(
    updateTopicProgress({
      conversationId:
        conversation.id,

      studentId,

      topicId:
        topic.id,

      lessonProgressId,

      lessonSessionId,
    })
  );


  backgroundTasks.push(
    generateLearningInsights(
      studentId
    )
  );


  backgroundTasks.push(
    updateLearningProfile(
      conversation.id,
      studentId
    )
  );


  backgroundTasks.push(
    checkAchievements(
      studentId
    )
  );


  /*
  ============================================================
  RUN BACKGROUND TASKS
  ============================================================
  */

  Promise.allSettled(
    backgroundTasks
  ).then((results) => {

    const failures =
      results.filter(
        (result) =>
          result.status ===
          "rejected"
      );

    if (failures.length > 0) {

      console.error(
        `[TutorLessonStream] ${failures.length} background task(s) failed.`
      );

      for (
        const failure of failures
      ) {

        console.error(
          "[TutorLessonStream] Background task error:",
          failure.reason
        );
      }
    }

  }).catch((error) => {

    console.error(
      "[TutorLessonStream] Background task runner failed:",
      error
    );
  });
}