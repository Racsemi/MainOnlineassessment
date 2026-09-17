import { Router } from 'express';
import { checkSession, startSession, saveAnswer, saveCodingDraft, submitAssessment, logIntegrityEvent, executeCode } from '../controllers/session.controller';

const router = Router();

// Notice: Candidate routes usually use the invite token, not standard admin auth
router.post('/check', checkSession);
router.post('/start', startSession);
router.post('/answer', saveAnswer);
router.post('/coding-draft', saveCodingDraft);
router.post('/submit', submitAssessment);
router.post('/integrity', logIntegrityEvent);
router.post('/execute', executeCode);

export default router;
