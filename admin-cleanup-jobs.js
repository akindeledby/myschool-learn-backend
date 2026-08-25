// admin-cleanup.js

import { curriculumQueue } from "./src/queues/curriculum.queue.js";
import { lessonQueue } from "./src/queues/lesson.queue.js";
import { audioQueue } from "./src/queues/audio.queue.js";
import { imageQueue } from "./src/queues/image.queue.js";
import { renderQueue } from "./src/queues/render.queue.js";
import { uploadQueue } from "./src/queues/upload.queue.js";
import { sceneQueue } from "./src/queues/scene.queue.js";
import { hlsQueue } from "./src/queues/hls.queue.js";

await curriculumQueue.clean(0, 0, "failed");
await lessonQueue.clean(0, 0, "failed");
await audioQueue.clean(0, 0, "failed");
await imageQueue.clean(0, 0, "failed");
await renderQueue.clean(0, 0, "failed");
await uploadQueue.clean(0, 0, "failed");
await sceneQueue.clean(0, 0, "failed");
await hlsQueue.clean(0, 0, "failed");

await curriculumQueue.clean(0, 0, "completed");
await lessonQueue.clean(0, 0, "completed");
await audioQueue.clean(0, 0, "completed");
await imageQueue.clean(0, 0, "completed");
await renderQueue.clean(0, 0, "completed");
await uploadQueue.clean(0, 0, "completed");
await sceneQueue.clean(0, 0, "completed");
await hlsQueue.clean(0, 0, "completed");


console.log("failed and completed jobs cleared");
process.exit(0);

// node admin-cleanup-jobs.js