import { db } from "../../lib/db.js";
import { randomUUID } from "crypto";

// ============================================================
// NORMALIZE CLASS NAME
// ============================================================

function normalizeClassName(className = "") {
  const value = className
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");

  // Junior Secondary
  if (/^JSS\s*1$/.test(value)) return "JSS1";
  if (/^JSS\s*2$/.test(value)) return "JSS2";
  if (/^JSS\s*3$/.test(value)) return "JSS3";

  // Senior Secondary
  if (/^SS\s*1$/.test(value)) return "SS1";
  if (/^SS\s*2$/.test(value)) return "SS2";
  if (/^SS\s*3$/.test(value)) return "SS3";

  // Primary
  if (/^PRIMARY\s*1$/.test(value)) return "PRIMARY 1";
  if (/^PRIMARY\s*2$/.test(value)) return "PRIMARY 2";
  if (/^PRIMARY\s*3$/.test(value)) return "PRIMARY 3";
  if (/^PRIMARY\s*4$/.test(value)) return "PRIMARY 4";
  if (/^PRIMARY\s*5$/.test(value)) return "PRIMARY 5";
  if (/^PRIMARY\s*6$/.test(value)) return "PRIMARY 6";

  return value;
}

// ============================================================
// NORMALIZE SUBJECT NAME
// ============================================================

function normalizeSubjectName(subjectName = "") {
  return subjectName
    .trim()
    .replace(/\s+/g, " ");
}

// ============================================================
// NORMALIZE TERM
// ============================================================

function normalizeTerm(termName = "") {
  const value = termName
    .trim()
    .toUpperCase();

  if (value.includes("FIRST")) {
    return {
      name: "FIRST TERM",
      position: 1,
    };
  }

  if (value.includes("SECOND")) {
    return {
      name: "SECOND TERM",
      position: 2,
    };
  }

  if (value.includes("THIRD")) {
    return {
      name: "THIRD TERM",
      position: 3,
    };
  }

  return {
    name: termName.trim(),
    position: 999,
  };
}

// ============================================================
// NORMALIZE TOPIC TITLE
// ============================================================

function normalizeTopicTitle(title = "") {
  return title
    .trim()
    .replace(/\s+/g, " ");
}

// ============================================================
// SAVE / REPLACE SCHEME OF WORK
// ============================================================

export async function saveSchemeOfWork(
  data,
  schemeOfWorkId
) {
  try {
    console.log("💾 Saving Scheme of Work...");

    // ========================================================
    // COUNTERS
    // ========================================================

    let subjectsCreated = 0;
    let subjectsReused = 0;

    let classesCreated = 0;
    let classesReused = 0;

    let classSubjectsCreated = 0;
    let classSubjectsReused = 0;

    let termsCreated = 0;
    let termsDeleted = 0;

    let topicsCreated = 0;
    let topicsDeleted = 0;

    const result = await db.$transaction(
      async (tx) => {

        // ====================================================
        // PROCESS SUBJECTS
        // ====================================================

        for (const subjectData of data.subjects ?? []) {
          const subjectName =
            normalizeSubjectName(subjectData.name);

          if (!subjectName) {
            console.warn(
              "⚠️ Skipping subject with empty name."
            );

            continue;
          }

          console.log(
            `\n📚 Processing subject: ${subjectName}`
          );

          // ==================================================
          // PROCESS CLASSES
          // ==================================================

          for (
            const classData of subjectData.classes ?? []
          ) {
            const className =
              normalizeClassName(classData.name);

            if (!className) {
              console.warn(
                "⚠️ Skipping class with empty name."
              );

              continue;
            }

            console.log(
              `🏫 Processing class: ${className}`
            );


            let classRecord =
              await tx.class.findUnique({
                where: {
                  name: className,
                },
              });

            if (!classRecord) {
              classRecord =
                await tx.class.create({
                  data: {
                    id: randomUUID(),
                    name: className,
                    schemeOfWorkId,
                  },
                });

              classesCreated++;

              console.log(
                `🆕 Created class: ${className}`
              );
            } else {
              classesReused++;

              console.log(
                `📦 Reusing existing class: ${className}`
              );
            }

            // =================================================
            // FIND EXISTING CLASS → SUBJECT RELATIONSHIP
            // =================================================

            let classSubject =
              await tx.classSubject.findFirst({
                where: {
                  classId: classRecord.id,

                  subject: {
                    name: subjectName,
                  },
                },

                include: {
                  subject: true,
                },
              });

            let subject;

            // =================================================
            // EXISTING CLASS → SUBJECT
            // =================================================

            if (classSubject) {
              subject = classSubject.subject;

              subjectsReused++;
              classSubjectsReused++;

              console.log(
                `📦 Reusing subject "${subjectName}" for ${className}`
              );
            }

            // =================================================
            // CLASS → SUBJECT DOES NOT EXIST
            // =================================================

            else {
              // ------------------------------------------------
              // Find subject belonging to current scheme
              // ------------------------------------------------

              subject =
                await tx.subject.findFirst({
                  where: {
                    name: subjectName,
                    schemeOfWorkId,
                  },
                });

              // ------------------------------------------------
              // Create subject if necessary
              // ------------------------------------------------

              if (!subject) {
                subject =
                  await tx.subject.create({
                    data: {
                      id: randomUUID(),
                      name: subjectName,
                      schemeOfWorkId,
                    },
                  });

                subjectsCreated++;

                console.log(
                  `🆕 Created subject: ${subjectName}`
                );
              } else {
                subjectsReused++;

                console.log(
                  `📦 Reusing subject: ${subjectName}`
                );
              }

              // ------------------------------------------------
              // Create class → subject relationship
              // ------------------------------------------------

              await tx.classSubject.create({
                data: {
                  classId: classRecord.id,
                  subjectId: subject.id,
                },
              });

              classSubjectsCreated++;

              console.log(
                `🔗 Linked ${className} → ${subjectName}`
              );
            }

            console.log(
              `♻️ Preparing to replace old scheme for ${className} → ${subjectName}`
            );

            const deletedTerms =
              await tx.term.deleteMany({
                where: {
                  classId: classRecord.id,
                  subjectId: subject.id,
                },
              });

            if (deletedTerms.count > 0) {
              termsDeleted += deletedTerms.count;

              console.log(
                `🗑️ Deleted ${deletedTerms.count} old terms from ${className} → ${subjectName}`
              );
            }

            for (
              const termData of classData.terms ?? []
            ) {
              const normalizedTerm =
                normalizeTerm(termData.name);

              // ------------------------------------------------
              // CREATE TERM
              // ------------------------------------------------

              const term =
                await tx.term.create({
                  data: {
                    id: randomUUID(),

                    name:
                      normalizedTerm.name,

                    position:
                      normalizedTerm.position,

                    schemeOfWorkId,

                    classId:
                      classRecord.id,

                    subjectId:
                      subject.id,
                  },
                });

              termsCreated++;

              console.log(
                `🆕 Created term: ${className} → ${subjectName} → ${normalizedTerm.name}`
              );

              const topicRecords = [];

              for (
                const topicData of termData.topics ?? []
              ) {
                const topicTitle =
                  normalizeTopicTitle(
                    topicData.title
                  );

                if (!topicTitle) {
                  console.warn(
                    "⚠️ Skipping topic with empty title."
                  );

                  continue;
                }

                topicRecords.push({
                  id: randomUUID(),

                  week:
                    topicData.week,

                  title:
                    topicTitle,

                  lessonContents:
                    topicData.lessonContents ?? [],

                  schemeOfWorkId,

                  classId:
                    classRecord.id,

                  subjectId:
                    subject.id,

                  termId:
                    term.id,
                });
              }

              // =================================================
              // BULK CREATE TOPICS
              // =================================================

              if (topicRecords.length > 0) {
                const createdTopics =
                  await tx.topic.createMany({
                    data: topicRecords,
                  });

                topicsCreated +=
                  createdTopics.count;

                console.log(
                  `🆕 Created ${createdTopics.count} topics: ${className} → ${subjectName} → ${normalizedTerm.name}`
                );
              }
            }
          }
        }

        // ====================================================
        // RETURN SUMMARY
        // ====================================================

        return {
          subjectsCreated,
          subjectsReused,

          classesCreated,
          classesReused,

          classSubjectsCreated,
          classSubjectsReused,

          termsCreated,
          termsDeleted,

          topicsCreated,
          topicsDeleted,
        };
      },

      // ======================================================
      // TRANSACTION OPTIONS
      // ======================================================

      {
        maxWait: 10000,
        timeout: 30000,
      }
    );

    // ========================================================
    // IMPORT SUMMARY
    // ========================================================

    console.log(
      "\n📊 Scheme of Work Replacement Summary"
    );

    console.table({
      "Subjects Created":
        result.subjectsCreated,

      "Subjects Reused":
        result.subjectsReused,

      "Classes Created":
        result.classesCreated,

      "Classes Reused":
        result.classesReused,

      "ClassSubjects Created":
        result.classSubjectsCreated,

      "ClassSubjects Reused":
        result.classSubjectsReused,

      "Terms Deleted":
        result.termsDeleted,

      "Terms Created":
        result.termsCreated,

      "Topics Created":
        result.topicsCreated,

      "Topics Deleted":
        result.topicsDeleted,
    });

    console.log(
      "✅ Scheme of Work replaced successfully."
    );

    return {
      success: true,
      ...result,
    };

  } catch (error) {
    console.error(
      "❌ Failed to replace Scheme of Work:",
      error
    );

    throw error;
  }
}



// import { db } from "../../lib/db.js";
// import { randomUUID } from "crypto";

// const TOPIC_BATCH_SIZE = 500;

// // ============================================================
// // NORMALIZE CLASS NAME
// // ============================================================

// function normalizeClassName(className = "") {
//   const value = className
//     .trim()
//     .toUpperCase()
//     .replace(/\s+/g, " ");

//   // Junior Secondary
//   if (/^JSS\s*1$/.test(value)) {
//     return "JSS1";
//   }

//   if (/^JSS\s*2$/.test(value)) {
//     return "JSS2";
//   }

//   if (/^JSS\s*3$/.test(value)) {
//     return "JSS3";
//   }

//   // Senior Secondary
//   if (/^SS\s*1$/.test(value)) {
//     return "SS1";
//   }

//   if (/^SS\s*2$/.test(value)) {
//     return "SS2";
//   }

//   if (/^SS\s*3$/.test(value)) {
//     return "SS3";
//   }

//   // Primary
//   if (/^PRIMARY\s*1$/.test(value)) {
//     return "PRIMARY 1";
//   }

//   if (/^PRIMARY\s*2$/.test(value)) {
//     return "PRIMARY 2";
//   }

//   if (/^PRIMARY\s*3$/.test(value)) {
//     return "PRIMARY 3";
//   }

//   if (/^PRIMARY\s*4$/.test(value)) {
//     return "PRIMARY 4";
//   }

//   if (/^PRIMARY\s*5$/.test(value)) {
//     return "PRIMARY 5";
//   }

//   if (/^PRIMARY\s*6$/.test(value)) {
//     return "PRIMARY 6";
//   }

//   return value;
// }

// // ============================================================
// // NORMALIZE SUBJECT NAME
// // ============================================================

// function normalizeSubjectName(subjectName = "") {
//   return subjectName
//     .trim()
//     .replace(/\s+/g, " ");
// }

// // ============================================================
// // NORMALIZE TERM
// // ============================================================

// function normalizeTerm(termName = "") {
//   const value = termName
//     .trim()
//     .toUpperCase();

//   if (value.includes("FIRST")) {
//     return {
//       name: "FIRST TERM",
//       position: 1,
//     };
//   }

//   if (value.includes("SECOND")) {
//     return {
//       name: "SECOND TERM",
//       position: 2,
//     };
//   }

//   if (value.includes("THIRD")) {
//     return {
//       name: "THIRD TERM",
//       position: 3,
//     };
//   }

//   return {
//     name: termName.trim(),
//     position: 999,
//   };
// }

// // ============================================================
// // NORMALIZE TOPIC TITLE
// // ============================================================

// function normalizeTopicTitle(title = "") {
//   return title
//     .trim()
//     .replace(/\s+/g, " ");
// }

// // ============================================================
// // SAVE SCHEME OF WORK
// // ============================================================

// export async function saveSchemeOfWork(
//   data,
//   schemeOfWorkId
// ) {
//   try {
//     console.log(
//       "💾 Saving Scheme of Work..."
//     );

//     // ========================================================
//     // COUNTERS
//     // ========================================================

//     let subjectsCreated = 0;
//     let subjectsReused = 0;

//     let classesCreated = 0;
//     let classesReused = 0;

//     let classSubjectsCreated = 0;
//     let classSubjectsReused = 0;

//     let termsCreated = 0;
//     let termsReused = 0;

//     let topicsCreated = 0;
//     let topicsUpdated = 0;

//     // ========================================================
//     // PROCESS SUBJECTS
//     // ========================================================

//     for (const subjectData of data.subjects ?? []) {
//       const subjectName =
//         normalizeSubjectName(
//           subjectData.name
//         );

//       if (!subjectName) {
//         console.warn(
//           "⚠️ Skipping subject with empty name."
//         );

//         continue;
//       }

//       // ======================================================
//       // FIND OR CREATE SUBJECT
//       // ======================================================

//       let subject =
//         await db.subject.findUnique({
//           where: {
//             name: subjectName,
//           },
//         });

//       if (subject) {
//         subjectsReused++;

//         console.log(
//           `📦 Reusing subject: ${subjectName}`
//         );
//       } else {
//         subject =
//           await db.subject.create({
//             data: {
//               id: randomUUID(),
//               name: subjectName,
//               schemeOfWorkId,
//             },
//           });

//         subjectsCreated++;

//         console.log(
//           `🆕 Created subject: ${subjectName}`
//         );
//       }

//       // ======================================================
//       // PROCESS CLASSES
//       // ======================================================

//       for (const classData of subjectData.classes ?? []) {
//         const className =
//           normalizeClassName(
//             classData.name
//           );

//         if (!className) {
//           console.warn(
//             "⚠️ Skipping class with empty name."
//           );

//           continue;
//         }

//         // ====================================================
//         // FIND OR CREATE CLASS
//         // ====================================================

//         let classRecord =
//           await db.class.findUnique({
//             where: {
//               name: className,
//             },
//           });

//         if (classRecord) {
//           classesReused++;

//           console.log(
//             `📦 Reusing class: ${className}`
//           );
//         } else {
//           classRecord =
//             await db.class.create({
//               data: {
//                 id: randomUUID(),
//                 name: className,
//                 schemeOfWorkId,
//               },
//             });

//           classesCreated++;

//           console.log(
//             `🆕 Created class: ${className}`
//           );
//         }

//         // ====================================================
//         // CREATE OR REUSE CLASS SUBJECT
//         // ====================================================

//         const existingClassSubject =
//           await db.classSubject.findUnique({
//             where: {
//               classId_subjectId: {
//                 classId:
//                   classRecord.id,

//                 subjectId:
//                   subject.id,
//               },
//             },
//           });

//         if (existingClassSubject) {
//           classSubjectsReused++;
//         } else {
//           await db.classSubject.create({
//             data: {
//               classId:
//                 classRecord.id,

//               subjectId:
//                 subject.id,
//             },
//           });

//           classSubjectsCreated++;
//         }

//         // ====================================================
//         // PROCESS TERMS
//         // ====================================================

//         for (const termData of classData.terms ?? []) {
//           const normalizedTerm =
//             normalizeTerm(
//               termData.name
//             );

//           // ==================================================
//           // FIND EXISTING TERM
//           // ==================================================

//           let term =
//             await db.term.findFirst({
//               where: {
//                 classId:
//                   classRecord.id,

//                 subjectId:
//                   subject.id,

//                 position:
//                   normalizedTerm.position,
//               },
//             });

//           // ==================================================
//           // CREATE TERM
//           // ==================================================

//           if (!term) {
//             term =
//               await db.term.create({
//                 data: {
//                   id: randomUUID(),

//                   name:
//                     normalizedTerm.name,

//                   position:
//                     normalizedTerm.position,

//                   schemeOfWorkId,

//                   classId:
//                     classRecord.id,

//                   subjectId:
//                     subject.id,
//                 },
//               });

//             termsCreated++;

//             console.log(
//               `🆕 Created term: ${className} → ${subjectName} → ${normalizedTerm.name}`
//             );
//           } else {
//             termsReused++;

//             console.log(
//               `📦 Reusing term: ${className} → ${subjectName} → ${normalizedTerm.name}`
//             );
//           }

//           // ==================================================
//           // PROCESS TOPICS
//           // ==================================================

//           for (const topicData of termData.topics ?? []) {
//             const topicTitle =
//               normalizeTopicTitle(
//                 topicData.title
//               );

//             if (!topicTitle) {
//               console.warn(
//                 "⚠️ Skipping topic with empty title."
//               );

//               continue;
//             }

//             // ================================================
//             // FIND EXISTING TOPIC
//             // ================================================

//             const existingTopic =
//               await db.topic.findFirst({
//                 where: {
//                   termId:
//                     term.id,

//                   title:
//                     topicTitle,
//                 },
//               });

//             // ================================================
//             // UPDATE EXISTING TOPIC
//             // ================================================

//             if (existingTopic) {
//               await db.topic.update({
//                 where: {
//                   id:
//                     existingTopic.id,
//                 },

//                 data: {
//                   week:
//                     topicData.week,

//                   lessonContents:
//                     topicData.lessonContents ??
//                     [],
//                 },
//               });

//               topicsUpdated++;

//               console.log(
//                 `🔄 Updated topic: ${topicTitle}`
//               );

//               continue;
//             }

//             // ================================================
//             // CREATE NEW TOPIC
//             // ================================================

//             await db.topic.create({
//               data: {
//                 id: randomUUID(),

//                 week:
//                   topicData.week,

//                 title:
//                   topicTitle,

//                 lessonContents:
//                   topicData.lessonContents ??
//                   [],

//                 schemeOfWorkId,

//                 classId:
//                   classRecord.id,

//                 subjectId:
//                   subject.id,

//                 termId:
//                   term.id,
//               },
//             });

//             topicsCreated++;

//             console.log(
//               `🆕 Created topic: ${topicTitle}`
//             );
//           }
//         }
//       }
//     }

//     // ========================================================
//     // IMPORT SUMMARY
//     // ========================================================

//     console.log(
//       "\n📊 Scheme of Work Import Summary"
//     );

//     console.table({
//       "Subjects Created":
//         subjectsCreated,

//       "Subjects Reused":
//         subjectsReused,

//       "Classes Created":
//         classesCreated,

//       "Classes Reused":
//         classesReused,

//       "ClassSubjects Created":
//         classSubjectsCreated,

//       "ClassSubjects Reused":
//         classSubjectsReused,

//       "Terms Created":
//         termsCreated,

//       "Terms Reused":
//         termsReused,

//       "Topics Created":
//         topicsCreated,

//       "Topics Updated":
//         topicsUpdated,
//     });

//     console.log(
//       "✅ Scheme of Work saved successfully."
//     );

//     return {
//       success: true,

//       subjectsCreated,
//       subjectsReused,

//       classesCreated,
//       classesReused,

//       classSubjectsCreated,
//       classSubjectsReused,

//       termsCreated,
//       termsReused,

//       topicsCreated,
//       topicsUpdated,
//     };
//   } catch (error) {
//     console.error(
//       "❌ Failed to save Scheme of Work:",
//       error
//     );

//     throw error;
//   }
// }


// import { db } from "../../lib/db.js";
// import { randomUUID } from "crypto";

// const TOPIC_BATCH_SIZE = 500;

// function normalizeTerm(termName = "") {
//   const value = termName.trim().toUpperCase();

//   if (value.includes("FIRST")) {
//     return {
//       name: "FIRST TERM",
//       position: 1,
//     };
//   }

//   if (value.includes("SECOND")) {
//     return {
//       name: "SECOND TERM",
//       position: 2,
//     };
//   }

//   if (value.includes("THIRD")) {
//     return {
//       name: "THIRD TERM",
//       position: 3,
//     };
//   }

//   return {
//     name: termName.trim(),
//     position: 999,
//   };
// }

// export async function saveSchemeOfWork(data, schemeOfWorkId) {
//   try {
//     console.log("💾 Saving Scheme of Work...");

//     const subjects = [];
//     const classes = [];
//     const classSubjects = [];
//     const terms = [];
//     const topics = [];

//     for (const subject of data.subjects ?? []) {
//       const subjectId = randomUUID();

//       subjects.push({
//         id: subjectId,
//         name: subject.name.trim(),
//         schemeOfWorkId,
//       });

//       for (const cls of subject.classes ?? []) {
//         const classId = randomUUID();

//         classes.push({
//           id: classId,
//           name: cls.name.trim(),
//           schemeOfWorkId,
//         });

//         classSubjects.push({
//           classId,
//           subjectId,
//         });

//         for (const term of cls.terms ?? []) {
//           const normalizedTerm = normalizeTerm(term.name);

//           const termId = randomUUID();

//           terms.push({
//             id: termId,
//             name: normalizedTerm.name,
//             position: normalizedTerm.position,
//             schemeOfWorkId,
//             classId,
//             subjectId,
//           });

//           for (const topic of term.topics ?? []) {
//             topics.push({
//               id: randomUUID(),
//               week: topic.week,
//               title: topic.title.trim(),
//               lessonContents: topic.lessonContents ?? [],
//               schemeOfWorkId,
//               classId,
//               subjectId,
//               termId,
//             });
//           }
//         }
//       }
//     }

//     console.log("📊 Import Summary");
//     console.table({
//       Subjects: subjects.length,
//       Classes: classes.length,
//       "Class Subjects": classSubjects.length,
//       Terms: terms.length,
//       Topics: topics.length,
//     });

//     // Fast bulk inserts
//     await db.$transaction(
//       [
//         ...(subjects.length
//           ? [db.subject.createMany({ data: subjects })]
//           : []),

//         ...(classes.length
//           ? [db.class.createMany({ data: classes })]
//           : []),

//         ...(classSubjects.length
//           ? [db.classSubject.createMany({ data: classSubjects })]
//           : []),

//         ...(terms.length
//           ? [db.term.createMany({ data: terms })]
//           : []),
//       ],
//       {
//         timeout: 30000,
//         maxWait: 10000,
//       }
//     );

//     // Insert topics separately in batches
//     for (let i = 0; i < topics.length; i += TOPIC_BATCH_SIZE) {
//       const batch = topics.slice(i, i + TOPIC_BATCH_SIZE);

//       console.log(
//         `📥 Saving topics ${i + 1} - ${i + batch.length} of ${topics.length}`
//       );

//       await db.topic.createMany({
//         data: batch,
//       });
//     }

//     console.log("✅ Scheme of Work saved successfully.");

//     return {
//       subjectsCount: subjects.length,
//       classesCount: classes.length,
//       termsCount: terms.length,
//       topicsCount: topics.length,
//     };
//   } catch (error) {
//     console.error("❌ Failed to save Scheme of Work:", error);
//     throw error;
//   }
// }