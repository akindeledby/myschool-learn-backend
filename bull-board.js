// bull-board.js

import express from "express";
import { Queue } from "bullmq";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
// import { connection } from "./src/queues/render.queue.js";
import { redis } from "./lib/redis.js";

// =====================================
// QUEUES
// =====================================
const uploadQueue = new Queue("upload", {
  connection: redis,
});

const schemeOfWorkQueue = new Queue("schemeOfWork", {
  connection: redis,
});

const lessonQueue = new Queue("lesson", {
  connection: redis,
});

const sceneQueue = new Queue("scene", {
  connection: redis,
});

const quizQueue = new Queue("quiz", {
  connection: redis,
});

const audioQueue = new Queue("audio", { 
  connection: redis,
});

const videoQueue = new Queue("video", { 
  connection: redis, 
});

const renderStatusQueue = new Queue("render-status", { 
  connection: redis, 
});

const hlsQueue = new Queue("hls", { 
  connection: redis, 
});

// =====================================
// SERVER
// =====================================

const serverAdapter =
  new ExpressAdapter();

serverAdapter.setBasePath(
  "/admin/queues"
);

createBullBoard({
  queues: [
    new BullMQAdapter(
      uploadQueue
    ),

    new BullMQAdapter(
      schemeOfWorkQueue
    ),
    
    new BullMQAdapter(
      lessonQueue
    ),

    new BullMQAdapter(
      sceneQueue
    ),

    new BullMQAdapter(
      quizQueue
    ),

    new BullMQAdapter(
      audioQueue
    ),

    new BullMQAdapter(
      videoQueue
    ),

    new BullMQAdapter(
      renderStatusQueue
    ),

    new BullMQAdapter(
      hlsQueue
    ),
  ],

  serverAdapter,
});

const app = express();

app.use(
  "/admin/queues",
  serverAdapter.getRouter()
);

app.listen(3001, () => {
  console.log(
    "🚀 Bull Board running on http://localhost:3001/admin/queues"
  );
});


// npm install @bull-board/api @bull-board/express
// node bull-board.js