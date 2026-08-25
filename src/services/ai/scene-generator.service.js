import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MODEL = "gemini-2.5-flash";

function extractJson(raw) {
  if (!raw) return null;

  const match = raw.match(/\{[\s\S]*\}/);

  return match ? match[0] : null;
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function generateSceneContent({
  cacheName,
  scene,
  sceneIndex,
  totalScenes,
  previousSceneTitle,
  previousNarration,
  targetSeconds = 90,
}) {
  const MAX_RETRIES = 5;

  const prompt = `
    Generate Scene ${sceneIndex + 1} of ${totalScenes}.

    Target duration:
    ${targetSeconds} seconds

    ==================================================
    CURRENT SCENE PLAN
    ==================================================

    ${JSON.stringify(scene, null, 2)}

    ==================================================
    PREVIOUS SCENE CONTEXT
    ==================================================

    Previous Scene Title:
    ${previousSceneTitle || "None"}

    Previous Scene Narration:
    ${
      previousNarration
        ? previousNarration.slice(0, 500)
        : "None"
    }

    ==================================================
    SCENE POSITION
    ==================================================

    Current Scene:
    ${sceneIndex + 1}

    Total Scenes:
    ${totalScenes}

    ==================================================
    FINAL INSTRUCTION
    ==================================================

    Generate this scene according to all cached instructions.

    Return ONLY valid JSON.
  `;

  for (
    let attempt = 0;
    attempt <= MAX_RETRIES;
    attempt++
  ) {
    try {
      const result =
        await ai.models.generateContent({
          model: MODEL,
          contents: prompt,
          config: {
            cachedContent: cacheName,
            temperature: 0.4,
            responseMimeType:
              "application/json",
          },
        });

      // console.log(
      //   "📊 Scene generation Gemini usage:",
      //   result.usageMetadata
      // );

      const raw = result.text || "";

      const jsonString =
        extractJson(raw);

      if (!jsonString) {
        throw new Error(
          "No valid JSON found"
        );
      }

      let parsed;

      try {
        parsed = JSON.parse(jsonString);
      } catch {
        console.log(
          "FAILED JSON:",
          jsonString
        );

        throw new Error(
          "JSON parse failed"
        );
      }

      if (
        !parsed?.title ||
        !parsed?.theme ||
        !Array.isArray(parsed?.keywords) ||
        !parsed?.narration ||
        !Array.isArray(parsed?.blocks)
      ) {
        throw new Error(
          "Invalid structure returned"
        );
      }

      if (!parsed.durationInFrames) {
        parsed.durationInFrames = 300;
      }

      return parsed;

    } catch (error) {
      console.error(
        `Scene attempt ${
          attempt + 1
        } failed:`,
        error.message
      );

      if (
        error.message?.includes("429")
      ) {
        await sleep(45000);
      }

      if (
        attempt === MAX_RETRIES
      ) {
        throw new Error(
          "Scene generation failed after retries"
        );
      }

      await sleep(5000);
    }
  }
}



// import { GoogleGenAI } from "@google/genai";

// const ai = new GoogleGenAI({
//   apiKey: process.env.GEMINI_API_KEY,
// });

// function extractJson(raw) {
//   if (!raw) return null;

//   const match = raw.match(
//     /\{[\s\S]*\}/
//   );

//   if (!match) {
//     return null;
//   }

//   return match[0];
// }

// function sleep(ms) {
//   return new Promise((resolve) =>
//     setTimeout(resolve, ms)
//   );
// }

// export async function generateSceneContent({
//   subject,
//   topic,
//   classLevel,
//   scene,
//   sceneIndex,
//   totalScenes,
//   previousSceneTitle,
//   previousNarration,
//   targetSeconds = 90,
// }) {
//   const MAX_RETRIES = 5;

//   for (
//     let attempt = 0;
//     attempt <= MAX_RETRIES;
//     attempt++
//   ) {
//     try {
//       const prompt = `
//         You are generating ONE educational video scene for a Remotion renderer.

//         Return ONLY valid JSON.

//         ==================================================
//         CONTEXT
//         ==================================================

//         Subject:
//         ${subject}

//         Topic:
//         ${topic}

//         Class Level:
//         ${classLevel}

//         Target duration for this scene: 
//         ${targetSeconds} seconds

//         Scene Plan:
//         ${JSON.stringify(scene, null, 2)}

//         ==================================================
//         SCENE POSITION
//         ==================================================

//         Current Scene:
//         ${sceneIndex + 1}

//         Total Scenes:
//         ${totalScenes}

//         ==================================================
//         NARRATION CONTINUITY RULES
//         ==================================================

//         This lesson is a continuous educational video.

//         ONLY Scene 1 may contain greeting or salutation.

//         If current scene is NOT Scene 1:

//         - Do NOT greet again
//         - Do NOT restart the lesson
//         - Do NOT say:
//           "Hello..."
//           "Hi student..."
//           "Welcome..."
//           "Today we will learn..."

//         Continue naturally from the previous scene.

//         ==================================================
//         PREVIOUS SCENE CONTEXT
//         ==================================================

//         Previous Scene Title:
//         ${previousSceneTitle || "None"}

//         Previous Narration Summary:
//         ${previousNarration
//           ? previousNarration.slice(0, 300)
//           : "None"}

//         ==================================================
//         IMPORTANT
//         ==================================================

//         DO NOT describe visuals in English.

//         DO NOT say:
//         - "show this"
//         - "display this"
//         - "animate this"

//         Instead generate STRUCTURED VISUAL BLOCKS.

//         The output will be rendered directly
//         inside Remotion React components.

//         ${
//           sceneIndex === 0
//             ? `
//         IMPORTANT:
//         You may begin with:
//         "Hello great Mathematician..."
//         `
//             : `
//         IMPORTANT:
//         Do NOT include greeting or salutation.
//         Start immediately with the lesson continuation.
//         `
//         }

//         ==================================================
//         RULES
//         ==================================================

//         - Narration must be educational.
//         - Note that content is for an individual learner so use SINGULAR for salutation not PLURAL.
//         - Do not repeat scene or narration.
//         - Each scene should explain or teach a different concept different from the previous or subsequent ones.
//         - Ensure all mathematical, scientific and historical facts are accurate. Never simplify facts in a way that makes them incorrect.
//         - The narration should naturally fit within approximately ${targetSeconds} seconds.
//         - If the lesson feels too short, DO NOT reduce scenes.
//           Instead:
//           - split explanations into smaller steps
//           - add more examples
//           - add more reinforcement teaching but adapt to class level
//         - Keep explanations simple
//         - Use child or student friendly teaching style based on class ${classLevel}
//         - Teach mathematical calculations, topics or concepts in step by step calculations well written down.
//         - No markdown
//         - No commentary
//         - No SVG
//         - No coordinates
//         - Return ONLY JSON
//         - Blocks must never be empty
//         - Generate at least 2 blocks
//         - Generate at most 6 blocks

//         ==================================================
//         TEXT ROLES
//         ==================================================

//         Every text block must include a role.

//         Allowed roles are:

//         - title
//         - definition
//         - explanation
//         - example
//         - important
//         - instruction
//         - summary
//         - keyword

//         Example:

//         {
//           "type": "text",
//           "role": "definition",
//           "content": "A fraction represents part of a whole."
//         }

//         ==================================================
//         TEXT BLOCK RULES AND LENGTH 
//         ==================================================

//         - Keep each text block concise.
//         - Each text block should contain between 8 and 30 words.
//         - Avoid long paragraphs.
//         - Prefer multiple short blocks over one long block.
//         - Every block should communicate only one key teaching point.

//         IMPORTANT

//         Narration is what the teacher says.

//         Text blocks are what appear on the screen.

//         The text blocks MUST NOT repeat the narration word for word.

//         The narration may explain in detail.

//         The on screen text should contain only:
//         - key ideas
//         - important definitions
//         - formulas
//         - examples
//         - keywords

//         The learner should listen to the narration while reading only concise supporting text.
//         The total number of words across all text blocks in one scene should not exceed 80 words.
//         Do not exceed 100 words of on screen text per scene.


//         ON SCREEN TEXT RULES

//       - On screen text should summarize the narration.
//       - Do not copy the narration.
//       - Keep each text block between 8 and 25 words.
//       - Use bullet style where appropriate instead of paragraphs.
//       - Keep the total on screen text under 80 words per scene.
//       - Prefer educational visual blocks over additional text.
//       - Each text block should teach only one idea.


//         ==================================================
//         SCENE METADATA
//         ==================================================

//         Every scene must include:

//         theme:
//         - The visual presentation theme for the scene.
//         Use ONLY one of the following themes:

//           - mathematics
//           - english
//           - science
//           - biology
//           - chemistry
//           - physics
//           - agriculture
//           - geography
//           - history
//           - government
//           - civicEducation
//           - socialStudies
//           - economics
//           - commerce
//           - accounting
//           - businessStudies
//           - financialAccounting
//           - literature
//           - christianReligiousStudies
//           - islamicReligiousStudies
//           - commercial
//           - computerStudies
//           - informationTechnology
//           - basicTechnology
//           - homeEconomics
//           - culturalAndCreativeArts
//           - visualArts
//           - music
//           - physicalAndHealthEducation

//           Never invent a new theme.

//           Always choose the closest matching theme from the list above.

//         keywords:
//         - Array of the most important educational terms introduced in this scene.
//         - Return between 2 and 6 keywords.
//         - Do not repeat the same keyword.


//         Subject-specific expectations

//         Mathematics
//         Include at least one equation, grouped object, fraction, geometry diagram, or angle diagram whenever applicable.
//         Teach mathematical calculations, topics or concepts in step by step calculations well written down.
//         When teaching multiplication, 
//          For example, 
//           5 * 3 or 5 x 3,
//           Say it as 5 times 3 

//           Don't say:
//           5 cross 3 or 5 asterics 3
        
//         When teaching division,
//           For example,
//           6 / 2 or 6 ÷ 2
//           Say 6 divided by 2

//           Don't say
//           6 slash 2

//         When teaching number system, call digits individually when teaching number bases that are not base 10
//           - For example:

//           Valid
//             11₂ say it as one one base 2
//             101₂ say it is one zero one base 2

//           Invalid
//             11₂ eleven base 2
//             101₂ one hundred and one base 2

//         When teaching Primary School Mathematics of addition, subtraction and multiplication of two, three, four digit numbers, use this format or arrangement below:
//           H T U
//           2 3 4
//         + 4 5 4
//           _____ 

//         Geometry And Construction
//         - Teach topics like geometry, contruction, graphs, shapes, and so on using practical step by step methods to construct them.
        
        
//         Science/Physics/Chemistry/Biology
//         Include one or more images as possible, scientific diagram, timeline, or flowchart, sketches whenever applicable to illustrate topics or concepts.

//         History
//         Prefer timelines and historical images.

//         Geography
//         Prefer maps and labeled diagrams.

//         Accounting
//         Prefer tables, flowcharts, and pie charts.

//         Commerce/Business Studies
//         Prefer flowcharts and comparison tables.

//         Economics
//         Prefer tables, pie charts, and flowcharts.

//         Computer Studies
//         Prefer flowcharts, tables, images and diagrams.

//         English
//         Prefer questions, keyword summaries, and tables.

//         Literature
//         Prefer questions, timelines, and text summaries.

//           Prefer a mix of block types instead of repeating text blocks.

//         Every scene should contain at least one educational visual block whenever the lesson supports it.

//         Examples:

//         Mathematics
//         Prefer:
//         - equation
//         - groupedObjects
//         - fraction
//         - geometryDiagram
//         - angleDiagram

//         Science
//         Prefer:
//         - scientificDiagram
//         - flowchart
//         - timeline
//         - image
        

//         Geography
//         Prefer:
//         - map
//         - timeline
//         - image

//         History
//         Prefer:
//         - timeline
//         - image
//         - flowchart

//         Commerce / Economics / Accounting
//         Prefer:
//         - table
//         - pieChart
//         - flowchart

//         English / Literature
//         Prefer:
//         - text
//         - table
//         - question
//         - timeline

//         Never generate more than three text blocks unless absolutely necessary.

//         Text blocks should complement the narration.

//         Do not simply copy or paraphrase the narration into text blocks.

//         Each text block should summarize or reinforce a key idea in as few words as possible.

//         Whenever a concept can be better explained using a diagram, prefer the corresponding diagram block over plain text.

//         Avoid repeating the same block type multiple times.

//         Whenever possible, every scene should contain at least two different block types.


//         ==================================================
//         FIELD REQUIREMENTS
//         ==================================================

//           theme

//           - Must be exactly one value from the approved theme list.
//           - Never invent a new theme.

//           keywords

//           - Return between 2 and 6 important educational terms introduced in this scene.
//           - These keywords will be highlighted during video rendering.
//           - Do not include duplicate keywords.

//           Return 3 to 6 keywords.

//           Keywords should be important concepts, not ordinary words.

//           Use nouns or short educational phrases.

//           Examples:
//           - Photosynthesis
//           - Chlorophyll
//           - Whole Numbers
//           - Debit Entry
//           - Democracy

//           Do not include greetings or generic words such as "lesson", "student", "learning", "today", or "example".


//         ==================================================
//         BLOCK SELECTION RULES
//         ==================================================

//         The purpose of blocks is to visually teach the lesson, not merely repeat the narration.

//         Every scene should combine explanatory text with educational visual blocks whenever appropriate.

//         Do NOT generate scenes made entirely of text unless the topic genuinely cannot be visualized.

        // ==================================================
        // SUPPORTED BLOCK TYPES
        // ==================================================

        // 1. text

        // {
        //   "type": "text",
        //   "role": "definition",
        //   "content": "Division means sharing equally."
        // }

        // --------------------------------------------------

        // 2. equation

        // {
        //   "type": "equation",
        //   "equation": "12 ÷ 6 = 2"
        // }

        // --------------------------------------------------

        // 3. groupedObjects

        //   Use groupedObjects whenever teaching counting, grouping, multiplication, division, fractions, sets, comparisons, or any concept involving visible objects.

        //   IMPORTANT

        //   The "object" field MUST contain the actual Unicode emoji character.

        //   Never use the English word.

        //   Correct examples:

        //   {
        //     "type": "groupedObjects",
        //     "object": "🍎",
        //     "total": 12,
        //     "groups": 6
        //   }

        //   {
        //     "type": "groupedObjects",
        //     "object": "⭐",
        //     "total": 10,
        //     "groups": 2
        //   }

        //   {
        //     "type": "groupedObjects",
        //     "object": "🚗",
        //     "total": 4,
        //     "groups": 2
        //   }

        //   {
        //     "type": "groupedObjects",
        //     "object": "🐟",
        //     "total": 8,
        //     "groups": 4
        //   }

        //   Never return:

        //   "apple"
        //   "star"
        //   "fish"
        //   "car"

        //   Always return the corresponding Unicode emoji whenever one exists.

        //   The object field must contain exactly one Unicode emoji character whenever a suitable emoji exists.

        //   Examples:

        //   🍎
        //   ⭐
        //   🐘
        //   🚗
        //   🌳
        //   ⚽

        //   Never use words such as:

        //   apple
        //   star
        //   car
        //   tree
        //   fish
        //   dog

        // --------------------------------------------------

        // 4. question

        // {
        //   "type": "question",
        //   "question": "What is 18 ÷ 6?"
        // }

        // --------------------------------------------------

        // 5. image

        // Use an image block only when the concept cannot be effectively illustrated using equations, groupedObjects, diagrams, charts, maps, timelines, or text.
        
        //   Examples:

        //   • Historical people
        //   • National flags
        //   • Famous landmarks
        //   • Animals without suitable emoji
        //   • Complex scientific structures

        // {
        //   "type": "image",
        //   "prompt":
        //     "cartoon clock showing 3 o'clock"
        // }

        // --------------------------------------------------

        // 6. clock

        //   Use this block whenever the lesson involves reading time, telling time, clock arithmetic, elapsed time, schedules, or time-related examples.

        //   Prefer a clock block over plain text whenever learners benefit from seeing an analogue clock.

        //   Use this block for subjects such as:

        //   • Mathematics
        //   • Basic Science
        //   • Civic Education
        //   • Social Studies

        //   The clock uses a 12-hour analogue clock.

        //   The hour must be an integer from 1 to 12.

        //   The minute must be an integer from 0 to 59.

        //   Examples

        //   Three o'clock

        //   {
        //     "type": "clock",
        //     "hour": 3,
        //     "minute": 0
        //   }

        //   Half past six

        //   {
        //     "type": "clock",
        //     "hour": 6,
        //     "minute": 30
        //   }

        //   Quarter past nine

        //   {
        //     "type": "clock",
        //     "hour": 9,
        //     "minute": 15
        //   }

        //   Quarter to five

        //   {
        //     "type": "clock",
        //     "hour": 4,
        //     "minute": 45
        //   }

        //   Five minutes past ten

        //   {
        //     "type": "clock",
        //     "hour": 10,
        //     "minute": 5
        //   }

        //   Optional label

        //   {
        //     "type": "clock",
        //     "hour": 8,
        //     "minute": 20,
        //     "label": "School starts at 8:20 AM"
        //   }

        //   Clock Rules

        //   • Use only integer values.
        //   • Hour must be between 1 and 12.
        //   • Minute must be between 0 and 59.
        //   • Do not use decimal values.
        //   • Do not use text such as "half past" or "quarter to" in the hour or minute fields.
        //   • Use the label only when additional context helps the learner.
        //   • Prefer a clock block instead of describing the time in narration when the time should be visualized.

        //   Correct

        //   {
        //     "type": "clock",
        //     "hour": 2,
        //     "minute": 45
        //   }

        //   Incorrect

        //   {
        //     "type": "text",
        //     "content": "The clock shows quarter to three."
        //   }

        //   Incorrect

        //   {
        //     "type": "clock",
        //     "hour": "quarter",
        //     "minute": "to three"
        //   }

        //   Whenever a lesson requires learners to read or interpret an analogue clock, always generate a clock block.

        // --------------------------------------------------

        // 7. fraction

        //   Use this block whenever a mathematical expression represents one quantity divided by another.

        //   Always use a fraction block for ratios, fractions, formulas, and expressions that place one quantity over another.

        //   Do NOT generate these as equation blocks.

        //   Do NOT use LaTeX.

        //   Never generate:

        //   \frac{...}{...}

        //   Never return fractions as plain text.

        //   Instead, always return a fraction block.

        //   The numerator and denominator may contain:

        //   • numbers
        //   • variables
        //   • mathematical symbols
        //   • short words or phrases

        //   Examples

        //   Numbers

        //   {
        //     "type": "fraction",
        //     "numerator": "3",
        //     "denominator": "4"
        //   }

        //   Words

        //   {
        //     "type": "fraction",
        //     "numerator": "Force",
        //     "denominator": "Area"
        //   }

        //   Formula

        //   {
        //     "type": "fraction",
        //     "left": "VR =",
        //     "numerator": "Distance moved by Effort (DE)",
        //     "denominator": "Distance moved by Load (DL)"
        //   }

        //   Another Formula

        //   {
        //     "type": "fraction",
        //     "left": "Density =",
        //     "numerator": "Mass",
        //     "denominator": "Volume"
        //   }

        //   Optional fields

        //   {
        //     "type": "fraction",
        //     "left": "Pressure =",
        //     "numerator": "Force",
        //     "denominator": "Area",
        //     "label": "Pressure Formula"
        //   }

        //   Correct

        //   {
        //     "type": "fraction",
        //     "left": "VR =",
        //     "numerator": "Distance moved by Effort (DE)",
        //     "denominator": "Distance moved by Load (DL)"
        //   }

        //   Incorrect

        //   {
        //     "type": "equation",
        //     "equation": "VR = \\frac{Distance moved by Effort}{Distance moved by Load}"
        //   }

        //   Whenever any mathematical formula contains a fraction, ratio, or one quantity divided by another, ALWAYS generate a fraction block.
        // --------------------------------------------------

        // 8. timeline

        //   Use a timeline whenever the lesson explains events, stages, processes, life cycles, historical periods, chronological order, or step by step development.

        //   Prefer a timeline over plain text whenever learners benefit from seeing the order of events.

        //   Use timelines for subjects such as:

        //   • History
        //   • Biology
        //   • Agriculture
        //   • Geography
        //   • Civic Education
        //   • Government
        //   • Literature
        //   • Economics
        //   • Computer Studies
        //   • Science

        //   Examples

        //   Life Cycle

        //   {
        //     "type": "timeline",
        //     "title": "Plant Life Cycle",
        //     "items": [
        //       "Seed",
        //       "Germination",
        //       "Seedling",
        //       "Mature Plant",
        //       "Flower",
        //       "Fruit"
        //     ]
        //   }

        //   Historical Timeline

        //   {
        //     "type": "timeline",
        //     "title": "Nigeria's Independence",
        //     "items": [
        //       "Colonial Rule",
        //       "Nationalist Movement",
        //       "1957 Constitutional Talks",
        //       "1960 Independence"
        //     ]
        //   }

        //   Scientific Process

        //   {
        //     "type": "timeline",
        //     "title": "Water Cycle",
        //     "items": [
        //       "Evaporation",
        //       "Condensation",
        //       "Precipitation",
        //       "Collection"
        //     ]
        //   }

        //   Computer Process

        //   {
        //     "type": "timeline",
        //     "title": "Program Execution",
        //     "items": [
        //       "Input",
        //       "Processing",
        //       "Storage",
        //       "Output"
        //     ]
        //   }

        //   Timeline Rules

        //   • Include between 3 and 8 items.
        //   • Keep each item short.
        //   • Each item should describe one stage or event.
        //   • Maintain correct chronological order.
        //   • Do not repeat items.
        //   • Use concise educational wording.
        //   • Prefer nouns or short phrases instead of sentences.
        //   • Include a title whenever it improves understanding.

        //   Never use a timeline for concepts that have no natural sequence.

        //   Incorrect

        //   {
        //     "type": "timeline",
        //     "items": [
        //       "Dog",
        //       "Cat",
        //       "Bird"
        //     ]
        //   }

        //   Correct

        //   {
        //     "type": "timeline",
        //     "title": "Life Cycle of a Butterfly",
        //     "items": [
        //       "Egg",
        //       "Larva",
        //       "Pupa",
        //       "Adult Butterfly"
        //     ]
        //   }

        // 9. geometryDiagram

        // Used for geometry, triangles, quadrilaterals, angles,
        // parallel lines, circles and constructions,
        // Geometric diagrams should be considerably big enough, but not too big or small but perfect for the screen size to be seen by the student.

        // {
        //   "type":"geometryDiagram",
        //   "width":600,
        //   "height":400,
        //   "shapes":[
        //     {
        //       "type":"line",
        //       "x1":100,
        //       "y1":80,
        //       "x2":300,
        //       "y2":250,
        //       "strokeWidth":4,
        //       "color":"#111"
        //     },
        //     {
        //       "type":"polygon",
        //       "points":[
        //         {"x":100,"y":300},
        //         {"x":300,"y":300},
        //         {"x":200,"y":100}
        //       ]
        //     },
        //     {
        //       "type":"circle",
        //       "cx":250,
        //       "cy":180,
        //       "r":60
        //     },
        //     {
        //       "type":"arc",
        //       "path":"M..."
        //     }
        //   ],
        //   "labels":[
        //     {
        //       "text":"A",
        //       "x":100,
        //       "y":70
        //     }
        //   ]
        // }

        // Allowed shape types

        // line

        // {
        // "type":"line",
        // "x1":0,
        // "y1":0,
        // "x2":100,
        // "y2":100,
        // "strokeWidth":4,
        // "color":"#111"
        // }

        // circle

        // {
        // "type":"circle",
        // "cx":200,
        // "cy":150,
        // "r":60,
        // "fill":"transparent",
        // "stroke":"#111"
        // }

        // ellipse

        // {
        // "type":"ellipse",
        // "cx":200,
        // "cy":150,
        // "rx":70,
        // "ry":40
        // }

        // rect

        // {
        // "type":"rect",
        // "x":50,
        // "y":50,
        // "width":200,
        // "height":100
        // }

        // polygon

        // {
        // "type":"polygon",
        // "points":[
        // {"x":0,"y":0},
        // {"x":100,"y":0},
        // {"x":50,"y":80}
        // ]
        // }

        // path

        // {
        // "type":"path",
        // "d":"M..."
        // }

        // arc

        // {
        // "type":"arc",
        // "path":"M..."
        // }

        // 10. scientificDiagram
        // Scientific diagrams should be considerably big enough, but not too big or small but perfect for the screen size to be seen by the student,
        // A scientificDiagram should normally contain between 2 and 8 shapes and no more than 6 labels unless the lesson absolutely requires more.

        // Use for:

        //   • Physics
        //   • Chemistry
        //   • Biology
        //   • Basic Science
        //   • Agriculture
        //   • Computer hardware

        //   Return:

        //   {
        //     "type":"scientificDiagram",
        //     "width":700,
        //     "height":500,
        //     "shapes":[
        //       {
        //         "type":"circle",
        //         "cx":150,
        //         "cy":250,
        //         "r":45,
        //         "fill":"white",
        //         "stroke":"#111"
        //       },
        //       {
        //         "type":"ellipse",
        //         "cx":300,
        //         "cy":180,
        //         "rx":80,
        //         "ry":45
        //       },
        //       {
        //         "type":"rect",
        //         "x":400,
        //         "y":120,
        //         "width":120,
        //         "height":90
        //       },
        //       {
        //         "type":"line",
        //         "x1":150,
        //         "y1":250,
        //         "x2":300,
        //         "y2":180
        //       },
        //       {
        //         "type":"path",
        //         "d":"M..."
        //       }
        //     ],
        //     "labels":[
        //       {
        //         "text":"Light",
        //         "x":200,
        //         "y":100
        //       }
        //     ]
        //   }

        //   11. angleDiagram

        //     Use whenever an angle is the main teaching concept.

        //     {
        //       "type":"angleDiagram",
        //       "angle":60,
        //       "label":"θ"
        //     }

        //   12. flowChart

        //     Use for processes, algorithms and life cycles.

        //     {
        //       "type":"flowChart",
        //       "title":"Water Cycle",
        //       "nodes":[
        //         {
        //           "id":"1",
        //           "text":"Evaporation"
        //         },
        //         {
        //           "id":"2",
        //           "text":"Condensation"
        //         },
        //         {
        //           "id":"3",
        //           "text":"Rainfall"
        //         }
        //       ]
        //     }

        //   13. chart

        //     Use whenever numerical values should be compared.

        //     {
        //       "type":"chart",
        //       "title":"Rainfall",
        //       "data":[
        //         {
        //           "label":"Jan",
        //           "value":30
        //         },
        //         {
        //           "label":"Feb",
        //           "value":45
        //         }
        //       ]
        //     }

        //     14. pieChart

        //       Use when showing proportions.

        //       {
        //         "type":"pieChart",
        //         "title":"Budget",
        //         "data":[
        //           {
        //             "label":"Food",
        //             "value":40
        //           },
        //           {
        //             "label":"Transport",
        //             "value":20
        //           },
        //           {
        //             "label":"Savings",
        //             "value":40
        //           }
        //         ]
        //       }

        //     15. table

        //       {
        //         "type":"table",
        //         "title":"Comparison",
        //         "headers":[
        //           "Solid",
        //           "Liquid"
        //         ],
        //           "rows":[
        //             [
        //               "Fixed shape",
        //               "No fixed shape"
        //             ],
        //             [
        //               "Strong forces",
        //               "Weaker forces"
        //             ]
        //           ]
        //         }

        //     16. map

        //       {
        //         "type":"map",
        //         "title":"Nigeria",
        //         "imagePrompt":"Political map of Nigeria",
        //         "markers":[
        //           {
        //             "label":"Abuja",
        //             "x":50,
        //             "y":42
        //           }
        //         ]
        //       }

        //     17. vennDiagram

        //       {
        //         "type":"vennDiagram",
        //         "title":"Animals",
        //         "leftTitle":"Mammals",
        //         "rightTitle":"Birds",
        //         "leftItems":[
        //           "Lion"
        //         ],
        //         "overlapItems":[
        //           "Vertebrates"
        //         ],
        //         "rightItems":[
        //           "Eagle"
        //         ]
        //       }

        //     18. image

        //     Use image only if the concept cannot be represented accurately using diagrams, tables, flow charts, geometry diagrams, scientific diagrams, maps or charts.

        //     Prefer scientificDiagram over image whenever the lesson involves physical objects that can be drawn using circles, rectangles, polygons, lines or paths.

        //     19. Choose the most appropriate visual block.

        //       Mathematics
        //       • equation
        //       • fraction
        //       • groupedObjects
        //       • geometryDiagram
        //       • angleDiagram

        //       Physics
        //       • scientificDiagram
        //       • chart
        //       • flowChart
        //       • equation

        //       Examples:
        //       Reflection
        //       → scientificDiagram

        //       Refraction
        //       → scientificDiagram

        //       Electric circuit
        //       → scientificDiagram

        //       Simple machine
        //       → scientificDiagram

        //       Force diagram
        //       → scientificDiagram

        //       Wave
        //       → scientificDiagram

        //       Chemistry

        //       Atoms
        //       → scientificDiagram

        //       Molecules
        //       → scientificDiagram

        //       Laboratory apparatus
        //       → scientificDiagram

        //       Periodic trends
        //       → chart

        //       Reaction process
        //       → flowChart

        //       Biology

        //       Cell
        //       → scientificDiagram

        //       Leaf
        //       → scientificDiagram

        //       Digestive system
        //       → scientificDiagram

        //       Food chain
        //       → flowChart

        //       Classification
        //       → table

        //       Geography

        //       Maps
        //       → map

        //       Climate comparison
        //       → chart

        //       Population
        //       → pieChart

        //       History

        //       Events
        //       → timeline

        //       Empires
        //       → map

        //       Cause and effect
        //       → flowChart

        //       Economics

        //       Statistics
        //       → chart

        //       Market share
        //       → pieChart

        //       Economic process
        //       → flowChart

        //       Computer Studies

        //       Algorithms
        //       → flowChart

        //       Computer parts
        //       → scientificDiagram

        //       Programming concepts
        //       → flowChart

        //       Networking
        //         → scientificDiagram

//         Before returning JSON, verify:

//         ✓ Valid JSON only
//         ✓ No markdown
//         ✓ Narration matches the blocks
//         ✓ Facts are accurate
//         ✓ Theme is valid
//         ✓ Keywords are unique
//         ✓ At least one educational visual block (if appropriate)
//         ✓ At least two different block types
//         ✓ Text blocks are concise
//         ✓ Title contains no greeting

//         ==================================================
//         OUTPUT FORMAT
//         ==================================================

//         {
//           "title": "Example Scene",
//           "theme": "science",
//           "keywords": [
//             "Example",
//             "Concept"
//           ],
//           "narration": "Example narration.",
//           "durationInFrames": 2700,
//           "blocks": [
//             {
//               "type": "text",
//               "role": "definition",
//               "content": "Example supporting text."
//             }
//           ]
//         }

//         `;

//       const result =
//         await ai.models.generateContent({
//           model: "gemini-2.5-flash",

//           contents: prompt,

//           config: {
//             temperature: 0.4,

//             responseMimeType:
//               "application/json",
//           },
//         });

//       const raw =
//         result.text || "";


//       const jsonString =
//         extractJson(raw);

//       if (!jsonString) {
//         throw new Error(
//           "No valid JSON found"
//         );
//       }

//       let parsed;

//       try {
//         parsed =
//           JSON.parse(jsonString);

//       } catch (error) {
//         console.log(
//           "FAILED JSON:",
//           jsonString
//         );

//         throw new Error(
//           "JSON parse failed"
//         );
//       }

//       if (
//         !parsed?.title ||
//         !parsed?.theme ||
//         !Array.isArray(parsed?.keywords) ||
//         !parsed?.narration ||
//         !Array.isArray(parsed?.blocks)
//       ) {
//         throw new Error("Invalid structure returned");
//       }

//       /**
//        * Ensure duration exists
//        */
//       if (
//         !parsed.durationInFrames
//       ) {
//         parsed.durationInFrames = 300;
//       }

//       return parsed;

//     } catch (error) {
//       console.error(
//         `Scene attempt ${
//           attempt + 1
//         } failed:`,
//         error.message
//       );

//       /**
//        * Rate limit handling
//        */
//       if (
//         error.message?.includes(
//           "429"
//         )
//       ) {
//         console.log(
//           "Rate limit - Scene generator. Retrying..."
//         );

//         await sleep(45000);
//       }

//       /**
//        * Final failure
//        */
//       if (
//         attempt === MAX_RETRIES
//       ) {
//         throw new Error(
//           "Scene generation failed after retries"
//         );
//       }

//       /**
//        * General retry delay
//        */
//       await sleep(5000);
//     }
//   }
// }
