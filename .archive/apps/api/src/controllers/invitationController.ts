import { Response } from 'express';
import * as crypto from 'crypto';
import { prisma } from '@racsemi/database';
import { AuthenticatedRequest } from '../middlewares/auth';
import { CandidateAssessmentStatus } from '@racsemi/shared';
import { sendAssessmentInvitationEmail } from '../services/emailService';
import { logAuditAction } from '../services/auditService';

export async function createInvitations(req: AuthenticatedRequest, res: Response) {
  try {
    const orgId = req.user!.organizationId;
    const { assessmentId, candidateIds, expiryDays } = req.body;

    if (!assessmentId || !Array.isArray(candidateIds) || candidateIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Assessment ID and Candidate IDs are required' });
    }

    const assessment = await prisma.assessment.findFirst({
      where: { id: assessmentId, organizationId: orgId }
    });

    if (!assessment) {
      return res.status(404).json({ success: false, message: 'Assessment not found' });
    }

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + (expiryDays || 14));

    const createdInvitations = [];

    for (const candId of candidateIds) {
      const candidate = await prisma.candidate.findFirst({
        where: { id: candId, organizationId: orgId }
      });

      if (!candidate) continue;

      // Cryptographically unguessable random token
      const token = 'rac_' + crypto.randomBytes(20).toString('hex');

      const invitation = await prisma.invitation.upsert({
        where: {
          assessmentId_candidateId: {
            assessmentId: assessment.id,
            candidateId: candidate.id
          }
        },
        update: {
          token,
          expiresAt,
          status: CandidateAssessmentStatus.INVITED
        },
        create: {
          assessmentId: assessment.id,
          candidateId: candidate.id,
          token,
          expiresAt,
          status: CandidateAssessmentStatus.INVITED
        }
      });

      // Send transactional invitation email
      await sendAssessmentInvitationEmail({
        candidateId: candidate.id,
        invitationId: invitation.id,
        candidateName: candidate.name,
        candidateEmail: candidate.email,
        assessmentTitle: assessment.title,
        durationMinutes: assessment.durationMinutes,
        deadline: expiresAt,
        token: invitation.token
      });

      createdInvitations.push(invitation);
    }

    await logAuditAction({
      organizationId: orgId,
      userId: req.user!.id,
      action: 'INVITATIONS_SENT',
      entityType: 'Invitation',
      metadata: { assessmentId, count: createdInvitations.length }
    });

    return res.json({
      success: true,
      message: `Sent ${createdInvitations.length} invitation emails successfully`,
      data: createdInvitations
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
}
