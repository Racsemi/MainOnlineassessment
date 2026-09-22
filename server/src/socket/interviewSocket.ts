import { Server as SocketIOServer, Socket } from 'socket.io';
import { prepareCode } from '../utils/codeEvaluator';
import axios from 'axios';


export interface CandidateQueueItem {
  socketId: string;
  candidateId: string;
  name: string;
  email: string;
  college?: string;
  branch?: string;
  joinedAt: number;
  deviceStatus: {
    audio: boolean;
    video: boolean;
  };
  status: 'waiting' | 'in_interview' | 'completed' | 'disconnected';
}

export interface InterviewProblem {
  id?: string;
  title: string;
  description: string;
  inputFormat?: string;
  outputFormat?: string;
  constraints?: string;
  starterCode?: string;
  language: string;
  testCases?: Array<{ input: string; expectedOutput: string }>;
}

export interface InterviewEvaluation {
  candidateId: string;
  candidateName: string;
  ratings: {
    problemSolving: number;
    codeQuality: number;
    communication: number;
    systemDesign: number;
  };
  feedback: string;
  recommendation: 'STRONG_HIRE' | 'HIRE' | 'CONSIDER' | 'REJECT';
  submittedAt: number;
}

export interface InterviewSessionState {
  sessionId: string;
  title?: string;
  adminSocketId: string | null;
  queue: CandidateQueueItem[];
  activeCandidate: CandidateQueueItem | null;
  currentProblem: InterviewProblem | null;
  editorState: {
    code: string;
    language: string;
    isLocked: boolean;
    updatedAt: number;
  };
  evaluations: Record<string, InterviewEvaluation>;
}

// In-memory sessions store
const sessions: Map<string, InterviewSessionState> = new Map();

function getOrCreateSession(sessionId: string): InterviewSessionState {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      sessionId,
      title: `Interview Session #${sessionId.slice(0, 8)}`,
      adminSocketId: null,
      queue: [],
      activeCandidate: null,
      currentProblem: null,
      editorState: {
        code: `// Welcome to the Live Technical Interview\n// Write your solution below\n\nfunction solution() {\n  // Type your code here\n  console.log("Hello from Racsemi Live Interview!");\n}\n\nsolution();\n`,
        language: 'javascript',
        isLocked: false,
        updatedAt: Date.now(),
      },
      evaluations: {},
    });
  }
  return sessions.get(sessionId)!;
}

/**
 * Execute arbitrary code for live interview running
 */
async function runLiveCode(code: string, language: string, stdin?: string) {
  const normLang = (language || 'javascript').toUpperCase().trim();
  const compilerMap: Record<string, string> = {
    PYTHON: 'cpython-3.10.15',
    JS: 'nodejs-20.17.0',
    JAVASCRIPT: 'nodejs-20.17.0',
    JAVA: 'openjdk-jdk-21+35',
    CPP: 'gcc-13.2.0',
    'C++': 'gcc-13.2.0',
    C: 'gcc-13.2.0-c',
  };

  const compiler = compilerMap[normLang] || 'nodejs-20.17.0';
  const preparedCode = prepareCode(code, normLang);

  const payload: any = {
    compiler,
    code: preparedCode,
    stdin: stdin || '',
    'compiler-option-raw': normLang === 'CPP' || normLang === 'C++' ? '-std=c++20' : '',
  };

  const startTime = Date.now();
  try {
    const res = await axios.post('https://wandbox.org/api/compile.json', payload, {
      timeout: 15000,
    });
    const duration = Date.now() - startTime;
    const output = (res.data.program_output || '').trim();
    const error = (res.data.compiler_error || res.data.program_error || '').trim();

    return {
      success: res.data.status === 0 || !error,
      output: output || error || '(No output produced)',
      error: error || undefined,
      executionTimeMs: duration,
      exitCode: res.data.status,
    };
  } catch (err: any) {
    return {
      success: false,
      output: '',
      error: `Execution error: ${err.message || 'Compiler service unavailable'}`,
      executionTimeMs: Date.now() - startTime,
      exitCode: 1,
    };
  }
}

export function registerInterviewSocket(io: SocketIOServer) {
  const interviewNamespace = io.of('/interview');

  interviewNamespace.on('connection', (socket: Socket) => {
    let currentSessionId: string | null = null;
    let currentUserRole: 'ADMIN' | 'CANDIDATE' | null = null;
    let candidateRecord: CandidateQueueItem | null = null;

    // --- 1. LOBBY JOIN ---
    socket.on('lobby:join', (data: {
      sessionId: string;
      role: 'ADMIN' | 'CANDIDATE';
      candidateData?: {
        id?: string;
        name: string;
        email: string;
        college?: string;
        branch?: string;
        deviceStatus?: { audio: boolean; video: boolean };
      };
    }) => {
      const { sessionId, role, candidateData } = data;
      currentSessionId = sessionId;
      currentUserRole = role;

      const session = getOrCreateSession(sessionId);
      socket.join(sessionId);

      if (role === 'ADMIN') {
        session.adminSocketId = socket.id;
        console.log(`[Interview] Admin joined session: ${sessionId} (${socket.id})`);
        
        // Send full session state to admin
        socket.emit('session:state', {
          sessionId,
          adminSocketId: socket.id,
          queue: session.queue,
          activeCandidate: session.activeCandidate,
          currentProblem: session.currentProblem,
          editorState: session.editorState,
          evaluations: session.evaluations,
        });
      } else {
        // Candidate joins queue
        const cid = candidateData?.id || `cand-${Date.now().toString(36)}`;
        
        // Check if candidate is already in queue or currently in interview
        const existingIdx = session.queue.findIndex(
          (c) => c.email === candidateData?.email || c.candidateId === cid
        );

        const newCandidateItem: CandidateQueueItem = {
          socketId: socket.id,
          candidateId: cid,
          name: candidateData?.name || 'Anonymous Candidate',
          email: candidateData?.email || '',
          college: candidateData?.college || '',
          branch: candidateData?.branch || '',
          joinedAt: existingIdx >= 0 ? session.queue[existingIdx].joinedAt : Date.now(),
          deviceStatus: candidateData?.deviceStatus || { audio: true, video: true },
          status: 'waiting',
        };

        if (existingIdx >= 0) {
          session.queue[existingIdx] = newCandidateItem;
        } else {
          session.queue.push(newCandidateItem);
        }

        candidateRecord = newCandidateItem;
        console.log(`[Interview] Candidate joined queue: ${newCandidateItem.name} (${socket.id})`);

        // Notify candidate of their current queue status
        const position = session.queue.filter(c => c.status === 'waiting').findIndex(c => c.socketId === socket.id) + 1;
        socket.emit('lobby:joined', {
          sessionId,
          candidate: newCandidateItem,
          position,
          totalWaiting: session.queue.filter(c => c.status === 'waiting').length,
          activeCandidate: session.activeCandidate,
        });

        // Broadcast updated queue to session
        interviewNamespace.to(sessionId).emit('lobby:queue-update', {
          queue: session.queue,
          activeCandidate: session.activeCandidate,
        });
      }
    });

    // --- 2. ADMIT CANDIDATE TO INTERVIEW ROOM ---
    socket.on('interview:admit', (data: { sessionId: string; candidateSocketId: string }) => {
      const session = getOrCreateSession(data.sessionId);
      if (session.adminSocketId !== socket.id) {
        return socket.emit('error', { message: 'Unauthorized: Only interviewer can admit candidates' });
      }

      const target = session.queue.find((c) => c.socketId === data.candidateSocketId);
      if (!target) {
        return socket.emit('error', { message: 'Candidate not found in queue' });
      }

      // If another candidate was in interview, set their status to completed
      if (session.activeCandidate && session.activeCandidate.socketId !== target.socketId) {
        const prev = session.queue.find(c => c.socketId === session.activeCandidate?.socketId);
        if (prev && prev.status === 'in_interview') {
          prev.status = 'completed';
        }
      }

      target.status = 'in_interview';
      session.activeCandidate = target;

      console.log(`[Interview] Admitted candidate: ${target.name} to room`);

      // Notify the admitted candidate
      interviewNamespace.to(target.socketId).emit('interview:admitted', {
        sessionId: data.sessionId,
        adminSocketId: session.adminSocketId,
        editorState: session.editorState,
        currentProblem: session.currentProblem,
      });

      // Notify admin
      socket.emit('interview:candidate-admitted', {
        candidate: target,
      });

      // Broadcast updated queue to all waiting candidates so positions update
      interviewNamespace.to(data.sessionId).emit('lobby:queue-update', {
        queue: session.queue,
        activeCandidate: session.activeCandidate,
      });
    });

    // --- 3. RETURN CANDIDATE TO LOBBY / QUEUE ---
    socket.on('interview:return-to-queue', (data: { sessionId: string; candidateSocketId: string }) => {
      const session = getOrCreateSession(data.sessionId);
      if (session.adminSocketId !== socket.id) return;

      const target = session.queue.find((c) => c.socketId === data.candidateSocketId);
      if (target) {
        target.status = 'waiting';
        if (session.activeCandidate?.socketId === target.socketId) {
          session.activeCandidate = null;
        }

        interviewNamespace.to(target.socketId).emit('interview:returned-to-lobby', {
          message: 'You have been placed back into the waiting room by the interviewer.',
        });

        interviewNamespace.to(data.sessionId).emit('lobby:queue-update', {
          queue: session.queue,
          activeCandidate: session.activeCandidate,
        });
      }
    });

    // --- 4. FINISH INTERVIEW FOR ACTIVE CANDIDATE ---
    socket.on('interview:finish-candidate', (data: {
      sessionId: string;
      candidateSocketId: string;
      evaluation?: InterviewEvaluation;
    }) => {
      const session = getOrCreateSession(data.sessionId);
      if (session.adminSocketId !== socket.id) return;

      const target = session.queue.find((c) => c.socketId === data.candidateSocketId);
      if (target) {
        target.status = 'completed';
        if (data.evaluation) {
          session.evaluations[target.candidateId] = data.evaluation;
        }
        if (session.activeCandidate?.socketId === target.socketId) {
          session.activeCandidate = null;
        }

        interviewNamespace.to(target.socketId).emit('interview:completed', {
          message: 'Thank you! Your interview has concluded.',
        });

        interviewNamespace.to(data.sessionId).emit('lobby:queue-update', {
          queue: session.queue,
          activeCandidate: session.activeCandidate,
          evaluations: session.evaluations,
        });
      }
    });

    // --- 5. WEBRTC SIGNALING (AUDIO / VIDEO / SCREEN) ---
    socket.on('webrtc:signal', (data: {
      sessionId: string;
      targetSocketId: string;
      signalData: any;
    }) => {
      // Direct relay to target peer
      interviewNamespace.to(data.targetSocketId).emit('webrtc:signal', {
        senderSocketId: socket.id,
        signalData: data.signalData,
      });
    });

    // --- 6. REAL-TIME CODE COLLABORATION ---
    socket.on('code:change', (data: {
      sessionId: string;
      code: string;
      language?: string;
    }) => {
      const session = getOrCreateSession(data.sessionId);
      session.editorState.code = data.code;
      if (data.language) {
        session.editorState.language = data.language;
      }
      session.editorState.updatedAt = Date.now();

      // Broadcast to other peers in room
      socket.to(data.sessionId).emit('code:sync', {
        code: data.code,
        language: session.editorState.language,
        senderSocketId: socket.id,
      });
    });

    // Cursor position sync
    socket.on('code:cursor', (data: {
      sessionId: string;
      cursor: { lineNumber: number; column: number };
      userName: string;
    }) => {
      socket.to(data.sessionId).emit('code:cursor-sync', {
        cursor: data.cursor,
        userName: data.userName,
        senderSocketId: socket.id,
      });
    });

    // Lock/Unlock editor
    socket.on('code:lock', (data: { sessionId: string; isLocked: boolean }) => {
      const session = getOrCreateSession(data.sessionId);
      if (session.adminSocketId !== socket.id) return;

      session.editorState.isLocked = data.isLocked;
      interviewNamespace.to(data.sessionId).emit('code:lock-sync', {
        isLocked: data.isLocked,
      });
    });

    // Push question from question bank to candidate
    socket.on('code:push-problem', (data: {
      sessionId: string;
      problem: InterviewProblem;
    }) => {
      const session = getOrCreateSession(data.sessionId);
      if (session.adminSocketId !== socket.id) return;

      session.currentProblem = data.problem;
      if (data.problem.starterCode) {
        session.editorState.code = data.problem.starterCode;
      }
      if (data.problem.language) {
        session.editorState.language = data.problem.language.toLowerCase();
      }

      interviewNamespace.to(data.sessionId).emit('code:problem-pushed', {
        problem: data.problem,
        editorState: session.editorState,
      });
    });

    // Code execution
    socket.on('code:run', async (data: {
      sessionId: string;
      code: string;
      language: string;
      customInput?: string;
    }) => {
      // Notify both that code execution has started
      interviewNamespace.to(data.sessionId).emit('code:run-start', {
        triggeredBy: socket.id,
      });

      const result = await runLiveCode(data.code, data.language, data.customInput);

      // Broadcast execution output to all participants in room
      interviewNamespace.to(data.sessionId).emit('code:run-result', {
        ...result,
        triggeredBy: socket.id,
      });
    });

    // --- 7. SAVE EVALUATION / SCORECARD ---
    socket.on('interview:save-evaluation', (data: {
      sessionId: string;
      evaluation: InterviewEvaluation;
    }) => {
      const session = getOrCreateSession(data.sessionId);
      if (session.adminSocketId !== socket.id) return;

      session.evaluations[data.evaluation.candidateId] = data.evaluation;
      socket.emit('interview:evaluation-saved', { success: true, candidateId: data.evaluation.candidateId });
    });

    // --- 8. DISCONNECT HANDLING ---
    socket.on('disconnect', () => {
      if (!currentSessionId) return;
      const session = sessions.get(currentSessionId);
      if (!session) return;

      if (session.adminSocketId === socket.id) {
        console.log(`[Interview] Admin disconnected from session: ${currentSessionId}`);
        session.adminSocketId = null;
        socket.to(currentSessionId).emit('admin:status', { online: false });
      } else {
        const cand = session.queue.find((c) => c.socketId === socket.id);
        if (cand) {
          console.log(`[Interview] Candidate disconnected: ${cand.name} (${socket.id})`);
          cand.status = 'disconnected';

          if (session.activeCandidate?.socketId === socket.id) {
            interviewNamespace.to(currentSessionId).emit('interview:candidate-disconnected', {
              candidate: cand,
            });
          }

          interviewNamespace.to(currentSessionId).emit('lobby:queue-update', {
            queue: session.queue,
            activeCandidate: session.activeCandidate,
          });
        }
      }
    });
  });
}
