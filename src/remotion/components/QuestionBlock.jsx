import React from "react";

// =====================================
// QUESTION SIZES
// =====================================

const QUESTION_SIZE = {
  hero: {
    question: 72,
    option: 48,
    padding: 30,
    gap: 28,
    radius: 24,
    maxWidth: 1400,
  },

  "single-visual": {
    question: 60,
    option: 40,
    padding: 24,
    gap: 22,
    radius: 20,
    maxWidth: 1200,
  },

  "two-column": {
    question: 46,
    option: 32,
    padding: 20,
    gap: 18,
    radius: 18,
    maxWidth: 700,
  },

  "grid-2x2": {
    question: 34,
    option: 24,
    padding: 16,
    gap: 14,
    radius: 16,
    maxWidth: 460,
  },

  gallery: {
    question: 24,
    option: 18,
    padding: 12,
    gap: 10,
    radius: 12,
    maxWidth: 320,
  },

  default: {
    question: 54,
    option: 36,
    padding: 22,
    gap: 20,
    radius: 20,
    maxWidth: 1100,
  },
};

// =====================================
// QUESTION BLOCK
// =====================================

export const QuestionBlock = ({
  question,
  options = [],
  answer,
  layout = "single-visual",
}) => {
  const size =
    QUESTION_SIZE[layout] ??
    QUESTION_SIZE.default;

  return (
    <div
      style={{
        width: "100%",
        maxWidth: size.maxWidth,

        display: "flex",
        flexDirection: "column",

        gap: size.gap,
      }}
    >
      {/* QUESTION */}

      <div
        style={{
          fontSize: size.question,

          fontWeight: 700,

          color: "#111827",

          lineHeight: 1.35,

          textAlign: "center",

          wordBreak: "break-word",
        }}
      >
        {question}
      </div>

      {/* OPTIONS */}

      <div
        style={{
          display: "flex",
          flexDirection: "column",

          gap: size.gap,
        }}
      >
        {options.map(
          (option, index) => {
            const letter =
              String.fromCharCode(
                65 + index
              );

            const isAnswer =
              answer === option ||
              answer === index;

            return (
              <div
                key={index}
                style={{
                  display: "flex",
                  alignItems: "center",

                  gap: size.padding,

                  padding: size.padding,

                  border: "3px solid #1f2937",

                  borderRadius:
                    size.radius,

                  backgroundColor:
                    "#ffffff",

                  boxSizing:
                    "border-box",
                }}
              >
                {/* OPTION LETTER */}

                <div
                  style={{
                    width:
                      size.option *
                      1.3,

                    height:
                      size.option *
                      1.3,

                    borderRadius:
                      "50%",

                    backgroundColor:
                      isAnswer
                        ? "#22c55e"
                        : "#2563eb",

                    color: "#ffffff",

                    display: "flex",

                    justifyContent:
                      "center",

                    alignItems:
                      "center",

                    fontWeight:
                      "bold",

                    fontSize:
                      size.option *
                      0.8,

                    flexShrink: 0,
                  }}
                >
                  {letter}
                </div>

                {/* OPTION TEXT */}

                <div
                  style={{
                    flex: 1,

                    fontSize:
                      size.option,

                    color:
                      "#111827",

                    lineHeight: 1.4,

                    wordBreak:
                      "break-word",
                  }}
                >
                  {option}
                </div>
              </div>
            );
          }
        )}
      </div>
    </div>
  );
};


// import React from "react";

// export const QuestionBlock = ({
//   question,
//   options = [],
// }) => {
//   return (
//     <div
//       style={{
//         width: "100%",
//         maxWidth: 1200,
//       }}
//     >
//       <div
//         style={{
//           fontSize: 60,
//           fontWeight: "bold",
//           marginBottom: 40,
//         }}
//       >
//         {question}
//       </div>

//       <div
//         style={{
//           display: "flex",
//           flexDirection:
//             "column",
//           gap: 20,
//         }}
//       >
//         {options.map(
//           (option, index) => (
//             <div
//               key={index}
//               style={{
//                 padding: 20,
//                 border:
//                   "3px solid black",
//                 borderRadius: 20,
//                 fontSize: 40,
//               }}
//             >
//               {option}
//             </div>
//           )
//         )}
//       </div>
//     </div>
//   );
// };