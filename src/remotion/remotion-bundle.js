import { bundle } from "@remotion/bundler";

let bundledServeUrl = null;

export async function getRemotionBundle() {
  if (bundledServeUrl) {
    return bundledServeUrl;
  }

  bundledServeUrl = await bundle({
    entryPoint: "./src/remotion/index.jsx",
  });

  return bundledServeUrl;
}