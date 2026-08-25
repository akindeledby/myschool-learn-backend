import React from "react";

const TABLE_WIDTH = {
  hero: 1200,
  "single-visual": 900,
  "two-column": 700,
  "grid-2x2": 520,
  gallery: 360,
  default: 900,
};

const FONT = {
  hero: 34,
  "single-visual": 30,
  "two-column": 24,
  "grid-2x2": 20,
  gallery: 16,
  default: 30,
};

export const TableBlock = ({
  headers,
  rows,
  title,
  layout = "single-visual",
}) => {
  const width =
    TABLE_WIDTH[layout] ??
    TABLE_WIDTH.default;

  const font =
    FONT[layout] ??
    FONT.default;

  // ------------------------------------
  // Normalize headers
  // ------------------------------------

  let safeHeaders = [];

  if (Array.isArray(headers)) {
    safeHeaders = headers;
  } else if (typeof headers === "string") {
    safeHeaders = headers
      .split(",")
      .map((h) => h.trim());
  }

  // ------------------------------------
  // Normalize rows
  // ------------------------------------

  let safeRows = [];

  if (Array.isArray(rows)) {
    safeRows = rows.map((row) => {
      if (Array.isArray(row)) {
        return row;
      }

      if (typeof row === "string") {
        return row
          .split(",")
          .map((cell) => cell.trim());
      }

      return [];
    });
  }

  return (
    <div
      style={{
        width,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {title && (
        <div
          style={{
            fontSize: font + 6,
            fontWeight: "bold",
            marginBottom: 20,
            textAlign: "center",
          }}
        >
          {title}
        </div>
      )}

      {safeHeaders.length > 0 && (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            tableLayout: "fixed",
          }}
        >
          <thead>
            <tr>
              {safeHeaders.map((header, index) => (
                <th
                  key={index}
                  style={{
                    border: "3px solid black",
                    padding: 18,
                    background: "#f3f4f6",
                    fontSize: font,
                    wordBreak: "break-word",
                  }}
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {safeRows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    style={{
                      border: "2px solid #888",
                      padding: 18,
                      textAlign: "center",
                      fontSize: font,
                      wordBreak: "break-word",
                    }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};