import { Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { prisma } from '@racsemi/database';
import { executeCodeInSandbox } from '@racsemi/code-runner';
import * as dotenv from 'dotenv';
import nodemailer from 'nodemailer';
dotenv.config();

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

console.log('🚀 RACSEMI Worker starting... Connecting to Redis at', REDIS_URL);

const codeExecutionWorker = new Worker('code-execution', async (job: Job) => {
  const { submissionId, isRunOnly, customInput, language, sourceCode, questionId, timeLimitMs, memoryLimitMb, sessionId } = job.data;
  console.log(`[Worker] Processing code execution job ${job.id} for submission ${submissionId || 'run'}`);

  try {
    const question = await prisma.codingQuestion.findUnique({
      where: { questionId },
      include: {
        testCases: {
          orderBy: { orderIndex: 'asc' }
        }
      }
    });

    if (!question) throw new Error('Coding question details not found');

    let testCasesToRun = question.testCases;

    if (isRunOnly) {
      if (customInput !== undefined && customInput !== null) {
        testCasesToRun = [{
          id: 'custom-test',
          codingQuestionId: question.id,
          input: customInput,
          expectedOutput: '',
          isHidden: false,
          scoreWeight: 0,
          explanation: null,
          orderIndex: 0
        }];
      } else {
        testCasesToRun = testCasesToRun.filter(tc => !tc.isHidden);
      }
    }

    const executionResult = await executeCodeInSandbox({
      language,
      sourceCode,
      testCases: testCasesToRun,
      timeLimitMs: timeLimitMs || question.timeLimitMs || 5000,
      memoryLimitMb: memoryLimitMb || question.memoryLimitMb || 256,
      isRunOnly
    });

    if (!isRunOnly && submissionId) {
      const questionMaxScore = 20; // Default or fetch from AssessmentQuestion
      const scoreObtained = Math.round((executionResult.totalScorePercentage / 100) * questionMaxScore * 10) / 10;

      await prisma.codingSubmission.create({
        data: {
          id: submissionId,
          sessionId,
          questionId,
          language,
          sourceCode,
          status: executionResult.status,
          passedTestCases: executionResult.passedTestCases,
          totalTestCases: executionResult.totalTestCases,
          executionTimeMs: executionResult.avgExecutionTimeMs,
          memoryUsedKb: executionResult.maxMemoryUsedKb,
          compileOutput: executionResult.compileOutput,
          scoreObtained,
          isDraft: false
        }
      });
    }

    // Save job result to be fetched by the API
    return executionResult;
  } catch (err: any) {
    console.error(`[Worker] Error executing job ${job.id}:`, err);
    throw err;
  }
}, { connection, concurrency: parseInt(process.env.CODE_RUNNER_MAX_CONCURRENT || '4', 10) });

codeExecutionWorker.on('completed', (job) => {
  console.log(`[Worker] Code execution job ${job.id} completed successfully`);
});

codeExecutionWorker.on('failed', (job, err) => {
  console.log(`[Worker] Code execution job ${job?.id} failed:`, err.message);
});

// Setup Nodemailer Transport
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});

const emailWorker = new Worker('emails', async (job: Job) => {
  console.log(`[Worker] Processing email job ${job.id} -> ${job.data.emailType} to ${job.data.recipientEmail}`);
  
  try {
    const { recipientEmail, recipientName, subject, htmlBody, emailLogId } = job.data;
    
    // Actually dispatch email using Nodemailer
    const info = await transporter.sendMail({
      from: `"${process.env.FROM_NAME || 'RACSEMI Assess'}" <${process.env.FROM_EMAIL || 'noreply@racsemi.com'}>`,
      to: recipientEmail,
      subject: subject || 'You have been invited to an assessment',
      html: htmlBody || `<p>Hello ${recipientName || 'Candidate'}, you have a new notification from RACSEMI.</p>`
    });

    console.log(`[Worker] Nodemailer message sent: ${info.messageId}`);
    
    if (emailLogId) {
      await prisma.emailLog.update({
        where: { id: emailLogId },
        data: { status: 'DELIVERED', sentAt: new Date() }
      });
    }
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error(`[Worker] Nodemailer failed to send email:`, error.message);
    if (job.data.emailLogId) {
      await prisma.emailLog.update({
        where: { id: job.data.emailLogId },
        data: { status: 'FAILED', errorMessage: error.message }
      });
    }
    throw error;
  }
}, { connection, concurrency: 10 });

emailWorker.on('completed', (job) => {
  console.log(`[Worker] Email job ${job.id} sent successfully`);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down workers...');
  await codeExecutionWorker.close();
  await emailWorker.close();
  process.exit(0);
});
