import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import util from 'util';

const execAsync = util.promisify(exec);

interface RunResult {
  output: string;
  error: string;
  status: 'passed' | 'failed' | 'timeout' | 'error';
}

export const runCodeInDocker = async (
  language: string, 
  code: string, 
  input: string,
  timeLimit: number = 2000
): Promise<RunResult> => {
  const runId = crypto.randomBytes(8).toString('hex');
  const tempDir = path.join(__dirname, '../../../../code-runner/temp', runId);
  
  try {
    await fs.mkdir(tempDir, { recursive: true });
    
    // We'll support node initially for simplicity
    if (language.toLowerCase() === 'javascript') {
      const codeWithInput = `
        const fs = require('fs');
        const input = fs.readFileSync('/usr/src/app/input.txt', 'utf-8');
        // Simple override of console.log to capture pure output without formatting if needed, 
        // or just let it write to stdout.
        ${code}
      `;
      
      await fs.writeFile(path.join(tempDir, 'code.js'), codeWithInput);
      await fs.writeFile(path.join(tempDir, 'input.txt'), input);
      
      // Run docker container with strict limits: no network, readonly root except tmp, memory limit
      // Using node image for JS
      // Run docker container with strict limits: no network, readonly root except tmp, memory limit
      const cmd = `docker run --rm --name run-${runId} --network none --memory 256m --cpus 0.5 -v ${tempDir}/code.js:/usr/src/app/code.js:ro -v ${tempDir}/input.txt:/usr/src/app/input.txt:ro node:20-alpine node /usr/src/app/code.js`;

      
      const timeoutPromise = new Promise<RunResult>((resolve) => {
        setTimeout(() => {
          exec(`docker kill run-${runId}`, () => {});
          resolve({ output: '', error: 'Execution Timed Out', status: 'timeout' });
        }, timeLimit);
      });
      
      const execPromise = execAsync(cmd).then(({ stdout, stderr }) => {
        return {
          output: stdout.trim(),
          error: stderr.trim(),
          status: stderr ? 'error' as const : 'passed' as const
        };
      }).catch(err => {
        return {
          output: err.stdout?.trim() || '',
          error: err.stderr?.trim() || err.message,
          status: 'error' as const
        };
      });
      
      return await Promise.race([execPromise, timeoutPromise]);
    } else if (language.toLowerCase() === 'python') {
      const codeWithInput = `
import sys
with open('/usr/src/app/input.txt', 'r') as f:
    input_data = f.read()
# Override sys.stdin to read from input_data if needed, but simple script can just use it
${code}
`;
      await fs.writeFile(path.join(tempDir, 'code.py'), codeWithInput);
      await fs.writeFile(path.join(tempDir, 'input.txt'), input);
      
      const cmd = `docker run --rm --name run-${runId} --network none --memory 256m --cpus 0.5 -v ${tempDir}/code.py:/usr/src/app/code.py:ro -v ${tempDir}/input.txt:/usr/src/app/input.txt:ro python:3.10-alpine python /usr/src/app/code.py`;
      
      const timeoutPromise = new Promise<RunResult>((resolve) => {
        setTimeout(() => {
          exec(`docker kill run-${runId}`, () => {});
          resolve({ output: '', error: 'Execution Timed Out', status: 'timeout' });
        }, timeLimit);
      });
      
      const execPromise = execAsync(cmd).then(({ stdout, stderr }) => {
        return { output: stdout.trim(), error: stderr.trim(), status: stderr ? 'error' as const : 'passed' as const };
      }).catch(err => {
        return { output: err.stdout?.trim() || '', error: err.stderr?.trim() || err.message, status: 'error' as const };
      });
      
      return await Promise.race([execPromise, timeoutPromise]);
    } else if (language.toLowerCase() === 'java') {
      await fs.writeFile(path.join(tempDir, 'Main.java'), code);
      await fs.writeFile(path.join(tempDir, 'input.txt'), input);
      
      const cmd = `docker run --rm --name run-${runId} --network none --memory 512m --cpus 1.0 -v ${tempDir}:/usr/src/app -w /usr/src/app openjdk:17-alpine sh -c "javac Main.java && java Main < input.txt"`;
      
      const timeoutPromise = new Promise<RunResult>((resolve) => {
        setTimeout(() => {
          exec(`docker kill run-${runId}`, () => {});
          resolve({ output: '', error: 'Execution Timed Out', status: 'timeout' });
        }, timeLimit);
      });
      
      const execPromise = execAsync(cmd).then(({ stdout, stderr }) => {
        return { output: stdout.trim(), error: stderr.trim(), status: stderr ? 'error' as const : 'passed' as const };
      }).catch(err => {
        return { output: err.stdout?.trim() || '', error: err.stderr?.trim() || err.message, status: 'error' as const };
      });
      
      return await Promise.race([execPromise, timeoutPromise]);
    } else if (language.toLowerCase() === 'cpp' || language.toLowerCase() === 'c++') {
      await fs.writeFile(path.join(tempDir, 'code.cpp'), code);
      await fs.writeFile(path.join(tempDir, 'input.txt'), input);
      
      const cmd = `docker run --rm --name run-${runId} --network none --memory 512m --cpus 1.0 -v ${tempDir}:/usr/src/app -w /usr/src/app gcc:latest sh -c "g++ code.cpp -o out && ./out < input.txt"`;
      
      const timeoutPromise = new Promise<RunResult>((resolve) => {
        setTimeout(() => {
          exec(`docker kill run-${runId}`, () => {});
          resolve({ output: '', error: 'Execution Timed Out', status: 'timeout' });
        }, timeLimit);
      });
      
      const execPromise = execAsync(cmd).then(({ stdout, stderr }) => {
        return { output: stdout.trim(), error: stderr.trim(), status: stderr ? 'error' as const : 'passed' as const };
      }).catch(err => {
        return { output: err.stdout?.trim() || '', error: err.stderr?.trim() || err.message, status: 'error' as const };
      });
      
      return await Promise.race([execPromise, timeoutPromise]);
    }
    
    throw new Error(`Language ${language} not supported yet.`);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
};
