import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.middleware';
import { createQuestion, createCodingQuestion, validateCsv, importCsv, getQuestions, deleteQuestion, updateQuestion, updateCodingQuestion } from '../controllers/question.controller';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();
router.use(requireAuth);

router.get('/', getQuestions);
router.post('/mcq', createQuestion);
router.post('/coding', createCodingQuestion);
router.put('/mcq/:id', updateQuestion);
router.put('/coding/:id', updateCodingQuestion);
router.delete('/:id', deleteQuestion);
router.post('/csv/validate', upload.single('file'), validateCsv);
router.post('/csv/import', upload.single('file'), importCsv);

export default router;
