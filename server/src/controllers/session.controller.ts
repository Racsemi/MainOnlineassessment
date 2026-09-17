import { Request, Response } from 'express';
import prisma from '../utils/db';

export const checkSession = async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { assessment: true, candidate: true }
    });
    
    if (!invitation) return res.status(404).json({ error: 'Invalid invitation' });
    
    if (invitation.assessment.status !== 'PUBLISHED') {
      return res.status(403).json({ error: 'This assessment is currently not active.' });
    }
    
    const now = new Date();
    if (invitation.assessment.startDate && now < invitation.assessment.startDate) {
      return res.status(403).json({ error: 'This assessment has not started yet.' });
    }
    if (invitation.assessment.endDate && now > invitation.assessment.endDate) {
      return res.status(403).json({ error: 'This assessment has already ended.' });
    }
    
    const settings = await prisma.platformSettings.findUnique({ where: { id: 'GLOBAL' } });

    res.json({
      title: invitation.assessment.title,
      isProctored: settings?.features ? (settings.features as any).isProctored : true,
      status: invitation.status,
      candidateName: invitation.candidate.name,
      candidate: { name: invitation.candidate.name, email: invitation.candidate.email },
      settings
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check session' });
  }
};

export const startSession = async (req: Request, res: Response) => {
  try {
    const { token } = req.body; // candidate's secure link token
    
    const invitation = await prisma.invitation.findUnique({
      where: { token },
      include: { 
        candidate: true, 
        assessment: {
          include: {
            sections: {
              include: {
                questions: {
                  include: { options: true }
                },
                codingQuestions: {
                  include: { testCases: true }
                }
              }
            }
          }
        } 
      }
    });
    
    if (!invitation) return res.status(404).json({ error: 'Invalid invitation' });
    if (invitation.status === 'EXPIRED') return res.status(403).json({ error: 'Invitation expired' });
    if (invitation.assessment.status !== 'PUBLISHED') {
      return res.status(403).json({ error: 'This assessment is currently not active.' });
    }
    
    const now = new Date();
    if (invitation.assessment.startDate && now < invitation.assessment.startDate) {
      return res.status(403).json({ error: 'This assessment has not started yet.' });
    }
    if (invitation.assessment.endDate && now > invitation.assessment.endDate) {
      return res.status(403).json({ error: 'This assessment has already ended.' });
    }

    // Check if session already exists
    let session = await prisma.candidateSession.findFirst({
      where: { candidateId: invitation.candidateId }
    });

    if (!session) {
      // Create server-authoritative timer bounds
      const now = new Date();
      const testDurationMinutes = Math.max(invitation.assessment.duration, 1);
      const expiresAt = new Date(now.getTime() + testDurationMinutes * 60000);
      
      session = await prisma.candidateSession.create({
        data: {
          candidateId: invitation.candidateId,
          startedAt: now,
          expiresAt: expiresAt,
          status: 'IN_PROGRESS'
        }
      });
      
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'USED' }
      });
    }

    if (session.status === 'COMPLETED') {
      return res.status(403).json({ error: 'Assessment already completed' });
    }

    // Determine if timer expired
    if (new Date() > session.expiresAt) {
      await prisma.candidateSession.update({
        where: { id: session.id },
        data: { status: 'COMPLETED', completedAt: new Date() }
      });
      return res.status(403).json({ error: 'Time expired. Assessment submitted automatically.' });
    }

    const settings = await prisma.platformSettings.findUnique({ where: { id: 'GLOBAL' } });

    res.json({ 
      session,
      assessment: invitation.assessment,
      candidate: { name: invitation.candidate.name, email: invitation.candidate.email },
      settings
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to start session' });
  }
};

export const saveAnswer = async (req: Request, res: Response) => {
  try {
    const { sessionId, questionId, selectedOptionIds, textAnswer, isMarkedForReview } = req.body;
    
    const answer = await prisma.candidateAnswer.upsert({
      where: { sessionId_questionId: { sessionId, questionId } },
      update: { selectedOptionIds, textAnswer, isMarkedForReview },
      create: { sessionId, questionId, selectedOptionIds, textAnswer, isMarkedForReview }
    });
    
    res.json(answer);
  } catch (error) {
    res.status(500).json({ error: 'Failed to save answer' });
  }
};

export const saveCodingDraft = async (req: Request, res: Response) => {
  try {
    const { sessionId, codingQuestionId, language, code } = req.body;
    
    const draft = await prisma.codingSubmission.upsert({
      where: { sessionId_codingQuestionId: { sessionId, codingQuestionId } },
      update: { language, code, status: 'DRAFT' },
      create: { sessionId, codingQuestionId, language, code, status: 'DRAFT' }
    });
    
    res.json(draft);
  } catch (error) {
    res.status(500).json({ error: 'Failed to save coding draft' });
  }
};

export const submitAssessment = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.body;
    
    const session = await prisma.candidateSession.update({
      where: { id: sessionId },
      data: { status: 'COMPLETED', completedAt: new Date() },
      include: { 
        answers: { include: { question: { include: { options: true } } } },
        codingAnswers: { include: { codingQuestion: true } },
        candidate: true
      }
    });
    
    let totalScore = 0;
    let maxScore = 0;

    // Evaluate MCQ / text answers
    for (const answer of session.answers) {
      const q = answer.question;
      maxScore += q.marks;
      let score = 0;

      if (q.type === 'SINGLE_CHOICE') {
        const correctOpt = q.options.find((o: any) => o.isCorrect);
        if (correctOpt && answer.selectedOptionIds[0] === correctOpt.id) {
          score = q.marks;
        } else if (correctOpt && answer.selectedOptionIds[0] !== correctOpt.id && q.negativeMarks) {
          score = -q.negativeMarks;
        }
      } else if (q.type === 'MULTIPLE_CHOICE') {
        const correctOpts = q.options.filter((o: any) => o.isCorrect).map((o: any) => o.id);
        const selected = answer.selectedOptionIds;
        if (correctOpts.length === selected.length && correctOpts.every((id: any) => selected.includes(id))) {
          score = q.marks;
        }
      } else if (q.type === 'SINGLE_LINE' || q.type === 'PARAGRAPH' || q.type === 'TRUE_FALSE') {
        if (q.expectedAnswer && answer.textAnswer) {
          if (q.expectedAnswer.trim().toLowerCase() === answer.textAnswer.trim().toLowerCase()) {
            score = q.marks;
          }
        }
      } else if (q.type === 'NUMERIC') {
        if (q.expectedAnswer && answer.textAnswer) {
          const expected = parseFloat(q.expectedAnswer);
          const actual = parseFloat(answer.textAnswer);
          const tol = q.tolerance || 0;
          if (!isNaN(expected) && !isNaN(actual) && Math.abs(expected - actual) <= tol) {
            score = q.marks;
          }
        }
      }

      await prisma.candidateAnswer.update({
        where: { id: answer.id },
        data: { score }
      });
      
      totalScore += score;
    }

    // Include coding questions in maxScore and mark as SUBMITTED
    // Coding questions are scored 0 at submit (manual/auto review later)
    // but their marks count toward maxScore so percentage is accurate
    for (const coding of session.codingAnswers) {
      const cq = coding.codingQuestion as any;
      if (cq) {
        maxScore += cq.marks || 10;
        // Mark as SUBMITTED (no longer DRAFT)
        await prisma.codingSubmission.update({
          where: { id: coding.id },
          data: { status: 'SUBMITTED' }
        });
        // Score stays 0 for now — admin can review and assign score manually
        // or auto-grading can run later
      }
    }

    const percentage = maxScore > 0 ? Math.max(0, (totalScore / maxScore) * 100) : 0;

    await prisma.assessmentResult.upsert({
      where: { candidateId_assessmentId: { candidateId: session.candidateId, assessmentId: session.candidate.assessmentId } },
      update: { totalScore, maxScore, percentage, status: 'EVALUATED' },
      create: { 
        candidateId: session.candidateId, 
        assessmentId: session.candidate.assessmentId,
        totalScore, maxScore, percentage, status: 'EVALUATED'
      }
    });
    
    res.json({ message: 'Assessment submitted successfully', session });
  } catch (error) {
    console.error('Submit error:', error);
    res.status(500).json({ error: 'Failed to submit assessment' });
  }
};

export const logIntegrityEvent = async (req: Request, res: Response) => {
  try {
    const { sessionId, eventType, screenshot } = req.body;
    await prisma.integrityEvent.create({
      data: { sessionId, eventType, screenshot, timestamp: new Date() }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to log event' });
  }
};

export const executeCode = async (req: Request, res: Response) => {
  try {
    const { language, code, testCases } = req.body;
    
    // Map language to Piston API format
    const langMap: Record<string, { lang: string, version: string }> = {
      'PYTHON': { lang: 'python', version: '3.10.0' },
      'JS': { lang: 'javascript', version: '18.15.0' },
      'JAVA': { lang: 'java', version: '15.0.2' },
      'CPP': { lang: 'c++', version: '10.2.0' }
    };
    
    const pistonLang = langMap[language];
    if (!pistonLang) return res.status(400).json({ error: 'Unsupported language' });

    const results = [];

    // Run tests sequentially
    for (const testCase of testCases) {
      const payload = {
        language: pistonLang.lang,
        version: pistonLang.version,
        files: [{ content: code }],
        stdin: testCase.input
      };
      
      const response = await fetch('https://emkc.org/api/v2/piston/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const data = await response.json();
      
      const output = data.run.stdout.trim() || data.run.stderr.trim();
      const passed = output === testCase.expectedOutput?.trim();
      
      results.push({
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        actualOutput: output,
        passed,
        isHidden: testCase.isHidden
      });
    }

    res.json({ results });
  } catch (error) {
    console.error('Code execution error:', error);
    res.status(500).json({ error: 'Failed to execute code' });
  }
};
