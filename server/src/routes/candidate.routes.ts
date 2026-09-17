import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.middleware';
import { inviteCandidate, getCandidates, validateCandidatesCsv, importCandidatesCsv, getAllCandidates, registerPublicCandidate, resetTest, deleteCandidate, getCandidateFile } from '../controllers/candidate.controller';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

// Public Routes
router.post('/register', registerPublicCandidate);

// Protected Routes
router.use(requireAuth);

router.get('/', getAllCandidates);
router.post('/invite', inviteCandidate);
router.post('/csv/validate', upload.single('file'), validateCandidatesCsv);
router.post('/csv/import', importCandidatesCsv);
router.get('/:assessmentId', getCandidates);
router.delete('/:assessmentId/reset/:candidateId', resetTest);
router.get('/:id/files/:fileId', getCandidateFile);
router.delete('/:id', deleteCandidate);

export default router;
