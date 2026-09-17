import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn, execSync } from 'child_process';
import { LANGUAGE_REGISTRY, ExecutionStatus } from '@racsemi/shared';

export interface TestCaseExecutionItem {
  id?: string;
  input: string;
  expectedOutput: string;
  isHidden?: boolean;
  scoreWeight?: number;
}

export interface CodeExecutionRequest {
  language: string;
  sourceCode: string;
  testCases: TestCaseExecutionItem[];
  timeLimitMs?: number;
  memoryLimitMb?: number;
  isRunOnly?: boolean; // If true, only public test cases or custom test case
}

export interface TestCaseResult {
  testCaseId?: string;
  input?: string;          // Sent ONLY for public test cases
  expectedOutput?: string; // Sent ONLY for public test cases
  actualOutput?: string;   // Sent ONLY for public test cases
  isHidden: boolean;
  passed: boolean;
  status: ExecutionStatus;
  executionTimeMs: number;
  memoryUsedKb: number;
  stdout?: string;
  stderr?: string;
  errorMessage?: string;
}

export interface CodeExecutionResponse {
  status: ExecutionStatus;
  passedTestCases: number;
  totalTestCases: number;
  totalScorePercentage: number;
  avgExecutionTimeMs: number;
  maxMemoryUsedKb: number;
  compileOutput?: string;
  testResults: TestCaseResult[];
}

function normalizeOutput(output: string): string {
  return output.replace(/\r\n/g, '\n').trim();
}

/**
 * Execute candidate code inside an ephemeral isolated sandbox
 */
export async function executeCodeInSandbox(request: CodeExecutionRequest): Promise<CodeExecutionResponse> {
  const { language, sourceCode, testCases, isRunOnly } = request;
  const timeLimitMs = request.timeLimitMs || 5000;
  const langConfig = LANGUAGE_REGISTRY[language.toLowerCase()];

  if (!langConfig || !langConfig.enabled) {
    return {
      status: ExecutionStatus.COMPILATION_ERROR,
      passedTestCases: 0,
      totalTestCases: testCases.length,
      totalScorePercentage: 0,
      avgExecutionTimeMs: 0,
      maxMemoryUsedKb: 0,
      compileOutput: `Unsupported or disabled language: ${language}`,
      testResults: []
    };
  }

  // Enforce source code size limit (100 KB)
  if (Buffer.byteLength(sourceCode, 'utf8') > 100 * 1024) {
    return {
      status: ExecutionStatus.SECURITY_VIOLATION,
      passedTestCases: 0,
      totalTestCases: testCases.length,
      totalScorePercentage: 0,
      avgExecutionTimeMs: 0,
      maxMemoryUsedKb: 0,
      compileOutput: 'Source code exceeds maximum permitted size of 100KB',
      testResults: []
    };
  }

  // Create isolated ephemeral directory
  const sandboxDir = path.join(os.tmpdir(), `racsemi_sandbox_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`);
  fs.mkdirSync(sandboxDir, { recursive: true });

  const fileName = language.toLowerCase() === 'java' ? `Solution.${langConfig.fileExtension}` : `solution.${langConfig.fileExtension}`;
  const filePath = path.join(sandboxDir, fileName);
  fs.writeFileSync(filePath, sourceCode, 'utf8');

  try {
    // 1. Compilation Phase (if required)
    if (langConfig.compileCommand) {
      try {
        let compileImage = 'node:20-alpine';
        if (langConfig.compileCommand.startsWith('g++')) compileImage = 'gcc:latest';
        else if (langConfig.compileCommand.startsWith('javac')) compileImage = 'amazoncorretto:17-alpine';
        else if (langConfig.compileCommand.startsWith('go build')) compileImage = 'golang:1.22-alpine';

        const compileDockerCmd = [
          'docker', 'run', '--rm',
          '--network', 'none',
          '-v', `${sandboxDir}:/usr/src/app`,
          '-w', '/usr/src/app',
          compileImage,
          'sh', '-c', langConfig.compileCommand
        ].join(' ');

        execSync(compileDockerCmd, {
          cwd: sandboxDir,
          timeout: 15000,
          stdio: 'pipe'
        });
      } catch (compileErr: any) {
        const compileStderr = compileErr.stderr ? compileErr.stderr.toString('utf8') : (compileErr.message || 'Compilation failed');
        return {
          status: ExecutionStatus.COMPILATION_ERROR,
          passedTestCases: 0,
          totalTestCases: testCases.length,
          totalScorePercentage: 0,
          avgExecutionTimeMs: 0,
          maxMemoryUsedKb: 0,
          compileOutput: compileStderr.slice(0, 2048),
          testResults: []
        };
      }
    }

    // 2. Test Cases Execution Phase
    const results: TestCaseResult[] = [];
    let passedCount = 0;
    let totalScore = 0;
    let totalTime = 0;
    let maxMem = 0;

    for (const tc of testCases) {
      const isHidden = !!tc.isHidden;
      const tcResult = await runSingleTestCase(sandboxDir, langConfig, tc.input, tc.expectedOutput, timeLimitMs);
      
      const passed = tcResult.status === ExecutionStatus.PASSED;
      if (passed) {
        passedCount++;
        totalScore += tc.scoreWeight ?? (1 / (testCases.length || 1));
      }
      totalTime += tcResult.executionTimeMs;
      maxMem = Math.max(maxMem, tcResult.memoryUsedKb);

      // SECURITY: If the test case is HIDDEN and it's a candidate request, strictly mask input/output
      const sanitizedResult: TestCaseResult = {
        testCaseId: tc.id,
        isHidden,
        passed,
        status: tcResult.status,
        executionTimeMs: tcResult.executionTimeMs,
        memoryUsedKb: tcResult.memoryUsedKb,
        // Only include input / output details if test is NOT hidden
        input: isHidden ? undefined : tc.input,
        expectedOutput: isHidden ? undefined : tc.expectedOutput,
        actualOutput: isHidden ? undefined : tcResult.actualOutput,
        stdout: isHidden ? undefined : tcResult.stdout,
        stderr: isHidden ? undefined : tcResult.stderr,
        errorMessage: tcResult.errorMessage
      };

      results.push(sanitizedResult);
    }

    const overallStatus = passedCount === testCases.length ? ExecutionStatus.PASSED : ExecutionStatus.FAILED;
    const scorePercentage = testCases.length > 0 ? Math.round((passedCount / testCases.length) * 100) : 0;

    return {
      status: overallStatus,
      passedTestCases: passedCount,
      totalTestCases: testCases.length,
      totalScorePercentage: scorePercentage,
      avgExecutionTimeMs: testCases.length > 0 ? Math.round(totalTime / testCases.length) : 0,
      maxMemoryUsedKb: maxMem,
      testResults: results
    };

  } finally {
    // 3. Ephemeral Sandbox Cleanup
    try {
      fs.rmSync(sandboxDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup error
    }
  }
}

interface SingleTestOutput {
  status: ExecutionStatus;
  actualOutput: string;
  stdout: string;
  stderr: string;
  executionTimeMs: number;
  memoryUsedKb: number;
  errorMessage?: string;
}

function runSingleTestCase(
  sandboxDir: string,
  langConfig: any,
  input: string,
  expectedOutput: string,
  timeLimitMs: number
): Promise<SingleTestOutput> {
  return new Promise((resolve) => {
    const startTime = process.hrtime();
    const runParts = langConfig.runCommand.split(' ');
    const command = runParts[0];
    const args = runParts.slice(1);

    let stdoutData = '';
    let stderrData = '';
    let isTimedOut = false;

    // Use isolated execution environment using docker run
    const dockerArgs = [
      'run',
      '--rm',
      '-i',
      '--network', 'none',
      '--memory', `${langConfig.memoryLimitMb || 256}m`,
      '--cpus', '0.5',
      '-v', `${sandboxDir}:/usr/src/app`,
      '-w', '/usr/src/app',
      'node:20-alpine', // Or a unified docker image
      'sh', '-c', `${command} ${args.join(' ')}`
    ];
    
    // For Python/C++/Java we would ideally have a unified image, e.g. `racsemi-runner:latest`
    // but for simplicity and lack of pre-built image right now, let's use standard images based on language
    let image = 'node:20-alpine';
    let execCmd = `${command} ${args.join(' ')}`;
    
    if (command === 'python3' || command === 'python') {
      image = 'python:3.10-alpine';
    } else if (command === 'g++' || command === './solution') {
      image = 'gcc:latest';
      if (command === 'g++') {
        execCmd = `${command} ${args.join(' ')} && ./solution`;
      }
    } else if (command === 'javac' || command === 'java') {
      image = 'amazoncorretto:17-alpine';
      if (command === 'javac') {
        execCmd = `${command} ${args.join(' ')} && java Solution`;
      }
    } else if (command === 'go') {
      image = 'golang:1.22-alpine';
    }

    const finalDockerArgs = [
      'run',
      '--rm',
      '-i',
      '--network', 'none',
      '--memory', `${langConfig.memoryLimitMb || 256}m`,
      '--cpus', '0.5',
      '-v', `${sandboxDir}:/usr/src/app`,
      '-w', '/usr/src/app',
      image,
      'sh', '-c', execCmd
    ];

    const child = spawn('docker', finalDockerArgs, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    const timeoutHandle = setTimeout(() => {
      isTimedOut = true;
      try {
        child.kill('SIGKILL');
      } catch {}
    }, timeLimitMs);

    if (child.stdin) {
      child.stdin.write(input || '');
      child.stdin.end();
    }

    child.stdout.on('data', (chunk) => {
      stdoutData += chunk.toString('utf8');
      if (stdoutData.length > 1024 * 1024) {
        // Output limit exceeded (1MB)
        try { child.kill('SIGKILL'); } catch {}
      }
    });

    child.stderr.on('data', (chunk) => {
      stderrData += chunk.toString('utf8');
      if (stderrData.length > 1024 * 1024) {
        try { child.kill('SIGKILL'); } catch {}
      }
    });

    child.on('error', (err) => {
      clearTimeout(timeoutHandle);
      const diff = process.hrtime(startTime);
      const timeMs = Math.round(diff[0] * 1000 + diff[1] / 1e6);
      resolve({
        status: ExecutionStatus.RUNTIME_ERROR,
        actualOutput: '',
        stdout: stdoutData,
        stderr: stderrData,
        executionTimeMs: timeMs,
        memoryUsedKb: 0,
        errorMessage: err.message
      });
    });

    child.on('close', (exitCode) => {
      clearTimeout(timeoutHandle);
      const diff = process.hrtime(startTime);
      const timeMs = Math.round(diff[0] * 1000 + diff[1] / 1e6);

      if (isTimedOut) {
        return resolve({
          status: ExecutionStatus.TIME_LIMIT_EXCEEDED,
          actualOutput: '',
          stdout: stdoutData,
          stderr: 'Time Limit Exceeded',
          executionTimeMs: timeLimitMs,
          memoryUsedKb: 0,
          errorMessage: `Process exceeded execution time limit of ${timeLimitMs}ms`
        });
      }

      if (exitCode !== 0) {
        return resolve({
          status: ExecutionStatus.RUNTIME_ERROR,
          actualOutput: '',
          stdout: stdoutData,
          stderr: stderrData.slice(0, 1024),
          executionTimeMs: timeMs,
          memoryUsedKb: 0,
          errorMessage: `Runtime error (exit code ${exitCode})`
        });
      }

      const normalizedActual = normalizeOutput(stdoutData);
      const normalizedExpected = normalizeOutput(expectedOutput);
      const passed = normalizedActual === normalizedExpected;

      resolve({
        status: passed ? ExecutionStatus.PASSED : ExecutionStatus.FAILED,
        actualOutput: stdoutData,
        stdout: stdoutData,
        stderr: stderrData,
        executionTimeMs: timeMs,
        memoryUsedKb: Math.round(process.memoryUsage().heapUsed / 1024),
        errorMessage: passed ? undefined : 'Output did not match expected test output'
      });
    });
  });
}
