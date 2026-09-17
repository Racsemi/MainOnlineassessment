// ==============================================================================
// RACSEMI Assess - Shared Types, Enums, Constants & Language Registry
// ==============================================================================

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  RECRUITER = 'RECRUITER',
  INTERVIEWER = 'INTERVIEWER',
  CANDIDATE = 'CANDIDATE'
}

export enum AssessmentStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  SCHEDULED = 'SCHEDULED',
  ACTIVE = 'ACTIVE',
  CLOSED = 'CLOSED',
  ARCHIVED = 'ARCHIVED'
}

export enum CandidateAssessmentStatus {
  INVITED = 'INVITED',
  OPENED = 'OPENED',
  STARTED = 'STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  SUBMITTED = 'SUBMITTED',
  AUTO_SUBMITTED = 'AUTO_SUBMITTED',
  EXPIRED = 'EXPIRED',
  REVOKED = 'REVOKED',
  DISQUALIFIED = 'DISQUALIFIED'
}

export enum TimingMode {
  TOTAL_ASSESSMENT_TIMER = 'TOTAL_ASSESSMENT_TIMER',
  SECTION_TIMER = 'SECTION_TIMER'
}

export enum ProctoringMode {
  OFF = 'OFF',
  BASIC = 'BASIC',
  WEBCAM = 'WEBCAM',
  SCREEN = 'SCREEN',
  ADVANCED = 'ADVANCED'
}

export enum QuestionType {
  MCQ_SINGLE = 'MCQ_SINGLE',
  MCQ_MULTIPLE = 'MCQ_MULTIPLE',
  CODING = 'CODING',
  TRUE_FALSE = 'TRUE_FALSE',
  FILL_BLANK = 'FILL_BLANK',
  SQL = 'SQL'
}

export enum DifficultyLevel {
  EASY = 'EASY',
  MEDIUM = 'MEDIUM',
  HARD = 'HARD'
}

export enum AnswerStatus {
  UNANSWERED = 'UNANSWERED',
  ANSWERED = 'ANSWERED',
  MARKED_FOR_REVIEW = 'MARKED_FOR_REVIEW'
}

export enum ExecutionStatus {
  PENDING = 'PENDING',
  COMPILING = 'COMPILING',
  RUNNING = 'RUNNING',
  PASSED = 'PASSED',
  FAILED = 'FAILED',
  RUNTIME_ERROR = 'RUNTIME_ERROR',
  COMPILATION_ERROR = 'COMPILATION_ERROR',
  TIME_LIMIT_EXCEEDED = 'TIME_LIMIT_EXCEEDED',
  MEMORY_LIMIT_EXCEEDED = 'MEMORY_LIMIT_EXCEEDED',
  SECURITY_VIOLATION = 'SECURITY_VIOLATION'
}

export enum IntegrityEventType {
  TAB_SWITCH = 'TAB_SWITCH',
  WINDOW_BLUR = 'WINDOW_BLUR',
  WINDOW_FOCUS = 'WINDOW_FOCUS',
  FULLSCREEN_EXIT = 'FULLSCREEN_EXIT',
  COPY_ATTEMPT = 'COPY_ATTEMPT',
  PASTE_ATTEMPT = 'PASTE_ATTEMPT',
  MULTIPLE_SESSION = 'MULTIPLE_SESSION',
  SCREEN_SHARE_STOPPED = 'SCREEN_SHARE_STOPPED',
  WEBCAM_UNAVAILABLE = 'WEBCAM_UNAVAILABLE',
  MICROPHONE_UNAVAILABLE = 'MICROPHONE_UNAVAILABLE',
  NETWORK_DISCONNECT = 'NETWORK_DISCONNECT',
  NETWORK_RECONNECT = 'NETWORK_RECONNECT',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY'
}

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export enum RecruiterDecision {
  PENDING = 'PENDING',
  SHORTLISTED = 'SHORTLISTED',
  REJECTED = 'REJECTED',
  UNDER_REVIEW = 'UNDER_REVIEW'
}

export enum MultipleCorrectScoringPolicy {
  EXACT_MATCH = 'EXACT_MATCH',
  PARTIAL_CREDIT = 'PARTIAL_CREDIT',
  ALL_OR_NOTHING = 'ALL_OR_NOTHING'
}

// ------------------------------------------------------------------------------
// Language Registry Definition
// ------------------------------------------------------------------------------

export interface LanguageDefinition {
  languageId: string;
  displayName: string;
  version: string;
  fileExtension: string;
  monacoLanguage: string;
  compileCommand?: string;
  runCommand: string;
  timeMultiplier: number;
  memoryLimitMb: number;
  enabled: boolean;
  defaultStarterCode: string;
}

export const LANGUAGE_REGISTRY: Record<string, LanguageDefinition> = {
  python: {
    languageId: 'python',
    displayName: 'Python 3',
    version: '3.11',
    fileExtension: 'py',
    monacoLanguage: 'python',
    runCommand: 'python3 solution.py',
    timeMultiplier: 1.5,
    memoryLimitMb: 256,
    enabled: true,
    defaultStarterCode: `import sys

def solve():
    # Read all inputs from standard input
    input_data = sys.stdin.read().split()
    if not input_data:
        return
    # Write solution here
    print("Output")

if __name__ == "__main__":
    solve()
`
  },
  javascript: {
    languageId: 'javascript',
    displayName: 'JavaScript (Node.js)',
    version: '20.x',
    fileExtension: 'js',
    monacoLanguage: 'javascript',
    runCommand: 'node solution.js',
    timeMultiplier: 1.2,
    memoryLimitMb: 256,
    enabled: true,
    defaultStarterCode: `const fs = require('fs');

function solve() {
    const input = fs.readFileSync(0, 'utf-8').trim();
    if (!input) return;
    // Write solution here
    console.log("Output");
}

solve();
`
  },
  typescript: {
    languageId: 'typescript',
    displayName: 'TypeScript',
    version: '5.x',
    fileExtension: 'ts',
    monacoLanguage: 'typescript',
    compileCommand: 'npx tsc solution.ts --outDir ./dist',
    runCommand: 'node ./dist/solution.js',
    timeMultiplier: 1.5,
    memoryLimitMb: 256,
    enabled: true,
    defaultStarterCode: `import * as fs from 'fs';

function solve(): void {
    const input: string = fs.readFileSync(0, 'utf-8').trim();
    if (!input) return;
    // Write solution here
    console.log("Output");
}

solve();
`
  },
  cpp: {
    languageId: 'cpp',
    displayName: 'C++ (g++ 17)',
    version: '17',
    fileExtension: 'cpp',
    monacoLanguage: 'cpp',
    compileCommand: 'g++ -O2 -std=c++17 solution.cpp -o solution',
    runCommand: './solution',
    timeMultiplier: 1.0,
    memoryLimitMb: 256,
    enabled: true,
    defaultStarterCode: `#include <iostream>
#include <vector>
#include <string>
#include <algorithm>

using namespace std;

int main() {
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
    
    // Write solution here
    
    return 0;
}
`
  },
  java: {
    languageId: 'java',
    displayName: 'Java (OpenJDK 17)',
    version: '17',
    fileExtension: 'java',
    monacoLanguage: 'java',
    compileCommand: 'javac Solution.java',
    runCommand: 'java Solution',
    timeMultiplier: 2.0,
    memoryLimitMb: 512,
    enabled: true,
    defaultStarterCode: `import java.util.*;
import java.io.*;

public class Solution {
    public static void main(String[] args) throws Exception {
        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));
        String line = br.readLine();
        if (line == null) return;
        
        // Write solution here
    }
}
`
  },
  go: {
    languageId: 'go',
    displayName: 'Go (Golang)',
    version: '1.22',
    fileExtension: 'go',
    monacoLanguage: 'go',
    compileCommand: 'go build -o solution solution.go',
    runCommand: './solution',
    timeMultiplier: 1.0,
    memoryLimitMb: 256,
    enabled: true,
    defaultStarterCode: `package main

import (
    "bufio"
    "fmt"
    "os"
)

func main() {
    scanner := bufio.NewScanner(os.Stdin)
    for scanner.Scan() {
        _ = scanner.Text()
        // Write solution here
    }
    fmt.Println("Output")
}
`
  }
};

// ------------------------------------------------------------------------------
// Integrity Weight Configuration
// ------------------------------------------------------------------------------

export const INTEGRITY_WEIGHTS: Record<IntegrityEventType, number> = {
  [IntegrityEventType.TAB_SWITCH]: 3,
  [IntegrityEventType.WINDOW_BLUR]: 2,
  [IntegrityEventType.WINDOW_FOCUS]: 0,
  [IntegrityEventType.FULLSCREEN_EXIT]: 4,
  [IntegrityEventType.COPY_ATTEMPT]: 3,
  [IntegrityEventType.PASTE_ATTEMPT]: 4,
  [IntegrityEventType.MULTIPLE_SESSION]: 10,
  [IntegrityEventType.SCREEN_SHARE_STOPPED]: 6,
  [IntegrityEventType.WEBCAM_UNAVAILABLE]: 5,
  [IntegrityEventType.MICROPHONE_UNAVAILABLE]: 3,
  [IntegrityEventType.NETWORK_DISCONNECT]: 1,
  [IntegrityEventType.NETWORK_RECONNECT]: 0,
  [IntegrityEventType.SUSPICIOUS_ACTIVITY]: 8
};

export function calculateRiskLevel(totalWeight: number): RiskLevel {
  if (totalWeight <= 4) return RiskLevel.LOW;
  if (totalWeight <= 12) return RiskLevel.MEDIUM;
  if (totalWeight <= 25) return RiskLevel.HIGH;
  return RiskLevel.CRITICAL;
}

// ------------------------------------------------------------------------------
// Security Utilities (CSV Formula Injection Protection)
// ------------------------------------------------------------------------------

/**
 * Escapes values for CSV export to prevent formula injection attacks.
 * If a field begins with =, +, -, @, \t, or \r, it prepends a single quote.
 */
export function sanitizeCsvField(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  const dangerousChars = ['=', '+', '-', '@', '\t', '\r'];
  if (dangerousChars.some(char => str.startsWith(char))) {
    return `'${str.replace(/"/g, '""')}`;
  }
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
