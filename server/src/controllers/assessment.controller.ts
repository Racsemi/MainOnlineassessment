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
    const results = await prisma.assessmentResult.findMany({
      where: { assessmentId: id },
      include: {
        candidate: {
          include: {
            sessions: {
              include: { 
                integrityEvents: true,
                answers: {
                  include: { 
                    question: {
                      include: { options: true }
                    }
                  }
                },
                codingAnswers: {
                  include: { codingQuestion: true }
                }
              }
            }
          }
        }
      },
      orderBy: { totalScore: 'desc' }
    });
    
    const mapped = results.map(r => {
      const session = r.candidate.sessions[0];
      const codingSubmissions = (session?.codingAnswers || []).map((ca: any) => ({
        id: ca.id,
        questionTitle: ca.codingQuestion?.title,
        language: ca.language,
        status: ca.status,
        score: ca.score,
        maxScore: ca.codingQuestion?.marks || 10,
        code: ca.code
      }));

      const standardAnswers = (session?.answers || []).map((ans: any) => {
        let responseText = ans.textAnswer || '';
        if (ans.selectedOptionIds && ans.selectedOptionIds.length > 0) {
          const selectedOpts = ans.question.options.filter((o: any) => ans.selectedOptionIds.includes(o.id));
          responseText = selectedOpts.map((o: any) => o.text).join(', ');
        }
        return {
          id: ans.id,
          questionText: ans.question.text,
          type: ans.question.type,
          response: responseText,
          score: ans.score,
          maxScore: ans.question.marks
        };
      });

      return {
        id: r.id,
        name: r.candidate.name,
        email: r.candidate.email,
        photo: r.candidate.photo,
        customFields: r.candidate.customFields,
        score: r.totalScore,
        maxScore: r.maxScore,
        percentage: r.percentage,
        status: session?.status === 'COMPLETED' ? 'EVALUATED' : session?.status || r.status,
        integrityEventsCount: session?.integrityEvents?.length || 0,
        integrityEvents: session?.integrityEvents || [],
        codingSubmissions,
        standardAnswers
      };
    });
    
    res.json(mapped);
  } catch (error) {
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
    
    const updated = await prisma.assessmentResult.update({
      where: { id: resultId },
      data: { status }
    });
    
    res.json(updated);
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
    const result = await prisma.assessmentResult.findUnique({
      where: { id: resultId },
      include: { candidate: { include: { sessions: { include: { answers: true, codingAnswers: true } } } } }
    });
    
    if (result) {
      const session = result.candidate.sessions[0];
      let newTotal = 0;
      session?.answers.forEach(a => { newTotal += (a.score || 0) });
      session?.codingAnswers.forEach(c => { newTotal += (c.score || 0) });
      
      const percentage = result.maxScore > 0 ? (newTotal / result.maxScore) * 100 : 0;
      
      const updatedResult = await prisma.assessmentResult.update({
        where: { id: resultId },
        data: { totalScore: newTotal, percentage }
      });
      return res.json({ updatedResult, newScore: score });
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update score' });
  }
};
