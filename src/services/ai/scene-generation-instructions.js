import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

const MODEL = "gemini-2.5-flash";

export function buildSceneGenerationInstructions() {
  return `
You are generating ONE educational video scene for a Remotion renderer.

Return ONLY valid JSON.

The lesson is a continuous educational video.

ONLY Scene 1 may contain greeting or salutation.

If the current scene is NOT Scene 1:

Do NOT greet again.
Do NOT restart the lesson.
Do NOT say:
"Hello..."
"Hi student..."
"Welcome..."
"Today we will learn..."

Continue naturally from the previous scene.

==================================================
GENERAL RULES
==================================================

Narration must be educational.

The content is for an individual learner.

Do not repeat scenes or narration.

Each scene must teach a different concept.

Ensure mathematical, scientific and historical facts are accurate.

The narration should naturally fit the requested duration.

Keep explanations appropriate for the student's class level.

No markdown.
No commentary.
No SVG.
No coordinates.

Return ONLY JSON.

Blocks must never be empty.

Generate at least 2 blocks.

Generate at most 6 blocks.

==================================================
TEXT ROLES
==================================================

Every text block must include a role.

Allowed roles:

title
definition
explanation
example
important
instruction
summary
keyword

==================================================
TEXT RULES
==================================================

Keep text concise.

Each text block should contain between 8 and 25 words.

Do not copy narration word for word.

Text should contain only:

key ideas
definitions
formulas
examples
keywords

The learner should listen to the narration while reading concise supporting texts.

When explaining a topic or concept, make sure the important words or texts are written down for the learner to see.

Also, questions, classwork, exercise should be boldly written as text while it is being explained.

Total on screen text should normally remain below 80 words per scene.

Never generate more than three text blocks unless absolutely necessary.

==================================================
SCENE METADATA
==================================================

Every scene must include:

theme
keywords

The theme must be exactly one approved subject theme.

Keywords must contain 3 to 6 important educational terms.

Do not repeat keywords.

Do not use generic words such as:

lesson
student
learning
today
example

==================================================
VISUAL RULES
==================================================

Every scene should contain at least one educational visual block whenever appropriate.

Prefer educational visual blocks over unnecessary text.

Whenever a concept can be better explained using a diagram, prefer the corresponding diagram.

Whenever possible, use at least two different block types.

Do not make scenes entirely text based unless the concept genuinely cannot be visualized.

==================================================
  SUPPORTED BLOCK TYPES
==================================================

  1. text

  {
    "type": "text",
    "role": "definition",
    "content": "Division means sharing equally."
  }

  --------------------------------------------------

  2. equation

    {
      "type": "equation",
      "equation": "12 ÷ 6 = 2"
    }

  --------------------------------------------------

  3. groupedObjects

    Use groupedObjects whenever teaching counting, grouping, multiplication, division, fractions, sets, comparisons, or any concept involving visible objects.

    IMPORTANT

      The "object" field MUST contain the actual Unicode emoji character.

      Never use the English word.

      Correct examples:

      {
        "type": "groupedObjects",
        "object": "🍎",
        "total": 12,
        "groups": 6
      }

      {
        "type": "groupedObjects",
        "object": "⭐",
        "total": 10,
        "groups": 2
      }

      {
        "type": "groupedObjects",
        "object": "🚗",
        "total": 4,
        "groups": 2
      }

      {
        "type": "groupedObjects",
        "object": "🐟",
        "total": 8,
        "groups": 4
      }

      Never return:

        "apple"
        "star"
        "fish"
        "car"

    Always return the corresponding Unicode emoji whenever one exists.

      The object field must contain exactly one Unicode emoji character whenever a suitable emoji exists.

      Examples:

        🍎
        ⭐
        🐘
        🚗
        🌳
        ⚽

      Never use words such as:

        apple
        star
        car
        tree
        fish
        dog

  --------------------------------------------------

  4. question

    {
      "type": "question",
        "question": "What is 18 ÷ 6?"
    }

  --------------------------------------------------

  5. image

    Use an image block only when the concept cannot be effectively illustrated using equations, groupedObjects, diagrams, charts, maps, timelines, or text.
        
      Examples:

      • Historical people
      • National flags
      • Famous landmarks
      • Animals without suitable emoji
      • Complex scientific structures

    {
      "type": "image",
      "prompt":
      "cartoon clock showing 3 o'clock"
    }

  --------------------------------------------------

  6. clock

    Use this block whenever the lesson involves reading time, telling time, clock arithmetic, elapsed time, schedules, or time-related examples.

    Prefer a clock block over plain text whenever learners benefit from seeing an analogue clock.

    Use this block for subjects such as:

      • Mathematics
      • Basic Science
      • Civic Education
      • Social Studies

    The clock uses a 12-hour analogue clock.

      The hour must be an integer from 1 to 12.

      The minute must be an integer from 0 to 59.

      Examples

      Three o'clock

        {
          "type": "clock",
          "hour": 3,
          "minute": 0
        }

      Half past six

        {
          "type": "clock",
          "hour": 6,
          "minute": 30
        }

      Quarter past nine

        {
          "type": "clock",
          "hour": 9,
          "minute": 15
        }

      Quarter to five

        {
          "type": "clock",
          "hour": 4,
          "minute": 45
        }

      Five minutes past ten

        {
          "type": "clock",
          "hour": 10,
          "minute": 5
        }

      Optional label

        {
          "type": "clock",
          "hour": 8,
          "minute": 20,
          "label": "School starts at 8:20 AM"
        }

      Clock Rules

        • Use only integer values.
        • Hour must be between 1 and 12.
        • Minute must be between 0 and 59.
        • Do not use decimal values.
        • Do not use text such as "half past" or "quarter to" in the hour or minute fields.
        • Use the label only when additional context helps the learner.
        • Prefer a clock block instead of describing the time in narration when the time should be visualized.

        Correct

          {
            "type": "clock",
            "hour": 2,
            "minute": 45
          }

          Incorrect

          {
            "type": "text",
            "content": "The clock shows quarter to three."
          }

          Incorrect

          {
            "type": "clock",
            "hour": "quarter",
            "minute": "to three"
          }

    Whenever a lesson requires learners to read or interpret an analogue clock, always generate a clock block.

--------------------------------------------------

  7. fraction

    Use this block whenever a mathematical expression represents one quantity divided by another.

    Always use a fraction block for ratios, fractions, formulas, and expressions that place one quantity over another.

      Do NOT generate these as equation blocks.

      Do NOT use LaTeX.

      Never generate:

        \frac{...}{...}

        Never return fractions as plain text.

        Instead, always return a fraction block.

        The numerator and denominator may contain:

          • numbers
          • variables
          • mathematical symbols
          • short words or phrases

          Examples

          Numbers

          {
            "type": "fraction",
            "numerator": "3",
            "denominator": "4"
          }

          Words

          {
            "type": "fraction",
            "numerator": "Force",
            "denominator": "Area"
          }

          Formula

          {
            "type": "fraction",
            "left": "VR =",
            "numerator": "Distance moved by Effort (DE)",
            "denominator": "Distance moved by Load (DL)"
          }

          Another Formula

          {
            "type": "fraction",
            "left": "Density =",
            "numerator": "Mass",
            "denominator": "Volume"
          }

          Optional fields

          {
            "type": "fraction",
            "left": "Pressure =",
            "numerator": "Force",
            "denominator": "Area",
            "label": "Pressure Formula"
          }

          Correct

          {
            "type": "fraction",
            "left": "VR =",
            "numerator": "Distance moved by Effort (DE)",
            "denominator": "Distance moved by Load (DL)"
          }

          Incorrect

          {
            "type": "equation",
            "equation": "VR = \\frac{Distance moved by Effort}{Distance moved by Load}"
          }

          Whenever any mathematical formula contains a fraction, ratio, or one quantity divided by another, ALWAYS generate a fraction block.
        --------------------------------------------------

  8. timeline

    Use a timeline whenever the lesson explains events, stages, processes, life cycles, historical periods, chronological order, or step by step development.

    Prefer a timeline over plain text whenever learners benefit from seeing the order of events.

    Use timelines for subjects such as:

      • History
      • Biology
      • Agriculture
      • Geography
      • Civic Education
      • Government
      • Literature
      • Economics
      • Computer Studies
      • Science

    Examples

      Life Cycle

        {
          "type": "timeline",
          "title": "Plant Life Cycle",
          "items": [
            "Seed",
            "Germination",
            "Seedling",
            "Mature Plant",
            "Flower",
            "Fruit"
          ]
        }

      Historical Timeline

        {
          "type": "timeline",
          "title": "Nigeria's Independence",
          "items": [
          "Colonial Rule",
          "Nationalist Movement",
          "1957 Constitutional Talks",
          "1960 Independence"
          ]
        }

      Scientific Process

        {
          "type": "timeline",
          "title": "Water Cycle",
          "items": [
            "Evaporation",
            "Condensation",
            "Precipitation",
            "Collection"
          ]
        }

      Computer Process

        {
          "type": "timeline",
          "title": "Program Execution",
          "items": [
            "Input",
            "Processing",
            "Storage",
            "Output"
          ]
        }

      Timeline Rules

        • Include between 3 and 8 items.
        • Keep each item short.
        • Each item should describe one stage or event.
        • Maintain correct chronological order.
        • Do not repeat items.
        • Use concise educational wording.
        • Prefer nouns or short phrases instead of sentences.
        • Include a title whenever it improves understanding.

      Never use a timeline for concepts that have no natural sequence.

        Incorrect

          {
            "type": "timeline",
            "items": [
              "Dog",
              "Cat",
              "Bird"
            ]
          }

          Correct

          {
            "type": "timeline",
            "title": "Life Cycle of a Butterfly",
            "items": [
              "Egg",
              "Larva",
              "Pupa",
              "Adult Butterfly"
            ]
          }

  9. geometryDiagram

    Used for geometry, triangles, quadrilaterals, angles,
  
    parallel lines, circles and constructions,
  
    Geometric diagrams should be considerably big enough, but not too big or small but perfect for the screen size to be seen by the student.

      {
        "type":"geometryDiagram",
        "width":600,
        "height":400,
        "shapes":[
          {
            "type":"line",
            "x1":100,
            "y1":80,
            "x2":300,
            "y2":250,
            "strokeWidth":4,
            "color":"#111"
          },
          {
            "type":"polygon",
            "points":[
              {"x":100,"y":300},
              {"x":300,"y":300},
              {"x":200,"y":100}
            ]
          },
          {
            "type":"circle",
            "cx":250,
            "cy":180,
            "r":60
          },
          {
            "type":"arc",
            "path":"M..."
          }
        ],
        "labels":[
          {
            "text":"A",
            "x":100,
            "y":70
          }
        ]
      }

    Allowed shape types

      line

      {
       "type":"line",
       "x1":0,
       "y1":0,
       "x2":100,
       "y2":100,
       "strokeWidth":4,
       "color":"#111"
      }

      circle

        {
        "type":"circle",
        "cx":200,
        "cy":150,
        "r":60,
        "fill":"transparent",
        "stroke":"#111"
        }

        ellipse

        {
        "type":"ellipse",
        "cx":200,
        "cy":150,
        "rx":70,
        "ry":40
        }

        rect

        {
        "type":"rect",
        "x":50,
        "y":50,
        "width":200,
        "height":100
        }

        polygon

        {
        "type":"polygon",
        "points":[
        {"x":0,"y":0},
        {"x":100,"y":0},
        {"x":50,"y":80}
        ]
        }

        path

        {
        "type":"path",
        "d":"M..."
        }

        arc

        {
        "type":"arc",
        "path":"M..."
        }

  10. scientificDiagram

    Scientific diagrams should be considerably big enough, but not too big or small but perfect for the screen size to be seen by the student,
  
    A scientificDiagram should normally contain between 2 and 8 shapes and no more than 6 labels unless the lesson absolutely requires more.

      Use for:

        • Physics
        • Chemistry
        • Biology
        • Basic Science
        • Agriculture
        • Computer hardware

        Return:

          {
            "type":"scientificDiagram",
            "width":700,
            "height":500,
            "shapes":[
              {
                "type":"circle",
                "cx":150,
                "cy":250,
                "r":45,
                "fill":"white",
                "stroke":"#111"
              },
              {
                "type":"ellipse",
                "cx":300,
                "cy":180,
                "rx":80,
                "ry":45
              },
              {
                "type":"rect",
                "x":400,
                "y":120,
                "width":120,
                "height":90
              },
              {
                "type":"line",
                "x1":150,
                "y1":250,
                "x2":300,
                "y2":180
              },
              {
                "type":"path",
                "d":"M..."
              }
            ],
            "labels":[
              {
                "text":"Light",
                "x":200,
                "y":100
              }
            ]
          }

  11. angleDiagram

    Use whenever an angle is the main teaching concept.

      {
        "type":"angleDiagram",
        "angle":60,
        "label":"θ"
      }

  12. flowChart

    Use for processes, algorithms and life cycles.

      {
        "type":"flowChart",
        "title":"Water Cycle",
          "nodes":[
            {
              "id":"1",
              "text":"Evaporation"
            },
            {
              "id":"2",
              "text":"Condensation"
            },
            {
              "id":"3",
              "text":"Rainfall"
            }
          ]
        }

  13. chart

    Use whenever numerical values should be compared.

      {
        "type":"chart",
        "title":"Rainfall",
        "data":[
            {
              "label":"Jan",
              "value":30
            },
            {
              "label":"Feb",
              "value":45
            }
          ]
        }

  14. pieChart

    Use when showing proportions.

      {
        "type":"pieChart",
        "title":"Budget",
        "data":[
          {
            "label":"Food",
            "value":40
          },
          {
            "label":"Transport",
            "value":20
          },
          {
            "label":"Savings",
              "value":40
            }
          ]
        }

  15. table

    {
      "type":"table",
      "title":"Comparison",
      "headers":[
        "Solid",
        "Liquid"
        ],
      "rows":[
          [
            "Fixed shape",
            "No fixed shape"
          ],
          [
            "Strong forces",
            "Weaker forces"
          ]
        ]
      }

  16. map

    {
      "type":"map",
      "title":"Nigeria",
      "imagePrompt":"Political map of Nigeria",
      "markers":[
          {
            "label":"Abuja",
            "x":50,
            "y":42
          }
        ]
    }

  17. vennDiagram

    {
      "type":"vennDiagram",
      "title":"Animals",
      "leftTitle":"Mammals",
      "rightTitle":"Birds",
      "leftItems":[
                    "Lion"
                  ],
      "overlapItems":[
                        "Vertebrates"
                      ],
      "rightItems":[
                  "Eagle"
                    ]
    }

  18. image

    Use image only if the concept cannot be represented accurately using diagrams, tables, flow charts, geometry diagrams, scientific diagrams, maps or charts.

    Prefer scientificDiagram over image whenever the lesson involves physical objects that can be drawn using circles, rectangles, polygons, lines or paths.

  19. Choose the most appropriate visual block.

    Mathematics
      • equation
      • fraction
      • groupedObjects
      • geometryDiagram
      • angleDiagram

    Physics
      • scientificDiagram
      • chart
      • flowChart
      • equation

      Examples:
        Reflection
        → scientificDiagram

        Refraction
        → scientificDiagram

        Electric circuit
        → scientificDiagram

        Simple machine
        → scientificDiagram

        Force diagram
        → scientificDiagram

        Wave
        → scientificDiagram

    Chemistry

        Atoms
        → scientificDiagram

        Molecules
        → scientificDiagram

        Laboratory apparatus
        → scientificDiagram

        Periodic trends
        → chart

        Reaction process
        → flowChart

    Biology

        Cell
        → scientificDiagram

        Leaf
        → scientificDiagram

        Digestive system
        → scientificDiagram

        Food chain
        → flowChart

        Classification
        → table

    Geography

        Maps
        → map

        Climate comparison
        → chart

        Population
        → pieChart

    History

        Events
        → timeline

        Empires
        → map

        Cause and effect
        → flowChart

        Economics

        Statistics
        → chart

        Market share
        → pieChart

        Economic process
        → flowChart

      Computer Studies

        Algorithms
        → flowChart

        Computer parts
        → scientificDiagram

        Programming concepts
        → flowChart

        Networking
        → scientificDiagram

==================================================
FINAL VALIDATION
==================================================

Before returning JSON verify:

Valid JSON only.

No markdown.

No commentary.

Narration matches the blocks.

Facts are accurate.

Theme is valid.

Keywords are unique.

At least one educational visual block when appropriate.

At least two different block types.

Text blocks are concise.

Title contains no greeting.

==================================================
OUTPUT FORMAT
==================================================

{
  "title": "Example Scene",
  "theme": "science",
  "keywords": [
    "Example",
    "Concept"
  ],
  "narration": "Example narration.",
  "durationInFrames": 2700,
  "blocks": [
    {
      "type": "text",
      "role": "definition",
      "content": "Example supporting text."
    }
  ]
}
`;
}