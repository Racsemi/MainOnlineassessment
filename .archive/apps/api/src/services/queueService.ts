import { Queue, QueueEvents, Job } from 'bullmq';
import IORedis from 'ioredis';
import IORedisMock from 'ioredis-mock';
import { ENV } from '../config/env';

const isMock = process.env.NODE_ENV !== 'production' && ENV.REDIS_URL.includes('localhost');
const connection = isMock ? new IORedisMock() : new IORedis(ENV.REDIS_URL, { maxRetriesPerRequest: null });

export let codeExecutionQueue: any;
export let codeExecutionEvents: any;
export let emailQueue: any;

if (process.env.NO_INFRA !== 'true') {
  codeExecutionQueue = new Queue('code-execution', { connection });
  codeExecutionEvents = new QueueEvents('code-execution', { connection });
  emailQueue = new Queue('emails', { connection });
}

export async function enqueueCodeExecution(payload: any, waitForResult: boolean = false) {
  if (process.env.NO_INFRA === 'true') {
    // Fallback for local testing without Redis/Docker
    const { executeCodeInSandbox } = require('@racsemi/code-runner');
    const { prisma } = require('@racsemi/database');
    const question = await prisma.question.findUnique({
      where: { id: payload.questionId },
      include: { codingDetails: { include: { testCases: true } } }
    });
    const result = await executeCodeInSandbox({
      language: payload.language,
      sourceCode: payload.sourceCode,
      testCases: question.codingDetails.testCases,
      timeLimitMs: payload.timeLimitMs,
      memoryLimitMb: payload.memoryLimitMb,
      isRunOnly: payload.isRunOnly
    });
    return { jobId: 'mock-job-id', status: 'completed', result };
  }

  const job = await codeExecutionQueue.add('execute', payload, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 1000 },
    removeOnComplete: true,
    removeOnFail: 100
  });

  if (waitForResult) {
    try {
      const result = await job.waitUntilFinished(codeExecutionEvents, 10000);
      return { jobId: job.id, status: 'completed', result };
    } catch (e) {
      return { jobId: job.id, status: 'pending', message: 'Execution is taking longer than expected.' };
    }
  }

  return { jobId: job.id, status: 'pending', message: 'Job enqueued successfully' };
}

// Email Queue declaration moved up

/**
 * Enqueue an email to be sent
 */
export async function enqueueEmail(data: any) {
  await emailQueue.add(data.emailType, data, {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: true,
    removeOnFail: 100
  });
}
