import { Router } from 'express';
import { createInterviewSession, getInterviewSession } from '../controllers/interview.controller';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();


// Allow public to fetch session metadata (needed for candidate lobby)
router.get('/:id', getInterviewSession);

// Admin-protected
router.post('/', requireAuth, createInterviewSession);


export default router;
