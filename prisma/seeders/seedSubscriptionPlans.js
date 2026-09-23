import { db } from "../../lib/db.js";

export async function seedSubscriptionPlans() {

  const plans = [
    {
      subscriptionPlanName:
        "FREEMIUM_INDIVIDUAL",

      pricePerTerm: 0,

      pricePerSession: 0,

      maxStudents: 1,

      videoLessonLimit: null,
      homeHelperLimit: 5,

      canTakeTest: false,
      canPracticeForQuiz: false,
      canPracticeForExam: false,
      canChatWithLearningAssistant: false,
      canPlayCardGame: false,
      canSpeakWithTeacher: false,
      canPlaySpeedChallange: false,
      canPlayMillionaire: false,
      canPartakeInLeaderboardRanking: false,
      canDownloadOfflineContent: false,
    },

    {
      subscriptionPlanName:
        "SILVER_INDIVIDUAL",

      pricePerTerm: 3500,

      pricePerSession: 9500,

      maxStudents: 1,

      videoLessonLimit: null,
      homeHelperLimit: null,

      canTakeTest: true,
      canPracticeForQuiz: true,
      canPracticeForExam: true,
      canChatWithLearningAssistant: false,
      canPlayCardGame: false,
      canSpeakWithTeacher: false,
      canPlaySpeedChallange: false,
      canPlayMillionaire: false,
      canPartakeInLeaderboardRanking: false,
      canDownloadOfflineContent: true,
    },

    {
      subscriptionPlanName:
        "DIAMOND_INDIVIDUAL",

      pricePerTerm: 6000,

      pricePerSession: 16000,

      maxStudents: 1,

      videoLessonLimit: null,
      homeHelperLimit: null,

      canTakeTest: true,
      canPracticeForQuiz: true,
      canPracticeForExam: true,
      canChatWithLearningAssistant: true,
      canPlayCardGame: true,
      canSpeakWithTeacher: false,
      canPlaySpeedChallange: false,
      canPlayMillionaire: false,
      canPartakeInLeaderboardRanking: false,
      canDownloadOfflineContent: true,
    },

    {
      subscriptionPlanName:
        "GOLD_INDIVIDUAL",

      pricePerTerm: 10000,

      pricePerSession: 25000,

      maxStudents: 1,

      videoLessonLimit: null,
      homeHelperLimit: null,

      canTakeTest: true,
      canPracticeForQuiz: true,
      canPracticeForExam: true,
      canChatWithLearningAssistant: true,
      canPlayCardGame: true,
      canSpeakWithTeacher: true,
      canPlaySpeedChallange: true,
      canPlayMillionaire: true,
      canPartakeInLeaderboardRanking: true,
      canDownloadOfflineContent: true,
    },

    {
      subscriptionPlanName:
        "FREEMIUM_FAMILY",

      pricePerTerm: 0,

      pricePerSession: 0,

      maxStudents: 2,

      videoLessonLimit: null,
      homeHelperLimit: 10,

      canTakeTest: false,
      canPracticeForQuiz: false,
      canPracticeForExam: false,
      canChatWithLearningAssistant: false,
      canPlayCardGame: false,
      canSpeakWithTeacher: false,
      canPlaySpeedChallange: false,
      canPlayMillionaire: false,
      canPartakeInLeaderboardRanking: false,
      canDownloadOfflineContent: false,
    },

    {
      subscriptionPlanName:
        "SILVER_FAMILY",

      pricePerTerm: 12000,

      pricePerSession: 34000,

      maxStudents: 4,

      videoLessonLimit: null,
      homeHelperLimit: null,

      canTakeTest: true,
      canPracticeForQuiz: true,
      canPracticeForExam: true,
      canChatWithLearningAssistant: false,
      canPlayCardGame: false,
      canSpeakWithTeacher: false,
      canPlaySpeedChallange: false,
      canPlayMillionaire: false,
      canPartakeInLeaderboardRanking: false,
      canDownloadOfflineContent: true,
    },

    {
      subscriptionPlanName:
        "DIAMOND_FAMILY",

      pricePerTerm: 22000,

      pricePerSession: 61000,

      maxStudents: 4,

      videoLessonLimit: null,
      homeHelperLimit: null,

      canTakeTest: true,
      canPracticeForQuiz: true,
      canPracticeForExam: true,
      canChatWithLearningAssistant: true,
      canPlayCardGame: true,
      canSpeakWithTeacher: true,
      canPlaySpeedChallange: false,
      canPlayMillionaire: false,
      canPartakeInLeaderboardRanking: false,
      canDownloadOfflineContent: true,
    },

    {
      subscriptionPlanName:
        "GOLD_FAMILY",

      pricePerTerm: 30000,

      pricePerSession: 85000,

      maxStudents: 5,

      videoLessonLimit: null,
      homeHelperLimit: null,

      canTakeTest: true,
      canPracticeForQuiz: true,
      canPracticeForExam: true,
      canChatWithLearningAssistant: true,
      canPlayCardGame: true,
      canSpeakWithTeacher: true,
      canPlaySpeedChallange: true,
      canPlayMillionaire: true,
      canPartakeInLeaderboardRanking: true,
      canDownloadOfflineContent: true,
    },

    {
      subscriptionPlanName:
        "FREEMIUM_SCHOOL",

      pricePerTerm: 0,
      pricePerSession: 0,
      maxStudents: 50,

      videoLessonLimit: null,
      homeHelperLimit: 10,

      canTakeTest: false,
      canPracticeForQuiz: false,
      canPracticeForExam: false,
      canChatWithLearningAssistant: false,
      canPlayCardGame: false,
      canSpeakWithTeacher: false,
      canPlaySpeedChallange: false,
      canPlayMillionaire: false,
      canPartakeInLeaderboardRanking: false,
      canDownloadOfflineContent: false,
    },

    {
      subscriptionPlanName:
        "SILVER_SCHOOL",

      pricePerTerm: 250000,

      pricePerSession: 700000,

      maxStudents: 150,

      videoLessonLimit: null,
      homeHelperLimit: null,

      canTakeTest: true,
      canPracticeForQuiz: true,
      canPracticeForExam: true,
      canChatWithLearningAssistant: true,
      canPlayCardGame: true,
      canSpeakWithTeacher: true,
      canPlaySpeedChallange: false,
      canPlayMillionaire: false,
      canPartakeInLeaderboardRanking: true,
      canDownloadOfflineContent: true,
    },

    {
      subscriptionPlanName:
        "DIAMOND_SCHOOL",

      pricePerTerm: 400000,

      pricePerSession: 1000000,

      maxStudents: 250,

      videoLessonLimit: null,
      homeHelperLimit: null,

      canTakeTest: true,
      canPracticeForQuiz: true,
      canPracticeForExam: true,
      canChatWithLearningAssistant: true,
      canPlayCardGame: true,
      canSpeakWithTeacher: true,
      canPlaySpeedChallange: true,
      canPlayMillionaire: true,
      canPartakeInLeaderboardRanking: true,
      canDownloadOfflineContent: true,
    },


    {
      subscriptionPlanName:
        "GOLD_SCHOOL",

      pricePerTerm: 700000,

      pricePerSession: 1500000,

      maxStudents: 500,

      videoLessonLimit: null,
      homeHelperLimit: null,

      canTakeTest: true,
      canPracticeForQuiz: true,
      canPracticeForExam: true,
      canChatWithLearningAssistant: true,
      canPlayCardGame: true,
      canSpeakWithTeacher: true,
      canPlaySpeedChallange: true,
      canPlayMillionaire: true,
      canPartakeInLeaderboardRanking: true,
      canDownloadOfflineContent: true,
    },
  ];


   for (const plan of plans) {
        await db.subscriptionPlan.upsert({
            where: {
                subscriptionPlanName:
                    plan.subscriptionPlanName,
            },
            update: plan,
            create: plan,
        });
    }

    console.log(
        "✅ Subscription Plans seeded."
    );
}


// main()
//   .catch((error) => {
//     console.error(error);
//     process.exit(1);
//   })
//   .finally(async () => {
//     await db.$disconnect();
//   });
