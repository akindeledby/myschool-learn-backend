import { db } from "../../lib/db.js";

export async function getSchemeOfWorkStatus(req, res) {
  try {
    const { id } = req.params;

    const schemeOfWork = await db.schemeOfWork.findUnique({
      where: { id },
      select: {
        id: true,
        processingStatus: true,
        schemeOfWorkYear: true,
        noOfPages: true,
      },
    });

    if (!schemeOfWork) {
      return res.status(404).json({ message: "Scheme not found" });
    }

    res.json(schemeOfWork);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
}


export async function fetchClassesAndSubjects(req, res) {
  try {
    const user = await db.user.findUnique({
      where: {
        id: req.user.userId,
      },
      select: {
        id: true,
        role: true,
      },
    });

    if (!user) {
      return res.status(403).json({
        error: "User not found or not an admin",
      });
    }

    const schemeOfWorks = await db.schemeOfWork.findMany({
      where: {
        uploadedById: user.id,
      },
      select: {
        id: true,
      },
    });

    if (schemeOfWorks.length === 0) {
      return res.status(404).json({
        error: "No Scheme of work found",
      });
    }

    const schemeOfWorkIds = schemeOfWorks.map(
      (schemeOfWork) => schemeOfWork.id
    );

    const classes = await db.class.findMany({
      where: {
        schemeOfWorkId: {
          in: schemeOfWorkIds,
        },
      },

      include: {
        classSubjects: {
          include: {
            subject: true,
          },
        },
      },

      orderBy: {
        createdAt: "asc",
      },
    });

    if (classes.length === 0) {
      return res.status(404).json({
        message: "No classes found",
      });
    }

    const formattedClasses = classes.map(
      ({ classSubjects, ...cls }) => ({
        ...cls,

        subjects: classSubjects
          .map((cs) => cs.subject)
          .sort((a, b) =>
            a.name.localeCompare(b.name, undefined, {
              sensitivity: "base",
            })
          ),
      })
    );

    return res.status(200).json({
      formattedClasses,
    });
  } catch (error) {
    console.error(error);

    return res.status(500).json({
      message: "Server error",
    });
  }
}


export async function fetchTopicsPerSubject(req, res) {
  try {
    const { id: subjectId } = req.params;

    if (!subjectId) {
      return res.status(400).json({
        error: "Subject ID is required",
      });
    }

    // =====================================
    // CHECK ADMIN
    // =====================================

    const user = await db.user.findUnique({
      where: {
        id: req.user.userId,
      },
      select: {
        role: true,
      },
    });

    if (!user || user.role !== "ADMIN") {
      return res.status(403).json({
        error: "User not found or not an admin",
      });
    }

    // =====================================
    // FETCH SUBJECT
    // =====================================

    const subject = await db.subject.findUnique({
      where: {
        id: subjectId,
      },
      select: {
        id: true,
        name: true,
      },
    });

    if (!subject) {
      return res.status(404).json({
        error: "Subject not found",
      });
    }

    // =====================================
    // FETCH CLASSES FOR SUBJECT
    // =====================================

    const classSubject =
      await db.classSubject.findFirst({
        where: {
          subjectId,
        },

        include: {
          class: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

    // =====================================
    // FETCH TERMS
    // =====================================

    const terms = await db.term.findMany({
      where: {
        subjectId,
      },

      orderBy: {
        position: "asc",
      },

      select: {
        id: true,
        name: true,
      },
    });

    if (!terms.length) {
      return res.status(404).json({
        error: "No terms found for this subject",
      });
    }

    // =====================================
    // FETCH TOPICS
    // =====================================

    const topics = await db.topic.findMany({
      where: {
        termId: {
          in: terms.map(
            (term) => term.id
          ),
        },
      },

      include: {
        class: {
          select: {
            id: true,
            name: true,
          },
        },
      },

      orderBy: [
        {
          week: "asc",
        },
        {
          createdAt: "asc",
        },
      ],
    });

    // =====================================
    // GROUP TOPICS BY TERM
    // =====================================

    const groupedTerms = terms.map(
      (term) => {
        const termTopics =
          topics.filter(
            (topic) =>
              topic.termId === term.id
          );

        const weekMap = {};

        termTopics.forEach(
          (topic) => {
            const week =
              topic.week ??
              "Unassigned";

            if (!weekMap[week]) {
              weekMap[week] = [];
            }

            weekMap[week].push({
              id: topic.id,
              title: topic.title,
              status: topic.status,
              createdAt:
                topic.createdAt,
              class: topic.class,
            });
          }
        );

        const weeks =
          Object.entries(weekMap)
            .sort(([a], [b]) => {
              if (
                a === "Unassigned"
              ) {
                return 1;
              }

              if (
                b === "Unassigned"
              ) {
                return -1;
              }

              return (
                Number(a) -
                Number(b)
              );
            })
            .map(
              ([week, topics]) => ({
                week,
                topics,
              })
            );

        return {
          term: {
            id: term.id,
            name: term.name,
          },

          weeks,
        };
      }
    );

    // =====================================
    // RESPONSE
    // =====================================

    return res.status(200).json({
      subject,

      class:
        classSubject.class,

      terms: groupedTerms,
    });
  } catch (error) {
    console.error(
      "❌ fetchTopicsPerSubject failed:"
    );

    console.error(error);

    return res.status(500).json({
      message: "Server error",
    });
  }
}