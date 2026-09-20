import { Request, Response } from 'express';
import prisma from '../utils/db';

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

      const codingSubmissions = (session?.codingAnswers || []).map((ca: any) => ({
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

      const standardAnswers = (session?.answers || []).map((ans: any) => {
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
          maxScore: ans.question?.marks ?? 0
        };
      });

      // Calculate category scores
      const mcqScore = standardAnswers.reduce((sum: number, a: any) => sum + (a.score || 0), 0);
      const mcqMaxScore = standardAnswers.reduce((sum: number, a: any) => sum + (a.maxScore || 0), 0);
      const codingScore = codingSubmissions.reduce((sum: number, a: any) => sum + (a.score || 0), 0);
      const codingMaxScore = codingSubmissions.reduce((sum: number, a: any) => sum + (a.maxScore || 0), 0);

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

      const totalScore = result ? result.totalScore : (mcqScore + codingScore);
      const maxScore = result ? result.maxScore : (mcqMaxScore + codingMaxScore);
      const percentage = result ? result.percentage : (maxScore > 0 ? (totalScore / maxScore) * 100 : 0);
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
        percentage: Math.round(percentage * 10) / 10,
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
