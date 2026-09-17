import { Response } from 'express';
import { prisma } from '@racsemi/database';
import { AuthenticatedRequest } from '../middlewares/auth';
import { sanitizeCsvField, RecruiterDecision } from '@racsemi/shared';
import { logAuditAction } from '../services/auditService';

export async function getAssessmentReport(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const orgId = req.user!.organizationId;

    const assessment = await prisma.assessment.findFirst({
      where: { id, organizationId: orgId },
      include: {
        sections: { orderBy: { orderIndex: 'asc' } },
        invitations: {
          include: {
            candidate: true,
            candidateSession: {
              include: {
                assessmentResult: true,
                candidateReport: true
              }
            }
          }
        }
      }
    });

    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    const totalInvited = assessment.invitations.length;
    const completedSessions = assessment.invitations
      .map(i => i.candidateSession)
      .filter(s => s && (s.status === 'SUBMITTED' || s.status === 'AUTO_SUBMITTED') && s.assessmentResult);

    const completedCount = completedSessions.length;
    const scores = completedSessions.map(s => s!.assessmentResult!.totalScore);
    const avgScore = scores.length > 0 ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10 : 0;
    const passCount = completedSessions.filter(s => s!.assessmentResult!.passed).length;
    const passRate = completedCount > 0 ? Math.round((passCount / completedCount) * 100) : 0;

    // Score distribution buckets [0-20, 21-40, 41-60, 61-80, 81-100]
    const buckets = [0, 0, 0, 0, 0];
    for (const score of scores) {
      const pct = (score / (assessment.totalMarks || 100)) * 100;
      if (pct <= 20) buckets[0]++;
      else if (pct <= 40) buckets[1]++;
      else if (pct <= 60) buckets[2]++;
      else if (pct <= 80) buckets[3]++;
      else buckets[4]++;
    }

    return res.json({
      success: true,
      data: {
        assessment: {
          id: assessment.id,
          title: assessment.title,
          role: assessment.role,
          totalMarks: assessment.totalMarks,
          durationMinutes: assessment.durationMinutes,
          sections: assessment.sections
        },
        metrics: {
          totalInvited,
          completedCount,
          pendingCount: totalInvited - completedCount,
          avgScore,
          passRate,
          scoreDistribution: [
            { range: '0-20%', count: buckets[0] },
            { range: '21-40%', count: buckets[1] },
            { range: '41-60%', count: buckets[2] },
            { range: '61-80%', count: buckets[3] },
            { range: '81-100%', count: buckets[4] }
          ]
        },
        candidates: assessment.invitations.map(inv => ({
          invitationId: inv.id,
          candidateId: inv.candidate.id,
          name: inv.candidate.name,
          email: inv.candidate.email,
          status: inv.candidateSession?.status || inv.status,
          totalScore: inv.candidateSession?.assessmentResult?.totalScore ?? null,
          percentage: inv.candidateSession?.assessmentResult?.percentage ?? null,
          passed: inv.candidateSession?.assessmentResult?.passed ?? null,
          riskLevel: inv.candidateSession?.candidateReport?.overallRiskLevel ?? 'LOW',
          recruiterDecision: inv.candidateSession?.candidateReport?.recruiterDecision ?? 'PENDING',
          startedAt: inv.candidateSession?.startedAt ?? null,
          submittedAt: inv.candidateSession?.submittedAt ?? null
        }))
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function getCandidateDetailedReport(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params; // candidateId or candidateSessionId
    const orgId = req.user!.organizationId;

    const session = await prisma.candidateSession.findFirst({
      where: {
        OR: [{ id }, { candidateId: id }],
        assessment: { organizationId: orgId }
      },
      include: {
        candidate: true,
        assessment: {
          include: {
            sections: { orderBy: { orderIndex: 'asc' } }
          }
        },
        assessmentResult: {
          include: {
            sectionResults: {
              include: { section: true }
            }
          }
        },
        candidateReport: true,
        integrityEvents: {
          orderBy: { clientTimestamp: 'asc' }
        },
        candidateAnswers: {
          include: {
            question: {
              include: { options: true }
            }
          }
        },
        codingSubmissions: {
          where: { isDraft: false },
          orderBy: { createdAt: 'desc' },
          include: {
            question: true
          }
        }
      }
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Candidate report not found' });
    }

    const interviewerNotes = await prisma.interviewerNote.findMany({
      where: { candidateId: session.candidateId, assessmentId: session.assessmentId },
      include: { author: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({
      success: true,
      data: {
        session: {
          id: session.id,
          status: session.status,
          startedAt: session.startedAt,
          submittedAt: session.submittedAt,
          deviceFingerprint: session.deviceFingerprint,
          systemCheckSummary: session.systemCheckSummary ? JSON.parse(session.systemCheckSummary) : null
        },
        candidate: session.candidate,
        assessment: {
          id: session.assessment.id,
          title: session.assessment.title,
          role: session.assessment.role,
          totalMarks: session.assessment.totalMarks,
          durationMinutes: session.assessment.durationMinutes
        },
        result: session.assessmentResult,
        report: session.candidateReport,
        integrityEvents: session.integrityEvents,
        mcqAnswers: session.candidateAnswers.map(a => ({
          questionId: a.questionId,
          title: a.question.title,
          problemStatement: a.question.problemStatement,
          scoreObtained: a.scoreObtained,
          isCorrect: a.isCorrect,
          selectedOptions: a.selectedOptionsJson ? JSON.parse(a.selectedOptionsJson) : [],
          options: a.question.options
        })),
        codingSubmissions: session.codingSubmissions,
        interviewerNotes
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function addInterviewerNote(req: AuthenticatedRequest, res: Response) {
  try {
    const { candidateId, assessmentId, note } = req.body;
    const authorId = req.user!.id;

    if (!candidateId || !assessmentId || !note) {
      return res.status(400).json({ success: false, message: 'Candidate ID, Assessment ID, and note content are required' });
    }

    const assessment = await prisma.assessment.findFirst({
      where: { id: assessmentId, organizationId: req.user!.organizationId }
    });

    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found or unauthorized' });
    }

    const newNote = await prisma.interviewerNote.create({
      data: {
        candidateId,
        assessmentId,
        authorId,
        note,
        isPrivate: true
      },
      include: {
        author: { select: { firstName: true, lastName: true } }
      }
    });

    return res.status(201).json({ success: true, message: 'Note added', data: newNote });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

export async function updateRecruiterDecision(req: AuthenticatedRequest, res: Response) {
  try {
    const { sessionId, decision } = req.body;
    if (!sessionId || !decision) {
      return res.status(400).json({ success: false, message: 'SessionId and decision are required' });
    }

    const session = await prisma.candidateSession.findFirst({
      where: { id: sessionId, assessment: { organizationId: req.user!.organizationId } }
    });

    if (!session) {
      return res.status(404).json({ success: false, message: 'Session not found or unauthorized' });
    }

    const updated = await prisma.candidateReport.upsert({
      where: { sessionId },
      update: { recruiterDecision: decision as RecruiterDecision },
      create: {
        sessionId,
        recruiterDecision: decision as RecruiterDecision,
        overallRiskLevel: 'LOW',
        integrityScore: 100
      }
    });

    return res.json({ success: true, message: 'Decision updated', data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * Export Assessment Results to CSV with Formula Injection Protection
 */
export async function exportAssessmentResultsCsv(req: AuthenticatedRequest, res: Response) {
  try {
    const { assessmentId } = req.query;
    const orgId = req.user!.organizationId;

    if (!assessmentId) {
      return res.status(400).json({ success: false, message: 'Assessment ID is required' });
    }

    const assessment = await prisma.assessment.findFirst({
      where: { id: String(assessmentId), organizationId: orgId },
      include: {
        invitations: {
          include: {
            candidate: true,
            candidateSession: {
              include: {
                assessmentResult: true,
                candidateReport: true
              }
            }
          }
        }
      }
    });

    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    const headers = ['Candidate Name', 'Email', 'Status', 'Score', 'Max Marks', 'Percentage', 'Result', 'Risk Level', 'Decision'];
    const rows = [headers.join(',')];

    for (const inv of assessment.invitations) {
      const c = inv.candidate;
      const s = inv.candidateSession;
      const r = s?.assessmentResult;
      const rep = s?.candidateReport;

      const row = [
        sanitizeCsvField(c.name),
        sanitizeCsvField(c.email),
        sanitizeCsvField(s?.status || inv.status),
        sanitizeCsvField(r?.totalScore ?? 'N/A'),
        sanitizeCsvField(assessment.totalMarks),
        sanitizeCsvField(r ? `${r.percentage}%` : 'N/A'),
        sanitizeCsvField(r ? (r.passed ? 'PASSED' : 'FAILED') : 'N/A'),
        sanitizeCsvField(rep?.overallRiskLevel || 'LOW'),
        sanitizeCsvField(rep?.recruiterDecision || 'PENDING')
      ];
      rows.push(row.join(','));
    }

    const csvContent = rows.join('\r\n');

    await logAuditAction({
      organizationId: orgId,
      userId: req.user!.id,
      action: 'RESULTS_EXPORTED_CSV',
      entityType: 'Assessment',
      entityId: assessment.id
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="racsemi_assessment_results_${Date.now()}.csv"`);
    return res.send(csvContent);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
