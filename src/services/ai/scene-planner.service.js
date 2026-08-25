import { buildLessonPlanningInstructions } from "./lesson-planning-instructions.js";

export function buildLessonPlanningContext({
  subject,
  topic,
  lessonContents,
  classLevel,
  targetSeconds = 90,
  targetMinutes = 30,
}) {
  const instructions =
    buildLessonPlanningInstructions();

  const lessonContext = `
    ==================================================
    LESSON INFORMATION
    ==================================================

    Subject:
    ${subject || "General"}

    Topic:
    ${topic || "Untitled Topic"}

    Class Level:
    ${classLevel || "Unknown"}

    ==================================================
    LESSON CONTENTS
    ==================================================

    ${JSON.stringify(
      lessonContents || [],
      null,
      2
    )}

    ==================================================
    TARGET VIDEO LENGTH
    ==================================================

    Total target video duration:

    ${targetMinutes} minutes

    At 30fps this equals:

    ${targetMinutes * 60 * 30} frames.

    Each scene should target approximately:

    ${targetSeconds} seconds.

    ==================================================
    TASK
    ==================================================

    Create the lesson plan for this specific lesson according to the
    lesson planning instructions provided above.

    The lesson plan must be based specifically on the supplied:

    Subject
    Topic
    Class Level
    Lesson Contents

    Return ONLY valid JSON.
    `;

  return {
    instructions,
    lessonContext,
  };
}

// export function buildScenePlanningPrompt({
//   subject,
//   topic,
//   lessonContents,
//   classLevel,
//   targetSeconds = 90,
//   targetMinutes = 30
// }) {
//   return `
//       You are an expert Nigerian educational curriculum planner and instructional designer.

//       Your task is to create a structured educational lesson plan for AI-generated animated video lessons.

//       The output will later be used for:

//       - AI narration generation
//       - Excalidraw whiteboard rendering
//       - Remotion animation rendering
//       - FFmpeg video generation
//       - HLS streaming delivery

//       You are ONLY responsible for generating:

//       1. Lesson structure
//       2. Teaching flow
//       3. Scene sequencing
//       4. Scene titles
//       5. Scene purposes

//       Do NOT generate:

//       - Full narration
//       - SVG
//       - Coordinates
//       - Animation code
//       - Visual positioning
//       - Camera instructions
//       - Markdown
//       - Explanations outside JSON

//       ==================================================
//       STUDENT INFORMATION
//       ==================================================

//       Subject:
//       ${subject || "General"}

//       Topic:
//       ${topic || "Untitled Topic"}

//       Class Level:
//       ${classLevel || "Unknown"}

//       ==================================================
//       LESSON CONTENTS
//       ==================================================

//       ${JSON.stringify(lessonContents || [], null, 2)}

//       ==================================================
//       TARGET VIDEO LENGTH
//       ==================================================

//       This lesson must be designed for a TOTAL VIDEO DURATION of:
//       ${targetMinutes} minutes

//       You must plan scenes accordingly.

//       At 30fps this equals:
//       ${targetMinutes * 60 * 30} frames total video length


//       ==================================================
//       LESSON PLANNING RULES
//       ==================================================

//       - Focus ONLY on lesson structure
//       - Break the lesson into logical teaching scenes.
//       - Scenes titles should be meaningful must follow progressive learning flow.
//       - Note that content is for an individual learner so use SINGULAR for salutation not PLURAL.
//       - Use salutation in the first scene only, for example, Say Hello great Mathematician in the first scene i.e scene 1, but dont repeat that in the subsequent scene generated.
//       - Start from simple concepts before advanced concepts.
//       - Keep scenes educational and visualizable.
//       - Do not repeat scene.
//       - Use age-appropriate teaching structure.
//       - Ensure smooth scene transitions.
//       - Focus on educational clarity and retention.
//       - Scenes should feel like a real teacher explaining concepts.
//       - Scene titles must be short and descriptive.
//       - sceneType must describe the educational role of the scene.


//       ==================================================
//       FIELD RULES
//       ==================================================

//       title:
//       - Overall lesson title

//       scenes:
//       - Array of lesson scenes

//       sceneType:
//       - Educational purpose of the scene
//       - Examples:
//         introduction
//         definition
//         explanation
//         example
//         comparison
//         classwork
//         recap
//         summary
//         quiz

//       title:
//       - Short descriptive scene title

//       ==================================================
//       PRACTICE QUESTION RULE
//       ==================================================

//       - There must be at least three or more practice questions, classwork or quiz for the student to solve.
//       - The questions must be from simpler to harder questions.

//       ==================================================
//       SCENE DEPTH RULE
//       ==================================================

//       Each scene must include ONE OR MORE of the following:

//       - explanation
//       - worked example
//       - visual breakdown
//       - practice question
//       - recap reinforcement


//       NEVER combine multiple of these in one scene.


//       ==================================================
//       SCENE COUNT REQUIREMENT
//       ==================================================

//       You MUST generate between:

//       - Maximum: 15 scenes

//       Each scene represents a SMALL teaching step.

//       Do NOT merge multiple concepts into one scene.

//       ==================================================
//       VISUALIZATION RULES
//       ==================================================

//       Every scene must be suitable for:

//       - Remotion rendering
//       - Hand-drawn educational visuals
//       - Minimal and relevant educational diagrams
//       - Labels and arrows
//       - Simple educational storytelling

//       Do NOT generate:

//       - Coordinates
//       - SVG
//       - CSS
//       - HTML
//       - Animation code
//       - Pixel positioning
//       - Rendering instructions

//       ==================================================
//       STRICT OUTPUT RULES
//       ==================================================

//       - Return ONLY valid JSON
//       - No markdown
//       - No code blocks
//       - No explanations
//       - No commentary
//       - No extra text
//       - No trailing commas

//       ==================================================
//       STRICT JSON SCHEMA
//       ==================================================

//       {
//         "title": string,
//         "scenes": [
//           {
//             "sceneType": string,
//             "title": string,
//             "targetSeconds": ${targetSeconds}
//           }
//         ]
//       }

//       ==================================================
//       IMPORTANT
//       ==================================================

//       The scenes generated here will later be expanded
//       individually by another AI system into:

//       - narration
//       - visual instructions
//       - animations
//       - audio timing
//       - rendered video scenes

//       `
//   ;
// }