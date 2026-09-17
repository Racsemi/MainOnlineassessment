import { Router } from 'express';
import * as authController from '../controllers/authController';
import * as assessmentController from '../controllers/assessmentController';
import * as questionController from '../controllers/questionController';
import * as candidateController from '../controllers/candidateController';
import * as invitationController from '../controllers/invitationController';
import * as candidateAssessmentController from '../controllers/candidateAssessmentController';
import * as reportController from '../controllers/reportController';
import { authenticateAdmin, requireRoles } from '../middlewares/auth';
import { authRateLimiter, candidateApiLimiter, codeRunLimiter } from '../middlewares/rateLimiter';
import { recordIntegrityEvent } from '../services/integrityService';
import { UserRole } from '@racsemi/shared';

export const apiRouter = Router();

// ------------------------------------------------------------------------------
// 1. Authentication Routes (Admin / Recruiter)
// ------------------------------------------------------------------------------
apiRouter.post('/auth/login', authRateLimiter, authController.login);
apiRouter.post('/auth/logout', authenticateAdmin, authController.logout);
apiRouter.get('/auth/me', authenticateAdmin, authController.getCurrentUser);

// ------------------------------------------------------------------------------
// 2. Assessment Management Routes (Admin & Recruiter)
// ------------------------------------------------------------------------------
apiRouter.get('/assessments', authenticateAdmin, assessmentController.listAssessments);
apiRouter.post('/assessments', authenticateAdmin, requireRoles(UserRole.ADMIN, UserRole.RECRUITER), assessmentController.createAssessment);
apiRouter.get('/assessments/:id', authenticateAdmin, assessmentController.getAssessment);
apiRouter.put('/assessments/:id', authenticateAdmin, requireRoles(UserRole.ADMIN, UserRole.RECRUITER), assessmentController.updateAssessment);
apiRouter.post('/assessments/:id/publish', authenticateAdmin, requireRoles(UserRole.ADMIN, UserRole.RECRUITER), assessmentController.publishAssessment);

// ------------------------------------------------------------------------------
// 3. Question Bank Routes
// ------------------------------------------------------------------------------
apiRouter.get('/questions', authenticateAdmin, questionController.listQuestions);
apiRouter.post('/questions', authenticateAdmin, requireRoles(UserRole.ADMIN, UserRole.RECRUITER), questionController.createQuestion);
apiRouter.post('/questions/import', authenticateAdmin, requireRoles(UserRole.ADMIN, UserRole.RECRUITER), questionController.importQuestionsCsv);
apiRouter.get('/questions/:id', authenticateAdmin, questionController.getQuestion);
apiRouter.put('/questions/:id', authenticateAdmin, requireRoles(UserRole.ADMIN, UserRole.RECRUITER), questionController.updateQuestion);
apiRouter.delete('/questions/:id', authenticateAdmin, requireRoles(UserRole.ADMIN, UserRole.RECRUITER), questionController.deleteQuestion);

// ------------------------------------------------------------------------------
// 4. Candidate Management Routes
// ------------------------------------------------------------------------------
apiRouter.get('/candidates', authenticateAdmin, candidateController.listCandidates);
apiRouter.post('/candidates/import', authenticateAdmin, requireRoles(UserRole.ADMIN, UserRole.RECRUITER), candidateController.importCandidatesCsv);

// ------------------------------------------------------------------------------
// 5. Invitation Routes
// ------------------------------------------------------------------------------
apiRouter.post('/invitations', authenticateAdmin, requireRoles(UserRole.ADMIN, UserRole.RECRUITER), invitationController.createInvitations);

// ------------------------------------------------------------------------------
// 6. Candidate Assessment Taking Flow (Public token endpoints)
// ------------------------------------------------------------------------------
apiRouter.get('/candidate/assessment/:token', candidateApiLimiter, candidateAssessmentController.getAssessmentByToken);
apiRouter.post('/candidate/session/start', candidateApiLimiter, candidateAssessmentController.startCandidateSession);
apiRouter.get('/candidate/session/:id', candidateApiLimiter, candidateAssessmentController.getCandidateSession);
apiRouter.post('/candidate/session/:id/autosave', candidateApiLimiter, candidateAssessmentController.autosaveCandidateSession);
apiRouter.post('/candidate/code/run', codeRunLimiter, candidateAssessmentController.runCandidateCode);
apiRouter.post('/candidate/code/submit', codeRunLimiter, candidateAssessmentController.submitCandidateCode);
apiRouter.post('/candidate/session/:id/submit', candidateApiLimiter, candidateAssessmentController.submitCandidateAssessment);

// Integrity telemetry ingestion
apiRouter.post('/integrity/event', candidateApiLimiter, async (req, res) => {
  try {
    const { sessionId, eventType, eventData, clientTimestamp } = req.body;
    if (!sessionId || !eventType) {
      return res.status(400).json({ success: false, message: 'sessionId and eventType are required' });
    }
    const result = await recordIntegrityEvent(sessionId, eventType, eventData, clientTimestamp);
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ------------------------------------------------------------------------------
// 7. Recruiter Reports & Analytics
// ------------------------------------------------------------------------------
apiRouter.get('/reports/assessment/:id', authenticateAdmin, reportController.getAssessmentReport);
apiRouter.get('/reports/candidate/:id', authenticateAdmin, reportController.getCandidateDetailedReport);
apiRouter.post('/reports/candidate/note', authenticateAdmin, reportController.addInterviewerNote);
apiRouter.post('/reports/candidate/decision', authenticateAdmin, reportController.updateRecruiterDecision);
apiRouter.get('/reports/export/csv', authenticateAdmin, reportController.exportAssessmentResultsCsv);
