import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { 
  createAssessment, 
  getAssessments, 
  getAssessmentById, 
  updateAssessment,
  getAssessmentResults,
  getPublicAssessment,
  deleteAssessment,
  updateResultStatus,
  updateAnswerScore
} from '../controllers/assessment.controller';

const router = Router();

// Public Routes
router.get('/public/:id', getPublicAssessment);

// Protected Routes
router.use(requireAuth); // All assessment routes require auth (Admin)

router.post('/', createAssessment);
router.get('/', getAssessments);
router.get('/:id', getAssessmentById);
router.get('/:id/results', getAssessmentResults);
router.put('/:id/results/:resultId/status', updateResultStatus);
router.put('/:id/results/:resultId/answers/:answerId/score', updateAnswerScore);
router.put('/:id', updateAssessment);
router.delete('/:id', deleteAssessment);

export default router;
