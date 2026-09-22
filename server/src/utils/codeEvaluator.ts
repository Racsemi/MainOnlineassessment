// Compilers supported via Wandbox API
const COMPILER_MAP: Record<string, string> = {
  'PYTHON': 'cpython-3.10.15',
  'JS': 'nodejs-20.17.0',
  'JAVASCRIPT': 'nodejs-20.17.0',
  'JAVA': 'openjdk-jdk-21+35',
  'CPP': 'gcc-13.2.0',
  'C++': 'gcc-13.2.0',
  'C': 'gcc-13.2.0-c'
};

export interface TestCaseInput {
  id?: string;
  input: string | null;
  expectedOutput: string | null;
  isHidden?: boolean;
}

export interface TestCaseResult {
  input: string;
  expectedOutput: string;
  actualOutput: string;
  compilerError?: string;
  executionTimeMs?: number;
  passed: boolean;
  isHidden?: boolean;
}

export interface EvaluationResult {
  results: TestCaseResult[];
  passedCount: number;
  totalCount: number;
  allottedScore: number;
  maxMarks: number;
  totalTimeMs?: number;
}

/**
 * Normalizes output strings for consistent comparison across platforms.
 * Removes carriage returns and trims leading/trailing whitespace.
 */
export function normalizeOutput(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .trim();
}

/**
 * Prepares source code for Wandbox execution.
 * E.g., removes 'public' from Java class declarations so any class name compiles as prog.java.
 */
export function prepareCode(code: string, language: string): string {
  if (!code) return '';
  const normLang = (language || '').toUpperCase().trim();
  if (normLang === 'JAVA') {
    return code.replace(/public\s+class\s+/g, 'class ');
  }
  return code;
}

/**
 * Executes a single test case using the Wandbox API with a 10s timeout and timing.
 */
export async function runSingleTestCase(
  compiler: string,
  processedCode: string,
  testCase: TestCaseInput
): Promise<TestCaseResult> {
  const inputStr = testCase.input !== undefined && testCase.input !== null ? String(testCase.input) : '';
  const expectedStr = testCase.expectedOutput !== undefined && testCase.expectedOutput !== null ? String(testCase.expectedOutput) : '';

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);
  const startTime = Date.now();

  try {
    const payload = {
      compiler,
      code: processedCode,
      stdin: inputStr
    };

    const response = await fetch('https://wandbox.org/api/compile.json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      return {
        input: inputStr,
        expectedOutput: expectedStr,
        actualOutput: `Execution error (${response.status}): ${errText}`,
        compilerError: errText,
        executionTimeMs: duration,
        passed: false,
        isHidden: !!testCase.isHidden
      };
    }

    const data = (await response.json()) as any;
    const stdout = (data?.program_output || '').trim();
    const stderr = (data?.program_error || '').trim();
    const compilerErr = (data?.compiler_error || '').trim();
    const rawOutput = (stdout || compilerErr || stderr || '').trim();
    const passed = normalizeOutput(rawOutput) === normalizeOutput(expectedStr);

    return {
      input: inputStr,
      expectedOutput: expectedStr,
      actualOutput: rawOutput,
      compilerError: compilerErr || stderr || undefined,
      executionTimeMs: duration,
      passed,
      isHidden: !!testCase.isHidden
    };
  } catch (err: any) {
    clearTimeout(timeoutId);
    const duration = Date.now() - startTime;
    return {
      input: inputStr,
      expectedOutput: expectedStr,
      actualOutput: err.name === 'AbortError' ? 'Execution Timed Out (10s limit)' : (err?.message || 'Execution error'),
      compilerError: err?.message,
      executionTimeMs: duration,
      passed: false,
      isHidden: !!testCase.isHidden
    };
  }
}

/**
 * Runs code against an array of test cases and allots marks proportionally based on passed test cases.
 */
export async function evaluateCodingSubmission(
  language: string,
  code: string,
  testCases: TestCaseInput[],
  maxMarks: number = 10
): Promise<EvaluationResult> {
  const normLang = (language || '').toUpperCase().trim();
  const compiler = COMPILER_MAP[normLang] || COMPILER_MAP['PYTHON'];
  const processedCode = prepareCode(code, normLang);

  if (!code || !code.trim() || !testCases || testCases.length === 0) {
    return {
      results: (testCases || []).map(tc => ({
        input: tc.input || '',
        expectedOutput: tc.expectedOutput || '',
        actualOutput: !code || !code.trim() ? 'No code submitted' : 'No test cases configured',
        passed: false,
        isHidden: !!tc.isHidden
      })),
      passedCount: 0,
      totalCount: testCases?.length || 0,
      allottedScore: 0,
      maxMarks,
      totalTimeMs: 0
    };
  }

  const results: TestCaseResult[] = [];
  const evalStartTime = Date.now();

  // Run test cases sequentially to avoid rate-limiting Wandbox
  for (const tc of testCases) {
    const res = await runSingleTestCase(compiler, processedCode, tc);
    results.push(res);
  }

  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  const totalTimeMs = Date.now() - evalStartTime;

  let allottedScore = 0;
  if (totalCount > 0) {
    if (passedCount === totalCount) {
      allottedScore = maxMarks;
    } else if (passedCount === 0) {
      allottedScore = 0;
    } else {
      allottedScore = Math.max(1, Math.round((passedCount / totalCount) * maxMarks));
    }
  }

  return {
    results,
    passedCount,
    totalCount,
    allottedScore,
    maxMarks,
    totalTimeMs
  };
}

/**
 * Runs code with custom stdin input for admin testing.
 */
export async function runCustomExecution(
  language: string,
  code: string,
  customStdin: string = ''
): Promise<{ output: string; compilerError?: string; executionTimeMs: number; success: boolean }> {
  const normLang = (language || '').toUpperCase().trim();
  const compiler = COMPILER_MAP[normLang] || COMPILER_MAP['PYTHON'];
  const processedCode = prepareCode(code, normLang);

  const res = await runSingleTestCase(compiler, processedCode, {
    input: customStdin,
    expectedOutput: ''
  });

  return {
    output: res.actualOutput,
    compilerError: res.compilerError,
    executionTimeMs: res.executionTimeMs || 0,
    success: !res.compilerError && !res.actualOutput.includes('Execution error')
  };
}

