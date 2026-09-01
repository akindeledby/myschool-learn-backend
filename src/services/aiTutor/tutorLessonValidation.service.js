
import { resolveStudent } from "../../services/elevenLabs/studentResolver.service.js";
import { db } from "../../../lib/db.js";

export async function getAndValidateTopic({
  userId,
  studentId,
  topicId,
  subjectId,
  termId,
}) {
  if (!userId || !topicId || !subjectId || !termId) {
    const error = new Error(
      "subjectId, termId and topicId are required."
    );

    error.statusCode = 400;

    throw error;
  }


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
  
  /**
   * Retrieve the selected topic together with its curriculum
   * relationships and any existing Tutor objectives.
   */
  const topic = await db.topic.findUnique({
    where: {
      id: topicId,
    },
    include: {
      subject: true,
      term: true,
      class: true,
      lessonObjectives: {
        orderBy: {
          order: "asc",
        },
      },
    },
  });

  if (!topic) {
    const error = new Error("Topic not found.");
    error.statusCode = 404;

    throw error;
  }

  /**
   * Make sure the topic belongs to the selected subject.
   */
  if (topic.subjectId !== subjectId) {
    const error = new Error(
      "The selected topic does not belong to the selected subject."
    );

    error.statusCode = 400;

    throw error;
  }

  /**
   * Make sure the topic belongs to the selected term.
   */
  if (topic.termId !== termId) {
    const error = new Error(
      "The selected topic does not belong to the selected term."
    );

    error.statusCode = 400;

    throw error;
  }

  /**
   * Make sure the topic belongs to the student's class.
   *
   * This prevents a student from accessing a topic belonging
   * to another class level.
   */
  if (topic.classId !== student.classId) {
    const error = new Error(
      "This topic does not belong to the student's class."
    );

    error.statusCode = 403;

    throw error;
  }

  /**
   * Validate that the selected term belongs to the student's class.
   */
  if (topic.term.classId !== student.classId) {
    const error = new Error(
      "The selected term does not belong to the student's class."
    );

    error.statusCode = 400;

    throw error;
  }

  /**
   * Validate that the selected term belongs to the selected subject.
   */
  if (topic.term.subjectId !== subjectId) {
    const error = new Error(
      "The selected term does not belong to the selected subject."
    );

    error.statusCode = 400;

    throw error;
  }

  /**
   * Validate the consistency between the Topic and its Term.
   */
  if (topic.term.classId !== topic.classId) {
    const error = new Error(
      "The topic and term belong to different classes."
    );

    error.statusCode = 400;

    throw error;
  }

  if (topic.term.subjectId !== topic.subjectId) {
    const error = new Error(
      "The topic and term belong to different subjects."
    );

    error.statusCode = 400;

    throw error;
  }

  /**
   * Return the complete validated curriculum context.
   *
   * lessonObjectives is already included so the next service can
   * immediately determine whether objectives need to be generated.
   */
  return {
    topic,
    subject: topic.subject,
    term: topic.term,
    class: topic.class,
    lessonObjectives: topic.lessonObjectives,
  };
}
