import { Router } from 'express';
import multer from 'multer';
import { generateStory, getStory, getUserStories, selectedImageCloudineryUpload, generatePdf } from '../controllers/story.controller';
import { authWithLogging } from '../controllers/passport';

const router = Router();

// Configure multer for file upload
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

// Protected routes (require authentication)
router.post('/create', authWithLogging('jwt', {}), upload.single('image'), generateStory);
router.post('/upload-images', authWithLogging('jwt', {}), selectedImageCloudineryUpload);
router.get('/user/stories', authWithLogging('jwt', {}), getUserStories);

// Public routes
router.get('/:id', getStory);
router.get('/:id/pdf', generatePdf);

export default router; 