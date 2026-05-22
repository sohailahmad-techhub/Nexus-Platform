import { Router } from 'express';
import { depositFunds, withdrawFunds, transferFunds, getTransactions } from '../controllers/paymentController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticateToken);

router.post('/deposit', depositFunds);
router.post('/withdraw', withdrawFunds);
router.post('/transfer', transferFunds);
router.get('/transactions', getTransactions);

export default router;
