import { Request, Response } from 'express';
import prisma from '../utils/db';

export const createInterviewSession = async (req: Request, res: Response) => {
  try {
    const { title, assessmentId, description } = req.body;
    const sessionId = `inv-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    
    // We can also fetch assessment info if linked
    let assessmentTitle = null;
    if (assessmentId) {
      const assessment = await prisma.assessment.findUnique({
        where: { id: assessmentId },
        select: { title: true }
      });
      if (assessment) {
        assessmentTitle = assessment.title;
      }
    }

    res.status(201).json({
      success: true,
      session: {
        id: sessionId,
        title: title || (assessmentTitle ? `Interview: ${assessmentTitle}` : `Technical Interview #${sessionId.slice(0, 6)}`),
        assessmentId: assessmentId || null,
        description: description || '',
        createdAt: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to create interview session' });
  }
};

export const getInterviewSession = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check if linked to an assessment
    const assessment = await prisma.assessment.findUnique({
      where: { id },
      include: {
        sections: {
          include: {
            codingQuestions: {
              include: {
                testCases: true
              }
            }
          }
        },
        candidates: {
          select: {
            id: true,
            name: true,
            email: true,
            college: true,
            branch: true,
          }
        }
      }
    });

    if (assessment) {
      // Gather all coding questions for the question bank selector
      const codingQuestions = assessment.sections.flatMap(s => s.codingQuestions);
      return res.json({
        id: assessment.id,
        title: `Interview: ${assessment.title}`,
        assessmentId: assessment.id,
        questions: codingQuestions,
        candidates: assessment.candidates,
      });
    }

    // Standalone session
    res.json({
      id,
      title: `Technical Interview #${id.slice(0, 8)}`,
      assessmentId: null,
      questions: [],
      candidates: [],
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to fetch interview session' });
  }
};
