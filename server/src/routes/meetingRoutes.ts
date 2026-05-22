import { Router } from 'express';
import { scheduleMeeting, getMeetings, acceptMeeting, rejectMeeting, cancelMeeting } from '../controllers/meetingController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.use(authenticateToken);

router.post('/schedule', scheduleMeeting);
router.get('/', getMeetings);
router.post('/accept/:id', acceptMeeting);
router.post('/reject/:id', rejectMeeting);
router.post('/cancel/:id', cancelMeeting);

export default router;
