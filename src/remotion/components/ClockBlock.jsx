import React from "react";

// =====================================
// CLOCK SIZES
// =====================================

const CLOCK_SIZE = {
  hero: 520,

  "single-visual": 360,

  "two-column": 280,

  "grid-2x2": 220,

  gallery: 170,

  default: 320,
};

// =====================================
// CLOCK BLOCK
// =====================================

export const ClockBlock = ({
  hour = 3,
  minute = 0,
  label,
  layout = "single-visual",
}) => {
  const size =
    CLOCK_SIZE[layout] ??
    CLOCK_SIZE.default;

  const safeHour =
    ((Number(hour) || 0) % 12 + 12) % 12;

  const safeMinute =
    ((Number(minute) || 0) % 60 + 60) % 60;

  const border =
    Math.max(4, size * 0.03);

  const hourWidth =
    Math.max(6, size * 0.025);

  const minuteWidth =
    Math.max(4, size * 0.014);

  const hourLength =
    size * 0.28;

  const minuteLength =
    size * 0.40;

  const centerDot =
    size * 0.06;

  const labelFont =
    Math.max(20, size * 0.13);

  const minuteDeg =
    safeMinute * 6;

  const hourDeg =
    safeHour * 30 +
    safeMinute * 0.5;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",

        width: "100%",
      }}
    >
      {/* CLOCK */}

      <div
        style={{
          width: size,
          height: size,

          border: `${border}px solid black`,

          borderRadius: "50%",

          backgroundColor: "#ffffff",

          position: "relative",

          boxSizing: "border-box",
        }}
      >
        {/* Hour Tick Marks */}

        {Array.from({
          length: 12,
        }).map((_, index) => (
          <div
            key={index}
            style={{
              position: "absolute",

              left: "50%",
              top: "50%",

              width:
                index % 3 === 0
                  ? border * 1.2
                  : border * 0.7,

              height:
                size * 0.08,

              backgroundColor:
                "#111827",

              transform: `
                translate(-50%, -50%)
                rotate(${index * 30}deg)
                translateY(-${size * 0.44}px)
              `,
              transformOrigin:
                "center center",
            }}
          />
        ))}

        {/* Numbers */}

        {[
          {
            value: "12",
            x: "50%",
            y: "10%",
          },
          {
            value: "3",
            x: "90%",
            y: "50%",
          },
          {
            value: "6",
            x: "50%",
            y: "90%",
          },
          {
            value: "9",
            x: "10%",
            y: "50%",
          },
        ].map((item) => (
          <div
            key={item.value}
            style={{
              position: "absolute",

              left: item.x,
              top: item.y,

              transform:
                "translate(-50%, -50%)",

              fontSize:
                size * 0.08,

              fontWeight: 700,

              color: "#111827",
            }}
          >
            {item.value}
          </div>
        ))}

        {/* Hour Hand */}

        <div
          style={{
            position: "absolute",

            left: "50%",
            top: "50%",

            width: hourWidth,
            height: hourLength,

            backgroundColor:
              "#111827",

            borderRadius:
              hourWidth,

            transformOrigin:
              "bottom center",

            transform: `
              translate(-50%, -100%)
              rotate(${hourDeg}deg)
            `,
          }}
        />

        {/* Minute Hand */}

        <div
          style={{
            position: "absolute",

            left: "50%",
            top: "50%",

            width: minuteWidth,
            height: minuteLength,

            backgroundColor:
              "#ef4444",

            borderRadius:
              minuteWidth,

            transformOrigin:
              "bottom center",

            transform: `
              translate(-50%, -100%)
              rotate(${minuteDeg}deg)
            `,
          }}
        />

        {/* Center Dot */}

        <div
          style={{
            position: "absolute",

            left: "50%",
            top: "50%",

            width: centerDot,
            height: centerDot,

            borderRadius: "50%",

            backgroundColor:
              "#111827",

            transform:
              "translate(-50%, -50%)",
          }}
        />
      </div>

      {/* Label */}

      {label && (
        <div
          style={{
            marginTop:
              size * 0.08,

            width: "100%",

            fontSize:
              labelFont,

            fontWeight: 600,

            color: "#111827",

            textAlign: "center",

            lineHeight: 1.3,

            wordBreak:
              "break-word",

            overflowWrap:
              "break-word",
          }}
        >
          {label}
        </div>
      )}
    </div>
  );
};