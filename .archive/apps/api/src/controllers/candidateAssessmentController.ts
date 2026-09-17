import { Request, Response } from 'express';
import { prisma } from '@racsemi/database';
import { CandidateAssessmentStatus, QuestionType, ExecutionStatus, TimingMode } from '@racsemi/shared';
import { evaluateAssessmentSession } from '../services/scoringService';
import { enqueueCodeExecution } from '../services/queueService';

/**
 * 1. Verify invitation token and return sanitized assessment instructions & structure
 * CRITICAL SECURITY: Never return correct answers or hidden test cases!
 */
export async function getAssessmentByToken(req: Request, res: Response) {
  try {
    const { token } = req.params;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Token is required' });
    }

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        candidate: { select: { id: true, name: true, email: true } },
        assessment: {
          include: {
            organization: { select: { name: true, logoUrl: true } },
            sections: {
              orderBy: { orderIndex: 'asc' },
              select: {
                id: true,
                title: true,
                description: true,
                orderIndex: true,
                durationMinutes: true,
                marks: true,
                questionCount: true,
                isMandatory: true
              }
            }
          }
        },
        candidateSession: {
          select: {
            id: true,
            status: true,
            startedAt: true,
            expiresAt: true,
            submittedAt: true
          }
        }
      }
    });

    if (!invitation) {
      return res.status(404).json({ success: false, message: 'Invalid assessment invitation link' });
    }

    if (new Date() > invitation.expiresAt) {
      return res.status(403).json({ success: false, message: 'This assessment invitation has expired' });
    }

    if (invitation.status === CandidateAssessmentStatus.REVOKED) {
      return res.status(403).json({ success: false, message: 'This assessment invitation has been revoked' });
    }

    // Update status to OPENED if first time opened
    if (invitation.status === CandidateAssessmentStatus.INVITED) {
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: CandidateAssessmentStatus.OPENED }
      });
    }

    return res.json({
      success: true,
      data: {
        invitationId: invitation.id,
        candidate: invitation.candidate,
        assessment: {
          id: invitation.assessment.id,
          title: invitation.assessment.title,
          description: invitation.assessment.description,
          role: invitation.assessment.role,
          difficulty: invitation.assessment.difficulty,
          durationMinutes: invitation.assessment.durationMinutes,
          timingMode: invitation.assessment.timingMode,
          totalMarks: invitation.assessment.totalMarks,
          integrityMonitoring: invitation.assessment.integrityMonitoring,
          proctoringMode: invitation.assessment.proctoringMode,
          instructions: invitation.assessment.instructions,
          allowedLanguages: invitation.assessment.allowedLanguages ? JSON.parse(invitation.assessment.allowedLanguages) : ['python', 'javascript', 'typescript', 'cpp', 'java', 'go'],
          organization: invitation.assessment.organization,
          sections: invitation.assessment.sections
        },
        existingSession: invitation.candidateSession
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 2. Start Assessment Session
 * Creates an immutable snapshot and server-authoritative timer
 */
export async function startCandidateSession(req: Request, res: Response) {
  try {
    const { token, deviceFingerprint, systemCheckSummary } = req.body;
    if (!token) {
      return res.status(400).json({ success: false, message: 'Invitation token is required' });
    }

    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: {
        assessment: {
          include: {
            sections: {
              orderBy: { orderIndex: 'asc' },
              include: {
                assessmentQuestions: {
                  orderBy: { orderIndex: 'asc' },
                  include: {
                    question: {
                      include: {
                        options: {
                          orderBy: { orderIndex: 'asc' },
                          select: {
                            id: true,
                            optionKey: true,
                            content: true,
                            orderIndex: true
                            // OMIT isCorrect and explanation
                          }
                        },
                        codingDetails: {
                          include: {
                            testCases: {
                              where: { isHidden: false }, // OMIT hidden test cases
                              orderBy: { orderIndex: 'asc' },
                              select: {
                                id: true,
                                input: true,
                                expectedOutput: true,
                                explanation: true,
                                orderIndex: true
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        candidateSession: true
      }
    });

    if (!invitation) {
      return res.status(404).json({ success: false, message: 'Invitation not found' });
    }

    if (new Date() > invitation.expiresAt) {
      return res.status(403).json({ success: false, message: 'Invitation has expired' });
    }

    const assessment = invitation.assessment;
    let session = invitation.candidateSession;

    if (!session) {
      const now = new Date();

      if (assessment.startWindow && now < assessment.startWindow) {
        return res.status(403).json({ success: false, message: 'This assessment is not open yet. Please check the scheduled start time.' });
      }

      if (assessment.endWindow && now > assessment.endWindow) {
        return res.status(403).json({ success: false, message: 'This assessment window has already closed.' });
      }

      const expiresAt = new Date(now.getTime() + assessment.durationMinutes * 60 * 1000);

      // Randomize logic
      const snapshotSections = assessment.sections.map(sec => {
        let questions = sec.assessmentQuestions.map(aq => ({
          id: aq.question.id,
          title: aq.question.title,
          problemStatement: aq.question.problemStatement,
          questionType: aq.question.questionType,
          difficulty: aq.question.difficulty,
          category: aq.question.category,
          score: aq.customScore ?? aq.question.score,
          negativeScore: aq.question.negativeScore,
          options: aq.question.options,
          codingDetails: aq.question.codingDetails ? {
            inputFormat: aq.question.codingDetails.inputFormat,
            outputFormat: aq.question.codingDetails.outputFormat,
            constraints: aq.question.codingDetails.constraints,
            sampleCases: aq.question.codingDetails.sampleCasesJson ? JSON.parse(aq.question.codingDetails.sampleCasesJson) : [],
            starterCode: aq.question.codingDetails.starterCodeJson ? JSON.parse(aq.question.codingDetails.starterCodeJson) : {},
            sampleTestCases: aq.question.codingDetails.testCases
          } : null
        }));

        if (assessment.randomizeQuestions) {
          questions = questions.sort(() => Math.random() - 0.5);
        }

        if (assessment.randomizeOptions) {
          questions.forEach(q => {
            if (q.options && q.options.length > 0) {
              q.options = [...q.options].sort(() => Math.random() - 0.5);
            }
          });
        }

        return {
          id: sec.id,
          title: sec.title,
          description: sec.description,
          durationMinutes: sec.durationMinutes,
          marks: sec.marks,
          questions
        };
      });

      // Snapshot structure with sensitive fields stripped
      const snapshot = {
        assessmentId: assessment.id,
        title: assessment.title,
        durationMinutes: assessment.durationMinutes,
        timingMode: assessment.timingMode,
        sections: snapshotSections
      };

      session = await prisma.candidateSession.create({
        data: {
          invitationId: invitation.id,
          candidateId: invitation.candidateId,
          assessmentId: assessment.id,
          status: CandidateAssessmentStatus.IN_PROGRESS,
          startedAt: now,
          expiresAt: expiresAt,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          deviceFingerprint,
          systemCheckSummary: systemCheckSummary ? JSON.stringify(systemCheckSummary) : null,
          snapshotJson: JSON.stringify(snapshot)
        }
      });

      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: CandidateAssessmentStatus.STARTED }
      });
    }

    const remainingSeconds = Math.max(0, Math.floor(((session.expiresAt?.getTime() || Date.now()) - Date.now()) / 1000));

    return res.json({
      success: true,
      message: 'Assessment session started',
      data: {
        sessionId: session.id,
        status: session.status,
        startedAt: session.startedAt,
        expiresAt: session.expiresAt,
        remainingSeconds,
        snapshot: JSON.parse(session.snapshotJson || '{}')
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 3. Recover Session State (Autosave restoration & remaining time)
 */
export async function getCandidateSession(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const session = await prisma.candidateSession.findUnique({
      where: { id },
      include: {
        assessment: true,
        candidateAnswers: true,
        codingSubmissions: {
          where: { isDraft: true }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    const now = Date.now();
    const expiresAt = session.expiresAt ? session.expiresAt.getTime() : now;
    let remainingSeconds = Math.max(0, Math.floor((expiresAt - now) / 1000));

    // If server timer has expired and session is still marked IN_PROGRESS, auto-submit!
    if (remainingSeconds <= 0 && session.status === CandidateAssessmentStatus.IN_PROGRESS) {
      await prisma.candidateSession.update({
        where: { id: session.id },
        data: {
          status: CandidateAssessmentStatus.AUTO_SUBMITTED,
          submittedAt: new Date()
        }
      });
      await evaluateAssessmentSession(session.id);
      return res.json({
        success: true,
        isExpired: true,
        message: 'Assessment time expired and was auto-submitted',
        data: { status: CandidateAssessmentStatus.AUTO_SUBMITTED, remainingSeconds: 0 }
      });
    }

    return res.json({
      success: true,
      data: {
        sessionId: session.id,
        status: session.status,
        remainingSeconds,
        currentSectionIndex: session.currentSectionIndex,
        currentQuestionIndex: session.currentQuestionIndex,
        snapshot: JSON.parse(session.snapshotJson || '{}'),
        savedAnswers: session.candidateAnswers.map(a => ({
          questionId: a.questionId,
          selectedOptions: a.selectedOptionsJson ? JSON.parse(a.selectedOptionsJson) : [],
          status: a.status,
          timeSpentSeconds: a.timeSpentSeconds
        })),
        savedCodingDrafts: session.codingSubmissions.map(c => ({
          questionId: c.questionId,
          language: c.language,
          sourceCode: c.sourceCode
        }))
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 4. Autosave candidate state
 */
export async function autosaveCandidateSession(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const { currentSectionIndex, currentQuestionIndex, answer, codingDraft } = req.body;

    const session = await prisma.candidateSession.findUnique({
      where: { id },
      select: { id: true, status: true, expiresAt: true }
    });

    if (!session || session.status === CandidateAssessmentStatus.SUBMITTED || session.status === CandidateAssessmentStatus.AUTO_SUBMITTED) {
      return res.status(400).json({ success: false, message: 'Session is no longer active' });
    }

    // Save Section/Question Navigation State
    if (typeof currentSectionIndex === 'number' || typeof currentQuestionIndex === 'number') {
      await prisma.candidateSession.update({
        where: { id },
        data: {
          currentSectionIndex: currentSectionIndex ?? undefined,
          currentQuestionIndex: currentQuestionIndex ?? undefined
        }
      });
    }

    // Save MCQ Answer
    if (answer && answer.questionId) {
      await prisma.candidateAnswer.upsert({
        where: {
          sessionId_questionId: {
            sessionId: id,
            questionId: answer.questionId
          }
        },
        update: {
          selectedOptionsJson: answer.selectedOptions ? JSON.stringify(answer.selectedOptions) : null,
          status: answer.status || 'ANSWERED',
          timeSpentSeconds: { increment: answer.timeSpentIncrement || 0 }
        },
        create: {
          sessionId: id,
          questionId: answer.questionId,
          selectedOptionsJson: answer.selectedOptions ? JSON.stringify(answer.selectedOptions) : null,
          status: answer.status || 'ANSWERED',
          timeSpentSeconds: answer.timeSpentIncrement || 0
        }
      });
    }

    // Save Coding Draft
    if (codingDraft && codingDraft.questionId && codingDraft.sourceCode !== undefined) {
      const existingDraft = await prisma.codingSubmission.findFirst({
        where: { sessionId: id, questionId: codingDraft.questionId, isDraft: true }
      });

      if (existingDraft) {
        await prisma.codingSubmission.update({
          where: { id: existingDraft.id },
          data: {
            sourceCode: codingDraft.sourceCode,
            language: codingDraft.language || 'python'
          }
        });
      } else {
        await prisma.codingSubmission.create({
          data: {
            sessionId: id,
            questionId: codingDraft.questionId,
            sourceCode: codingDraft.sourceCode,
            language: codingDraft.language || 'python',
            isDraft: true
          }
        });
      }
    }

    return res.json({ success: true, savedAt: new Date() });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 5. Run candidate code against public/sample test cases
 */
export async function runCandidateCode(req: Request, res: Response) {
  try {
    const { questionId, language, sourceCode, customInput } = req.body;

    if (!questionId || !language || sourceCode === undefined) {
      return res.status(400).json({ success: false, message: 'Missing questionId, language or sourceCode' });
    }

    const codingDetails = await prisma.codingQuestion.findUnique({
      where: { questionId },
      include: {
        testCases: {
          where: { isHidden: false }, // Only evaluate against sample test cases
          orderBy: { orderIndex: 'asc' }
        }
      }
    });

    if (!codingDetails) {
      return res.status(404).json({ success: false, message: 'Coding question details not found' });
    }

    let testCasesToRun = codingDetails.testCases.map(tc => ({
      id: tc.id,
      input: tc.input,
      expectedOutput: tc.expectedOutput,
      isHidden: false
    }));

    if (customInput !== undefined && customInput !== null) {
      testCasesToRun = [{
        id: 'custom-test',
        input: customInput,
        expectedOutput: '',
        isHidden: false
      }];
    }

    const queueResponse = await enqueueCodeExecution({
      language,
      sourceCode,
      questionId,
      customInput,
      timeLimitMs: codingDetails.timeLimitMs || 5000,
      memoryLimitMb: codingDetails.memoryLimitMb || 256,
      isRunOnly: true
    }, true);

    if (queueResponse.status === 'pending') {
      return res.json({
        success: true,
        message: queueResponse.message,
        data: { jobId: queueResponse.jobId, status: 'PENDING' }
      });
    }

    return res.json({
      success: true,
      data: queueResponse.result
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 6. Submit candidate code for coding question (Evaluates ALL test cases inside sandbox)
 */
export async function submitCandidateCode(req: Request, res: Response) {
  try {
    const { sessionId, questionId, language, sourceCode } = req.body;

    if (!sessionId || !questionId || !language || !sourceCode) {
      return res.status(400).json({ success: false, message: 'SessionId, questionId, language, and sourceCode are required' });
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      include: {
        codingDetails: {
          include: {
            testCases: { orderBy: { orderIndex: 'asc' } }
          }
        }
      }
    });

    if (!question || !question.codingDetails) {
      return res.status(404).json({ success: false, message: 'Coding question not found' });
    }

    const queueResponse = await enqueueCodeExecution({
      submissionId: require('crypto').randomUUID(),
      sessionId,
      questionId,
      language,
      sourceCode,
      timeLimitMs: question.codingDetails.timeLimitMs || 5000,
      memoryLimitMb: question.codingDetails.memoryLimitMb || 256,
      isRunOnly: false
    }, true);

    if (queueResponse.status === 'pending') {
      return res.json({
        success: true,
        message: 'Code submitted and is executing in the background.',
        data: { jobId: queueResponse.jobId, status: 'PENDING' }
      });
    }

    const executionResult = queueResponse.result;

    return res.json({
      success: true,
      message: 'Code submitted successfully',
      data: {
        submissionId: executionResult.submissionId, // if passed back, or query latest submission
        status: executionResult.status,
        passedTestCases: executionResult.passedTestCases,
        totalTestCases: executionResult.totalTestCases,
        compileOutput: executionResult.compileOutput,
        sampleTestResults: executionResult.testResults?.filter((r: any) => !r.isHidden) || []
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * 7. Final Assessment Submission
 */
export async function submitCandidateAssessment(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const session = await prisma.candidateSession.findUnique({
      where: { id },
      include: { assessment: true, invitation: true }
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found' });
    }

    if (session.status === CandidateAssessmentStatus.SUBMITTED || session.status === CandidateAssessmentStatus.AUTO_SUBMITTED) {
      return res.json({
        success: true,
        message: 'Assessment was already submitted',
        data: { status: session.status }
      });
    }

    const now = new Date();
    await prisma.$transaction([
      prisma.candidateSession.update({
        where: { id },
        data: {
          status: CandidateAssessmentStatus.SUBMITTED,
          submittedAt: now
        }
      }),
      prisma.invitation.update({
        where: { id: session.invitationId },
        data: { status: CandidateAssessmentStatus.SUBMITTED }
      })
    ]);

    // Automatically score the assessment
    const evalResult = await evaluateAssessmentSession(id);

    return res.json({
      success: true,
      message: 'Assessment submitted successfully! Thank you for completing the RACSEMI assessment.',
      data: {
        status: CandidateAssessmentStatus.SUBMITTED,
        submittedAt: now,
        // Only return scores if showResultToCandidate is explicitly true
        results: session.assessment.showResultToCandidate ? evalResult : undefined
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
