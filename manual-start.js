import "dotenv/config";

import { lessonQueue } from "./src/queues/lesson.queue.js";

await lessonQueue.add(
  "generate-lesson",
  {
    topicId:
      "1bf839e8-2401-438e-b07e-ce020d94d077",
  }
);

console.log("job started");
process.exit(0);


// node manual-start.js