import { Response } from 'express';
import { prisma } from '@racsemi/database';
import { AuthenticatedRequest } from '../middlewares/auth';
import { AssessmentStatus, TimingMode, ProctoringMode, DifficultyLevel } from '@racsemi/shared';
import { logAuditAction } from '../services/auditService';

export async function listAssessments(req: AuthenticatedRequest, res: Response) {
  try {
    const orgId = req.user!.organizationId;
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '20', 10);
    const skip = (page - 1) * limit;
    const status = req.query.status as AssessmentStatus;
    const search = req.query.search as string;

    const where: any = { organizationId: orgId };
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { role: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [total, assessments] = await Promise.all([
      prisma.assessment.count({ where }),
      prisma.assessment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          sections: {
            select: { id: true, title: true, marks: true, durationMinutes: true, questionCount: true }
          },
          _count: {
            select: {
              invitations: true,
              candidateSessions: true
            }
          }
        }
      })
    ]);

    return res.json({
      success: true,
      data: assessments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getAssessment(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const orgId = req.user!.organizationId;

    const assessment = await prisma.assessment.findFirst({
      where: { id, organizationId: orgId },
      include: {
        sections: {
          orderBy: { orderIndex: 'asc' },
          include: {
            assessmentQuestions: {
              orderBy: { orderIndex: 'asc' },
              include: {
                question: {
                  include: {
                    options: true,
                    codingDetails: true
                  }
                }
              }
            }
          }
        },
        _count: {
          select: {
            invitations: true,
            candidateSessions: true
          }
        }
      }
    });

    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    return res.json({ success: true, data: assessment });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function createAssessment(req: AuthenticatedRequest, res: Response) {
  try {
    const orgId = req.user!.organizationId;
    const userId = req.user!.id;
    const {
      title,
      description,
      role,
      difficulty,
      timingMode,
      durationMinutes,
      totalMarks,
      passingPercentage,
      randomizeQuestions,
      randomizeOptions,
      showResultToCandidate,
      integrityMonitoring,
      proctoringMode,
      instructions,
      allowedLanguages,
      sections
    } = req.body;

    if (!title) {
      return res.status(400).json({ success: false, message: 'Assessment title is required' });
    }

    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now().toString(36);

    const assessment = await prisma.$transaction(async (tx) => {
      const created = await tx.assessment.create({
        data: {
          organizationId: orgId,
          title,
          slug,
          description,
          role,
          difficulty: difficulty || DifficultyLevel.MEDIUM,
          timingMode: timingMode || TimingMode.TOTAL_ASSESSMENT_TIMER,
          durationMinutes: durationMinutes || 60,
          totalMarks: totalMarks || 100,
          passingPercentage: passingPercentage || 60,
          randomizeQuestions: !!randomizeQuestions,
          randomizeOptions: !!randomizeOptions,
          showResultToCandidate: !!showResultToCandidate,
          integrityMonitoring: integrityMonitoring !== false,
          proctoringMode: proctoringMode || ProctoringMode.BASIC,
          instructions,
          allowedLanguages: allowedLanguages ? JSON.stringify(allowedLanguages) : null,
          status: AssessmentStatus.DRAFT,
          createdById: userId
        }
      });

      if (Array.isArray(sections) && sections.length > 0) {
        for (let i = 0; i < sections.length; i++) {
          const sec = sections[i];
          let sectionMarks = 0;

          if (Array.isArray(sec.questionIds) && sec.questionIds.length > 0) {
            // Compute dynamic marks
            for (const qId of sec.questionIds) {
              const q = await tx.question.findUnique({ where: { id: qId } });
              if (q) sectionMarks += q.score;
            }
          }

          const createdSec = await tx.assessmentSection.create({
            data: {
              assessmentId: created.id,
              title: sec.title || `Section ${i + 1}`,
              description: sec.description,
              orderIndex: i,
              durationMinutes: sec.durationMinutes || 20,
              marks: sectionMarks,
              questionCount: sec.questionIds ? sec.questionIds.length : 0,
              isMandatory: sec.isMandatory !== false
            }
          });

          if (Array.isArray(sec.questionIds) && sec.questionIds.length > 0) {
            for (let qIdx = 0; qIdx < sec.questionIds.length; qIdx++) {
              await tx.assessmentQuestion.create({
                data: {
                  assessmentId: created.id,
                  sectionId: createdSec.id,
                  questionId: sec.questionIds[qIdx],
                  orderIndex: qIdx
                }
              });
            }
          }
        }
      }

      // Update total marks dynamically based on the summed section marks
      const allSections = await tx.assessmentSection.findMany({ where: { assessmentId: created.id } });
      const computedTotalMarks = allSections.reduce((sum, s) => sum + s.marks, 0);
      const finalAssessment = await tx.assessment.update({
        where: { id: created.id },
        data: { totalMarks: computedTotalMarks }
      });

      return finalAssessment;
    });

    await logAuditAction({
      organizationId: orgId,
      userId,
      action: 'ASSESSMENT_CREATED',
      entityType: 'Assessment',
      entityId: assessment.id,
      metadata: { title }
    });

    return res.status(201).json({ success: true, message: 'Assessment created successfully', data: assessment });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function publishAssessment(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const orgId = req.user!.organizationId;

    const assessment = await prisma.assessment.findFirst({
      where: { id, organizationId: orgId },
      include: {
        sections: {
          include: {
            assessmentQuestions: {
              include: {
                question: true
              }
            }
          }
        }
      }
    });

    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    if (!assessment.sections || assessment.sections.length === 0) {
      return res.status(400).json({ success: false, message: 'Assessment must have at least 1 section.' });
    }

    let calculatedTotalMarks = 0;
    for (const section of assessment.sections) {
      if (!section.assessmentQuestions || section.assessmentQuestions.length === 0) {
        return res.status(400).json({ success: false, message: `Section "${section.title}" must have at least 1 question.` });
      }
      for (const aq of section.assessmentQuestions) {
        calculatedTotalMarks += aq.question.score;
      }
    }

    if (calculatedTotalMarks !== assessment.totalMarks) {
      return res.status(400).json({ success: false, message: `Marks mismatch: calculated (${calculatedTotalMarks}) != total (${assessment.totalMarks})` });
    }

    const updated = await prisma.assessment.update({
      where: { id },
      data: { status: AssessmentStatus.ACTIVE }
    });

    await logAuditAction({
      organizationId: orgId,
      userId: req.user!.id,
      action: 'ASSESSMENT_PUBLISHED',
      entityType: 'Assessment',
      entityId: id
    });

    return res.json({ success: true, message: 'Assessment published and active', data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateAssessment(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const orgId = req.user!.organizationId;
    const {
      title, description, role, difficulty, timingMode, durationMinutes, passingPercentage,
      randomizeQuestions, randomizeOptions, showResultToCandidate, integrityMonitoring,
      proctoringMode, instructions, allowedLanguages, sections
    } = req.body;

    const existing = await prisma.assessment.findFirst({
      where: { id, organizationId: orgId }
    });

    if (!existing) return res.status(404).json({ success: false, message: 'Assessment not found' });
    if (existing.status !== AssessmentStatus.DRAFT) {
      return res.status(400).json({ success: false, message: 'Cannot edit an active/published assessment' });
    }

    const assessment = await prisma.$transaction(async (tx) => {
      // Delete existing sections and questions to recreate them (simplest approach for full updates)
      await tx.assessmentQuestion.deleteMany({ where: { assessmentId: id } });
      await tx.assessmentSection.deleteMany({ where: { assessmentId: id } });

      const updated = await tx.assessment.update({
        where: { id },
        data: {
          title, description, role, difficulty, timingMode,
          durationMinutes: durationMinutes || 60, passingPercentage: passingPercentage || 60,
          randomizeQuestions: !!randomizeQuestions, randomizeOptions: !!randomizeOptions,
          showResultToCandidate: !!showResultToCandidate, integrityMonitoring: integrityMonitoring !== false,
          proctoringMode: proctoringMode || ProctoringMode.BASIC,
          instructions, allowedLanguages: allowedLanguages ? JSON.stringify(allowedLanguages) : null
        }
      });

      if (Array.isArray(sections) && sections.length > 0) {
        for (let i = 0; i < sections.length; i++) {
          const sec = sections[i];
          let sectionMarks = 0;

          if (Array.isArray(sec.questionIds) && sec.questionIds.length > 0) {
            for (const qId of sec.questionIds) {
              const q = await tx.question.findUnique({ where: { id: qId } });
              if (q) sectionMarks += q.score;
            }
          }

          const createdSec = await tx.assessmentSection.create({
            data: {
              assessmentId: updated.id,
              title: sec.title || `Section ${i + 1}`,
              description: sec.description,
              orderIndex: i,
              durationMinutes: sec.durationMinutes || 20,
              marks: sectionMarks,
              questionCount: sec.questionIds ? sec.questionIds.length : 0,
              isMandatory: sec.isMandatory !== false
            }
          });

          if (Array.isArray(sec.questionIds) && sec.questionIds.length > 0) {
            for (let qIdx = 0; qIdx < sec.questionIds.length; qIdx++) {
              await tx.assessmentQuestion.create({
                data: {
                  assessmentId: updated.id,
                  sectionId: createdSec.id,
                  questionId: sec.questionIds[qIdx],
                  orderIndex: qIdx
                }
              });
            }
          }
        }
      }

      const allSections = await tx.assessmentSection.findMany({ where: { assessmentId: updated.id } });
      const computedTotalMarks = allSections.reduce((sum, s) => sum + s.marks, 0);
      const finalAssessment = await tx.assessment.update({
        where: { id: updated.id },
        data: { totalMarks: computedTotalMarks }
      });

      return finalAssessment;
    });

    await logAuditAction({
      organizationId: orgId, userId: req.user!.id, action: 'ASSESSMENT_UPDATED',
      entityType: 'Assessment', entityId: id, metadata: { title }
    });

    return res.json({ success: true, message: 'Assessment updated successfully', data: assessment });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
