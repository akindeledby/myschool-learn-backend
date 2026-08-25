export const lessonPlanFunctionSchema = {
  type: "object",

  properties: {
    title: {
      type: "string",
    },

    scenes: {
      type: "array",

      items: {
        type: "object",

        properties: {
          sceneType: {
            type: "string",
          },

          title: {
            type: "string",
          },
        },

        required: [
          "sceneType",
          "title",
        ],
      },
    },
  },

  required: [
    "title",
    "scenes",
  ],
};