import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { uploadDocument, getDocuments, shareDocument, signDocument, deleteDocument } from '../controllers/documentController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Configure local uploads directory path
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Setup disk storage strategy
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

// Configure size limits
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit
});

router.use(authenticateToken);

router.post('/upload', upload.single('file'), uploadDocument);
router.get('/', getDocuments);
router.post('/share/:id', shareDocument);
router.post('/sign/:id', signDocument);
router.delete('/:id', deleteDocument);

export default router;
