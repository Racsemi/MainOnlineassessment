import { Request, Response } from 'express';
import prisma from '../utils/db';
import { evaluateCodingSubmission, runCustomExecution } from '../utils/codeEvaluator';

export const createAssessment = async (req: Request, res: Response) => {
  try {
    const { title, description, duration, instructions, startDate, endDate, sections } = req.body;
    const totalDuration = sections ? sections.reduce((sum: number, sec: any) => sum + (Number(sec.duration) || 0), 0) : duration || 0;

    const assessment = await prisma.assessment.create({
      data: {
        title,
        description,
        duration: totalDuration,
        instructions,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        status: req.body.status || 'DRAFT',
        sections: sections ? {
          create: sections.map((sec: any, i: number) => ({
            name: sec.name || `Section ${i + 1}`,
            description: sec.description || '',
            duration: Number(sec.duration) || 0,
            order: i,
            questions: sec.questionIds && sec.questionIds.length > 0 ? {
              connect: sec.questionIds.map((id: string) => ({ id }))
            } : undefined
          }))
        } : undefined
      }
    });
    
    res.status(201).json(assessment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create assessment' });
  }
};

export const getAssessments = async (req: Request, res: Response) => {
  try {
    const assessments = await prisma.assessment.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { candidates: true }
        }
      }
    });
    res.json(assessments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assessments' });
  }
};

export const getAssessmentById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const assessment = await prisma.assessment.findUnique({
      where: { id },
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
    });
    
    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }
    
    res.json(assessment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch assessment' });
  }
};

export const updateAssessment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, duration, instructions, status, startDate, endDate, sections } = req.body;
    
    if (sections) {
      await prisma.section.deleteMany({ where: { assessmentId: id } });
    }

    const totalDuration = sections ? sections.reduce((sum: number, sec: any) => sum + (Number(sec.duration) || 0), 0) : duration || 0;

    const assessment = await prisma.assessment.update({
      where: { id },
      data: {
        title,
        description,
        duration: totalDuration,
        instructions,
        status: status || 'DRAFT',
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        sections: sections ? {
          create: sections.map((sec: any, i: number) => ({
            name: sec.name || `Section ${i + 1}`,
            description: sec.description || '',
            duration: Number(sec.duration) || 0,
            order: i,
            questions: sec.questionIds && sec.questionIds.length > 0 ? {
              connect: sec.questionIds.map((qId: string) => ({ id: qId }))
            } : undefined,
            codingQuestions: sec.codingQuestionIds && sec.codingQuestionIds.length > 0 ? {
              connect: sec.codingQuestionIds.map((qId: string) => ({ id: qId }))
            } : undefined
          }))
        } : undefined
      }
    });
    
    res.json(assessment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update assessment' });
  }
};

export const getAssessmentResults = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Fetch platform settings to map registrationForm field IDs (e.g. field_1 -> College, field_2 -> CGPA, field_3 -> Resume)
    const settings = await prisma.platformSettings.findUnique({
      where: { id: 'GLOBAL' }
    });
    const fieldLabelMap: Record<string, string> = {};
    if (settings?.registrationForm && Array.isArray(settings.registrationForm)) {
      for (const f of settings.registrationForm as any[]) {
        if (f.name && f.label) {
          fieldLabelMap[f.name] = f.label;
        }
      }
    }

    // Fetch assessment sections and all questions/coding questions to establish the FIXED total marks
    const assessment = await prisma.assessment.findUnique({
      where: { id },
      include: {
        sections: {
          include: {
            questions: { select: { id: true, marks: true, text: true, type: true, options: true, expectedAnswer: true } },
            codingQuestions: { select: { id: true, title: true, description: true, marks: true, testCases: true, allowedLanguages: true } }
          }
        }
      }
    });

    const [allMcqs, allCoding] = await Promise.all([
      prisma.question.findMany({
        where: { section: { assessmentId: id } },
        select: { id: true, marks: true, text: true, type: true, options: true, expectedAnswer: true }
      }),
      prisma.codingQuestion.findMany({
        where: { section: { assessmentId: id } },
        select: { id: true, title: true, description: true, marks: true, testCases: true, allowedLanguages: true }
      })
    ]);

    // Consolidate unique questions belonging to this assessment
    const questionMap = new Map<string, any>();
    for (const q of allMcqs) questionMap.set(q.id, q);
    for (const s of (assessment?.sections || [])) {
      for (const q of (s.questions || [])) questionMap.set(q.id, q);
    }
    const allAssessmentQuestions = Array.from(questionMap.values());

    const codingMap = new Map<string, any>();
    for (const cq of allCoding) codingMap.set(cq.id, cq);
    for (const s of (assessment?.sections || [])) {
      for (const cq of (s.codingQuestions || [])) codingMap.set(cq.id, cq);
    }
    const allAssessmentCoding = Array.from(codingMap.values());

    // Fixed total marks configured for the assessment
    const fixedMcqMaxScore = allAssessmentQuestions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
    let fixedCodingMaxScore = allAssessmentCoding.reduce((sum, cq) => sum + (Number(cq.marks) || 10), 0);
    let fixedAssessmentTotalMarks = fixedMcqMaxScore + fixedCodingMaxScore;

    // Target assessment total marks: 100 (or custom from query)
    const targetTotalMarks = Number(req.query.totalMarks) || 100;

    // If assessment questions sum to less than targetTotalMarks (e.g. 60 MCQ + 20 coding = 80),
    // allocate the remaining marks to the coding questions (e.g. 40 marks across coding questions)
    if (fixedAssessmentTotalMarks < targetTotalMarks && allAssessmentCoding.length > 0) {
      const remainingCodingMarks = Math.max(0, targetTotalMarks - fixedMcqMaxScore);
      const marksPerCoding = Math.round(remainingCodingMarks / allAssessmentCoding.length);
      for (const cq of allAssessmentCoding) {
        cq.marks = marksPerCoding;
        prisma.codingQuestion.update({
          where: { id: cq.id },
          data: { marks: marksPerCoding }
        }).catch(() => {});
      }
      fixedCodingMaxScore = remainingCodingMarks;
      fixedAssessmentTotalMarks = fixedMcqMaxScore + fixedCodingMaxScore;
    }

    const finalTotalMarks = fixedAssessmentTotalMarks > 0 ? Math.max(fixedAssessmentTotalMarks, targetTotalMarks) : targetTotalMarks;

    // Fetch all candidates belonging to this assessment to guarantee no candidate or result is missed
    const candidates = await prisma.candidate.findMany({
      where: { assessmentId: id },
      include: {
        results: { where: { assessmentId: id } },
        files: { select: { id: true, fieldName: true, fileName: true, createdAt: true } },
        sessions: {
          orderBy: { startedAt: 'desc' },
          include: { 
            integrityEvents: { orderBy: { timestamp: 'asc' } },
            answers: {
              include: { 
                question: {
                  include: { options: true }
                }
              }
            },
            codingAnswers: {
              include: { 
                codingQuestion: {
                  include: { testCases: true }
                } 
              }
            }
          }
        }
      }
    });

    const mapped = candidates.map(c => {
      const result = c.results[0];
      // Pick completed session first, or latest session
      const session = c.sessions.find(s => s.status === 'COMPLETED') || c.sessions[0];

      // Build complete coding submissions list, ensuring every assessment coding problem is present
      let codingSubmissions: any[] = [];
      if (allAssessmentCoding.length > 0) {
        codingSubmissions = allAssessmentCoding.map(cq => {
          const ca = (session?.codingAnswers || []).find((ans: any) => ans.codingQuestionId === cq.id || ans.codingQuestion?.id === cq.id);
          if (ca) {
            return {
              id: ca.id,
              codingQuestionId: cq.id,
              questionTitle: cq.title || 'Coding Question',
              questionDescription: cq.description || '',
              language: ca.language || 'PYTHON',
              status: ca.status || 'SUBMITTED',
              score: ca.score ?? 0,
              maxScore: cq.marks || 10,
              code: ca.code || '',
              testCases: (cq.testCases || []).map((tc: any) => ({
                input: tc.input,
                expectedOutput: tc.expectedOutput,
                isHidden: tc.isHidden
              }))
            };
          } else {
            return {
              id: `unattended-${cq.id}`,
              codingQuestionId: cq.id,
              questionTitle: cq.title || 'Coding Question',
              questionDescription: cq.description || '',
              language: 'PYTHON',
              status: 'NOT_ATTEMPTED',
              score: 0,
              maxScore: cq.marks || 10,
              code: '',
              testCases: (cq.testCases || []).map((tc: any) => ({
                input: tc.input,
                expectedOutput: tc.expectedOutput,
                isHidden: tc.isHidden
              }))
            };
          }
        });
      } else {
        codingSubmissions = (session?.codingAnswers || []).map((ca: any) => ({
          id: ca.id,
          questionTitle: ca.codingQuestion?.title || 'Coding Question',
          questionDescription: ca.codingQuestion?.description || '',
          language: ca.language,
          status: ca.status,
          score: ca.score ?? 0,
          maxScore: ca.codingQuestion?.marks || 10,
          code: ca.code,
          testCases: (ca.codingQuestion?.testCases || []).map((tc: any) => ({
            input: tc.input,
            expectedOutput: tc.expectedOutput,
            isHidden: tc.isHidden
          }))
        }));
      }

      // Map standard MCQ answers
      const submittedAnswerMap = new Map<string, any>();
      for (const ans of (session?.answers || [])) {
        submittedAnswerMap.set(ans.questionId, ans);
      }

      let standardAnswers: any[] = [];
      if (allAssessmentQuestions.length > 0) {
        standardAnswers = allAssessmentQuestions.map(q => {
          const ans = submittedAnswerMap.get(q.id);
          if (ans) {
            let responseText = ans.textAnswer || '';
            const selectedOpts = (q.options || []).filter((o: any) => (ans.selectedOptionIds || []).includes(o.id));
            if (selectedOpts.length > 0) {
              responseText = selectedOpts.map((o: any) => o.text).join(', ');
            }
            
            const correctOpts = (q.options || []).filter((o: any) => o.isCorrect);
            const correctAnswer = correctOpts.length > 0 
              ? correctOpts.map((o: any) => o.text).join(', ') 
              : (q.expectedAnswer || '');

            const isCorrect = (ans.score || 0) > 0;

            return {
              id: ans.id,
              questionId: q.id,
              questionText: q.text || 'Question',
              type: q.type || 'SINGLE_CHOICE',
              options: (q.options || []).map((o: any) => ({
                id: o.id,
                text: o.text,
                isCorrect: o.isCorrect,
                isSelected: (ans.selectedOptionIds || []).includes(o.id)
              })),
              selectedOptionIds: ans.selectedOptionIds || [],
              response: responseText,
              correctAnswer,
              isCorrect,
              score: ans.score ?? 0,
              maxScore: q.marks ?? 1,
              isUnanswered: false
            };
          } else {
            const correctOpts = (q.options || []).filter((o: any) => o.isCorrect);
            const correctAnswer = correctOpts.length > 0 
              ? correctOpts.map((o: any) => o.text).join(', ') 
              : (q.expectedAnswer || '');

            return {
              id: `unanswered-${q.id}`,
              questionId: q.id,
              questionText: q.text || 'Question',
              type: q.type || 'SINGLE_CHOICE',
              options: (q.options || []).map((o: any) => ({
                id: o.id,
                text: o.text,
                isCorrect: o.isCorrect,
                isSelected: false
              })),
              selectedOptionIds: [],
              response: 'Not Attempted',
              correctAnswer,
              isCorrect: false,
              score: 0,
              maxScore: q.marks ?? 1,
              isUnanswered: true
            };
          }
        });
      } else {
        standardAnswers = (session?.answers || []).map((ans: any) => {
          let responseText = ans.textAnswer || '';
          const selectedOpts = (ans.question?.options || []).filter((o: any) => (ans.selectedOptionIds || []).includes(o.id));
          if (selectedOpts.length > 0) {
            responseText = selectedOpts.map((o: any) => o.text).join(', ');
          }
          
          const correctOpts = (ans.question?.options || []).filter((o: any) => o.isCorrect);
          const correctAnswer = correctOpts.length > 0 
            ? correctOpts.map((o: any) => o.text).join(', ') 
            : (ans.question?.expectedAnswer || '');

          const isCorrect = (ans.score || 0) > 0;

          return {
            id: ans.id,
            questionId: ans.questionId,
            questionText: ans.question?.text || 'Question',
            type: ans.question?.type || 'SINGLE_CHOICE',
            options: (ans.question?.options || []).map((o: any) => ({
              id: o.id,
              text: o.text,
              isCorrect: o.isCorrect,
              isSelected: (ans.selectedOptionIds || []).includes(o.id)
            })),
            selectedOptionIds: ans.selectedOptionIds || [],
            response: responseText,
            correctAnswer,
            isCorrect,
            score: ans.score ?? 0,
            maxScore: ans.question?.marks ?? 0,
            isUnanswered: false
          };
        });
      }

      // Calculate candidate scores
      const mcqScore = standardAnswers.reduce((sum: number, a: any) => sum + (Number(a.score) || 0), 0);
      const codingScore = codingSubmissions.reduce((sum: number, a: any) => sum + (Number(a.score) || 0), 0);
      const totalScore = mcqScore + codingScore;

      // Fixed total marks and maximums
      const attendedMcqMax = standardAnswers.filter(a => !a.isUnanswered).reduce((sum: number, a: any) => sum + (Number(a.maxScore) || 0), 0);
      const attendedCodingMax = codingSubmissions.filter(c => c.status !== 'NOT_ATTEMPTED').reduce((sum: number, a: any) => sum + (Number(a.maxScore) || 10), 0);
      
      const mcqMaxScore = fixedMcqMaxScore > 0 ? fixedMcqMaxScore : attendedMcqMax;
      const codingMaxScore = fixedCodingMaxScore > 0 ? fixedCodingMaxScore : attendedCodingMax;
      const maxScore = finalTotalMarks;
      const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 1000) / 10 : 0;

      // Sync updated maxScore and totalScore to database so DB reflects 100 total marks and correct percentage
      if (result && (result.maxScore !== maxScore || Math.abs(result.totalScore - totalScore) > 0.05 || Math.abs(result.percentage - percentage) > 0.05)) {
        prisma.assessmentResult.update({
          where: { id: result.id },
          data: { maxScore, totalScore, percentage }
        }).catch(() => {});
      }

      // Resolve human-readable custom registration fields
      const customFieldsWithLabels: Record<string, { label: string, value: any }> = {};
      const rawCustom = (c.customFields as Record<string, any>) || {};
      for (const [k, v] of Object.entries(rawCustom)) {
        const label = fieldLabelMap[k] || (k === 'phone' ? 'Phone Number' : k);
        customFieldsWithLabels[k] = { label, value: v };
      }

      // Format profile data
      const phone = c.phone || rawCustom.phone || '';
      const college = c.college || rawCustom.field_1 || rawCustom.college || '';
      const cgpa = c.cgpa !== null && c.cgpa !== undefined ? String(c.cgpa) : (rawCustom.field_2 || rawCustom.cgpa || '');
      const branch = c.branch || rawCustom.branch || '';
      const status = result?.status || (session?.status === 'COMPLETED' ? 'EVALUATED' : (session?.status || 'INVITED'));

      return {
        id: result?.id || c.id,
        candidateId: c.id,
        name: c.name,
        email: c.email,
        phone,
        college,
        branch,
        cgpa,
        photo: c.photo,
        customFields: rawCustom,
        customFieldsWithLabels,
        files: c.files || [],
        score: totalScore,
        maxScore,
        percentage,
        mcqScore,
        mcqMaxScore,
        codingScore,
        codingMaxScore,
        status,
        sessionStatus: session?.status || 'NOT_STARTED',
        startedAt: session?.startedAt,
        completedAt: session?.completedAt,
        submittedAt: result?.createdAt || session?.completedAt,
        integrityEventsCount: session?.integrityEvents?.length || 0,
        integrityEvents: session?.integrityEvents || [],
        codingSubmissions,
        standardAnswers
      };
    });

    // Sort candidates by total score descending
    mapped.sort((a, b) => b.score - a.score);

    res.json(mapped);
  } catch (error) {
    console.error('getAssessmentResults error:', error);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
};

export const getPublicAssessment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const assessment = await prisma.assessment.findUnique({
      where: { id },
      select: { id: true, title: true, description: true, status: true, startDate: true, endDate: true }
    });
    
    if (!assessment) {
      return res.status(404).json({ error: 'Assessment not found' });
    }
    
    if (assessment.status !== 'PUBLISHED') {
      return res.status(403).json({ error: 'This assessment is currently not accepting registrations.' });
    }
    
    const now = new Date();
    if (assessment.startDate && now < assessment.startDate) {
      return res.status(403).json({ error: 'This assessment has not started yet.' });
    }
    if (assessment.endDate && now > assessment.endDate) {
      return res.status(403).json({ error: 'This assessment has already ended.' });
    }
    
    const settings = await prisma.platformSettings.findUnique({ where: { id: 'GLOBAL' } });
    
    res.json({ ...assessment, settings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch public assessment details' });
  }
};

export const deleteAssessment = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.assessment.delete({ where: { id } });
    res.json({ message: 'Assessment deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete assessment' });
  }
};

export const updateResultStatus = async (req: Request, res: Response) => {
  try {
    const { resultId } = req.params;
    const { status } = req.body;
    
    if (!['EVALUATED', 'SHORTLISTED', 'ON_HOLD', 'REJECTED'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    let result = await prisma.assessmentResult.findUnique({ where: { id: resultId } });
    if (!result) {
      result = await prisma.assessmentResult.findFirst({ where: { candidateId: resultId } });
    }

    if (result) {
      const updated = await prisma.assessmentResult.update({
        where: { id: result.id },
        data: { status }
      });
      return res.json(updated);
    }
    
    res.status(404).json({ error: 'Result not found' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update result status' });
  }
};

export const updateAnswerScore = async (req: Request, res: Response) => {
  try {
    const { resultId, answerId } = req.params;
    const { score, isCoding } = req.body;
    
    // update the answer score
    if (isCoding) {
      await prisma.codingSubmission.update({ where: { id: answerId }, data: { score: Number(score) } });
    } else {
      await prisma.candidateAnswer.update({ where: { id: answerId }, data: { score: Number(score) } });
    }
    
    // recalculate total score for AssessmentResult
    let result = await prisma.assessmentResult.findUnique({
      where: { id: resultId },
      include: { candidate: { include: { sessions: { include: { answers: true, codingAnswers: true } } } } }
    });

    if (!result) {
      result = await prisma.assessmentResult.findFirst({
        where: { candidateId: resultId },
        include: { candidate: { include: { sessions: { include: { answers: true, codingAnswers: true } } } } }
      });
    }
    
    if (result) {
      const session = result.candidate.sessions.find((s: any) => s.status === 'COMPLETED') || result.candidate.sessions[0];
      let newTotal = 0;
      session?.answers.forEach((a: any) => { newTotal += (a.score || 0); });
      session?.codingAnswers.forEach((c: any) => { newTotal += (c.score || 0); });
      
      const percentage = result.maxScore > 0 ? (newTotal / result.maxScore) * 100 : 0;
      
      const updatedResult = await prisma.assessmentResult.update({
        where: { id: result.id },
        data: { totalScore: newTotal, percentage }
      });
      return res.json({ updatedResult, newScore: score });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update score' });
  }
};

/**
 * Automatically evaluates all candidate coding submissions for an assessment based on test cases.
 * Allots marks proportionally to the number of test cases passed.
 */
export const evaluateAllAssessmentCodingSubmissions = async (req: Request, res: Response) => {
  try {
    const { id: assessmentId } = req.params;

    const candidates = await prisma.candidate.findMany({
      where: { assessmentId },
      include: {
        results: true,
        sessions: {
          orderBy: { startedAt: 'desc' },
          include: {
            answers: true,
            codingAnswers: {
              include: {
                codingQuestion: {
                  include: { testCases: true }
                }
              }
            }
          }
        }
      }
    });

    let evaluatedCandidatesCount = 0;
    let evaluatedSubmissionsCount = 0;
    const summaryDetails: any[] = [];

    // Calculate fixed assessment total marks
    const [assessmentMcqs, assessmentCoding] = await Promise.all([
      prisma.question.findMany({
        where: { section: { assessmentId } },
        select: { id: true, marks: true }
      }),
      prisma.codingQuestion.findMany({
        where: { section: { assessmentId } },
        select: { id: true, marks: true }
      })
    ]);

    const fixedMcqMax = assessmentMcqs.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
    const fixedCodingMax = assessmentCoding.reduce((sum, cq) => sum + (Number(cq.marks) || 10), 0);
    const fixedTotalMax = fixedMcqMax + fixedCodingMax;

    for (const candidate of candidates) {
      const session = candidate.sessions.find(s => s.status === 'COMPLETED') || candidate.sessions[0];
      if (!session || !session.codingAnswers || session.codingAnswers.length === 0) {
        continue;
      }

      let candidateCodingMarks = 0;
      const candidateSubmissionsSummary: any[] = [];

      for (const coding of session.codingAnswers) {
        const cq = coding.codingQuestion as any;
        const maxMarks = cq?.marks || 10;
        const testCases = cq?.testCases || [];

        let allottedScore = 0;
        let passedCount = 0;
        let totalCount = testCases.length;

        if (coding.code && coding.code.trim().length > 0 && testCases.length > 0) {
          try {
            const evalResult = await evaluateCodingSubmission(
              coding.language,
              coding.code,
              testCases,
              maxMarks
            );
            allottedScore = evalResult.allottedScore;
            passedCount = evalResult.passedCount;
            totalCount = evalResult.totalCount;
          } catch (evalErr) {
            console.error(`Failed to evaluate coding submission ${coding.id}:`, evalErr);
            allottedScore = 0;
          }
        }

        await prisma.codingSubmission.update({
          where: { id: coding.id },
          data: { score: allottedScore }
        });

        candidateCodingMarks += allottedScore;
        evaluatedSubmissionsCount++;

        candidateSubmissionsSummary.push({
          submissionId: coding.id,
          questionTitle: cq?.title,
          passedCount,
          totalCount,
          allottedScore,
          maxMarks
        });
      }

      // Recalculate Candidate's Overall AssessmentResult
      const mcqScore = session.answers.reduce((sum, a) => sum + (Number(a.score) || 0), 0);
      const totalScore = mcqScore + candidateCodingMarks;

      let result = candidate.results[0];
      let maxScore = fixedTotalMax > 0 ? fixedTotalMax : (result ? result.maxScore : 0);
      if (maxScore === 0) {
        const mcqMax = session.answers.reduce((sum, a) => sum + (Number((a as any).question?.marks) || 1), 0);
        const codingMax = session.codingAnswers.reduce((sum, c) => sum + ((c.codingQuestion as any)?.marks || 10), 0);
        maxScore = mcqMax + codingMax || 100;
      }

      const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 1000) / 10 : 0;

      await prisma.assessmentResult.upsert({
        where: { candidateId_assessmentId: { candidateId: candidate.id, assessmentId } },
        update: { totalScore, maxScore, percentage, status: 'EVALUATED' },
        create: {
          candidateId: candidate.id,
          assessmentId,
          totalScore,
          maxScore,
          percentage,
          status: 'EVALUATED'
        }
      });

      evaluatedCandidatesCount++;
      summaryDetails.push({
        candidateId: candidate.id,
        candidateName: candidate.name,
        newTotalScore: totalScore,
        mcqScore,
        candidateCodingMarks,
        submissions: candidateSubmissionsSummary
      });
    }

    res.json({
      success: true,
      message: `Successfully evaluated coding test cases for ${evaluatedCandidatesCount} candidate(s).`,
      evaluatedCandidatesCount,
      evaluatedSubmissionsCount,
      details: summaryDetails
    });
  } catch (error) {
    console.error('Error evaluating all coding submissions:', error);
    res.status(500).json({ error: 'Failed to auto-evaluate coding submissions' });
  }
};

/**
 * Evaluates a single coding submission by ID and allots marks based on passed test cases.
 */
export const evaluateSingleCodingSubmission = async (req: Request, res: Response) => {
  try {
    const { submissionId } = req.params;
    const { code, language, customStdin, saveScore = true } = req.body;

    const submission = await prisma.codingSubmission.findUnique({
      where: { id: submissionId },
      include: {
        codingQuestion: {
          include: { testCases: true }
        },
        session: {
          include: {
            candidate: true,
            answers: true,
            codingAnswers: true
          }
        }
      }
    });

    if (!submission) {
      return res.status(404).json({ error: 'Coding submission not found' });
    }

    const cq = submission.codingQuestion as any;
    const maxMarks = cq?.marks || 10;
    const testCases = cq?.testCases || [];
    const codeToRun = code !== undefined ? code : submission.code;
    const langToRun = language || submission.language;

    // If admin is running a custom test case with custom stdin
    if (customStdin !== undefined) {
      const customRes = await runCustomExecution(langToRun, codeToRun, customStdin);
      return res.json({
        success: true,
        isCustom: true,
        submissionId,
        customStdin,
        result: customRes
      });
    }

    // Standard test cases evaluation
    const evalResult = await evaluateCodingSubmission(
      langToRun,
      codeToRun,
      testCases,
      maxMarks
    );

    let updatedResult = null;
    let newTotal = undefined;

    if (saveScore) {
      // Update submission score
      await prisma.codingSubmission.update({
        where: { id: submissionId },
        data: { score: evalResult.allottedScore }
      });

      // Recalculate Candidate total score and percentage
      const session = submission.session;
      const mcqScore = session.answers.reduce((sum, a) => sum + (a.score || 0), 0);
      const otherCodingScore = session.codingAnswers
        .filter(c => c.id !== submissionId)
        .reduce((sum, c) => sum + (c.score || 0), 0);

      newTotal = mcqScore + otherCodingScore + evalResult.allottedScore;

      let result = await prisma.assessmentResult.findFirst({
        where: { candidateId: session.candidateId, assessmentId: session.candidate.assessmentId }
      });

      if (result) {
        const assessmentId = session.candidate.assessmentId;
        const [assessmentMcqs, assessmentCoding] = await Promise.all([
          prisma.question.findMany({
            where: { section: { assessmentId } },
            select: { id: true, marks: true }
          }),
          prisma.codingQuestion.findMany({
            where: { section: { assessmentId } },
            select: { id: true, marks: true }
          })
        ]);
        const fixedMcqMax = assessmentMcqs.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
        const fixedCodingMax = assessmentCoding.reduce((sum, cq) => sum + (Number(cq.marks) || 10), 0);
        const fixedTotal = fixedMcqMax + fixedCodingMax;
        const currentMax = fixedTotal >= 100 ? fixedTotal : 100;
        const percentage = currentMax > 0 ? Math.round((newTotal / currentMax) * 1000) / 10 : 0;

        updatedResult = await prisma.assessmentResult.update({
          where: { id: result.id },
          data: { totalScore: newTotal, maxScore: currentMax, percentage }
        });
      }
    }

    res.json({
      success: true,
      submissionId,
      allottedScore: evalResult.allottedScore,
      passedCount: evalResult.passedCount,
      totalCount: evalResult.totalCount,
      maxMarks: evalResult.maxMarks,
      results: evalResult.results,
      totalTimeMs: evalResult.totalTimeMs,
      updatedTotalScore: newTotal,
      updatedResult
    });
  } catch (error) {
    console.error('Error evaluating single coding submission:', error);
    res.status(500).json({ error: 'Failed to evaluate coding submission' });
  }
};

/**
 * Updates the fixed total marks for an assessment and recalculates percentages for all candidates.
 */
export const updateAssessmentTotalMarks = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { totalMarks } = req.body;
    const marks = Number(totalMarks) || 100;

    const results = await prisma.assessmentResult.findMany({
      where: { assessmentId: id }
    });

    for (const r of results) {
      const percentage = marks > 0 ? Math.round((r.totalScore / marks) * 1000) / 10 : 0;
      await prisma.assessmentResult.update({
        where: { id: r.id },
        data: { maxScore: marks, percentage }
      });
    }

    res.json({ success: true, totalMarks: marks, updatedCount: results.length });
  } catch (error) {
    console.error('Error updating assessment total marks:', error);
    res.status(500).json({ error: 'Failed to update total marks' });
  }
};

