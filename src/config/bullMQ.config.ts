import { Queue, QueueOptions } from "bullmq";
import config from ".";

export const connectionBullMQ: QueueOptions["connection"] = {
  host: config.bullMQ.host!,
  port: Number(config.bullMQ.port!),
};

export const emailQueue = new Queue("emailQueue", {
  connection: connectionBullMQ,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: {
      age: 3600, // Keep completed jobs for 1 hour
      count: 100, // Keep last 100 completed jobs
    },
    removeOnFail: false,
  },
});

/** Amadeus car offer search — slow upstream; FE should poll job status. */
export const carSearchQueue = new Queue("carSearchQueue", {
  connection: connectionBullMQ,
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "exponential", delay: 3000 },
    removeOnComplete: {
      age: 600,
      count: 200,
    },
    removeOnFail: {
      age: 3600,
    },
  },
});
