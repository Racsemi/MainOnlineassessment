import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getSettings, updateSettings } from '../controllers/settings.controller';

const router = Router();

router.get('/', getSettings);
router.put('/', requireAuth, updateSettings);

export default router;
