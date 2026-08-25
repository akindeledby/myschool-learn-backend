/**
 * Calculates percentage accuracy.
 */
export function calculateAccuracy(
  correct,
  wrong
) {
  const total =
    correct + wrong;

  if (total === 0) {
    return 0;
  }

  return Math.round(
    (correct / total) * 100
  );
}

/**
 * Calculates percentage.
 */
export function calculatePercentage(
  value,
  total
) {
  if (total === 0) {
    return 0;
  }

  return Math.round(
    (value / total) * 100
  );
}

/**
 * Calculates average.
 */
export function calculateAverage(
  values = []
) {
  if (!values.length) {
    return 0;
  }

  return Math.round(
    values.reduce(
      (sum, value) => sum + value,
      0
    ) / values.length
  );
}

/**
 * Calculates level from XP.
 */
export function calculateLevel(
  xp,
  xpPerLevel
) {
  return Math.max(
    1,
    Math.floor(
      xp / xpPerLevel
    ) + 1
  );
}

/**
 * Returns true if two dates are the same day.
 */
export function isSameDay(
  first,
  second
) {
  return (
    first.getFullYear() ===
      second.getFullYear() &&
    first.getMonth() ===
      second.getMonth() &&
    first.getDate() ===
      second.getDate()
  );
}

/**
 * Clamp a value between min and max.
 */
export function clamp(
  value,
  min,
  max
) {
  return Math.min(
    Math.max(value, min),
    max
  );
}