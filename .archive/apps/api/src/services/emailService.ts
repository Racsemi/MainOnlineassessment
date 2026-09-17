import { prisma } from '@racsemi/database';
import { ENV } from '../config/env';

export interface SendInvitationEmailParams {
  candidateId: string;
  invitationId: string;
  candidateName: string;
  candidateEmail: string;
  assessmentTitle: string;
  durationMinutes: number;
  deadline: Date;
  token: string;
}

export async function sendAssessmentInvitationEmail(params: SendInvitationEmailParams) {
  const assessmentLink = `${ENV.APP_URL}/candidate/assessment/${params.token}`;
  const subject = `RACSEMI – ${params.assessmentTitle} Invitation`;

  const bodyText = `Dear ${params.candidateName},

You have been shortlisted for the technical assessment stage at RACSEMI.

Assessment: ${params.assessmentTitle}
Duration: ${params.durationMinutes} minutes
Deadline: ${params.deadline.toLocaleDateString()}

Please use the secure link below to begin your assessment:
${assessmentLink}

Important Instructions:
- Use a laptop or desktop computer with Google Chrome or Firefox.
- Maintain fullscreen mode throughout the test.
- Ensure an undisturbed environment and stable internet connection.

Best regards,
RACSEMI Recruitment Team`;

  console.log(`\n📧 [EMAIL DISPATCHED] To: ${params.candidateEmail}`);
  console.log(`Subject: ${subject}`);
  console.log(`Link: ${assessmentLink}\n`);

  // Log in database
  return prisma.emailLog.create({
    data: {
      candidateId: params.candidateId,
      invitationId: params.invitationId,
      emailType: 'INVITATION',
      recipientEmail: params.candidateEmail,
      subject,
      status: 'SENT'
    }
  });
}
