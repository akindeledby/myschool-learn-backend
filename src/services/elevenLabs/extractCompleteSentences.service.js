export function extractCompleteSentences(buffer) {
  if (!buffer) {
    return {
      sentences: [],
      remainder: "",
    };
  }

  const sentences = [];

  /*
  ==========================================
  Sentence detection
  ==========================================
  */

  const regex =
    /([\s\S]*?[.!?]+)(?=\s+(?=[A-Z0-9"'“‘(])|$)/g;

  let match;
  let consumedLength = 0;

  while ((match = regex.exec(buffer)) !== null) {
    const sentence = match[1].trim();

    if (!sentence) {
      continue;
    }

    /*
    ========================================
    Avoid treating decimal numbers as
    sentence endings.
    ========================================
    */

    if (
      /^\d+\.\d+$/.test(sentence) ||
      /\b\d+\.\d+$/.test(sentence)
    ) {
      continue;
    }

    sentences.push(sentence);

    consumedLength = regex.lastIndex;
  }

  /*
  ==========================================
  Remaining incomplete sentence
  ==========================================
  */

  const remainder =
    consumedLength > 0
      ? buffer.slice(consumedLength)
      : buffer;

    return {
      sentences,
      remainder,
    };
  }
