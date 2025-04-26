import express from 'express';
import { updateUserProfile, updateProfilePicture, uploadProfilePicture } from '../controllers/userController';
import { authWithLogging } from '../controllers/passport';

const router = express.Router();

/**
 * @swagger
 * /api/user/profile:
 *   put:
 *     summary: Update user profile
 *     description: Updates the authenticated user's profile information.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               bio:
 *                 type: string
 *               location:
 *                 type: string
 *               website:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       401:
 *         description: Unauthorized
 */
router.put('/profile',  authWithLogging("jwt", {}), updateUserProfile);

/**
 * @swagger
 * /api/user/profile-picture:
 *   post:
 *     summary: Update profile picture
 *     description: Updates the authenticated user's profile picture.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               profilePicture:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Profile picture updated successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 */
router.post('/profile-picture',  authWithLogging("jwt", {}), uploadProfilePicture, updateProfilePicture);

export default router; 