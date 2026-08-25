

import { LESSON_THEMES } from "./lessonThemes.js";

export function getLessonTheme(themeName = "") {
  const value = themeName.toLowerCase().trim();

  if (LESSON_THEMES[value]) {
    return LESSON_THEMES[value];
  }

  if (value.includes("math")) {
    return LESSON_THEMES.mathematics;
  }

  if (value.includes("english")) {
    return LESSON_THEMES.english;
  }

  if (
    value.includes("biology") ||
    value.includes("chemistry") ||
    value.includes("physics") ||
    value.includes("basic science") ||
    value.includes("basic technology") ||
    value.includes("physical and health education") ||
    value.includes("computer studies") ||
    value.includes("agricultural science")
  ) {
    return LESSON_THEMES.science;
  }

  if (
    value.includes("accounting") ||
    value.includes("commerce") ||
    value.includes("economics") ||
    value.includes("business studies") ||
    value.includes("financial accounting") ||
    value.includes("business") ||
    value.includes("enterpreneurship")
  ) {
    return LESSON_THEMES.commercial;
  }


  if (
    value.includes("civic education") ||
    value.includes("arts") ||
    value.includes("social studies") ||
    value.includes("security education") ||
    value.includes("yoruba") ||
    value.includes("french") ||
    value.includes("government")
  ) {
    return LESSON_THEMES.socialStudies;
  }

  return LESSON_THEMES.default;
}


// export function getLessonTheme(themeName = "") {
//   const key = themeName.trim();

//   if (LESSON_THEMES[key]) {
//     return LESSON_THEMES[key];
//   }

//   return LESSON_THEMES.default;
// }
