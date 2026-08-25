export async function runWithRetry(fn, retries = 2, label = "stage") {
  let lastError;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      console.error(`${label} failed (attempt ${attempt})`, err);

      if (attempt === retries) break;
    }
  }

  throw lastError;
}