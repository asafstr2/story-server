import express from "express";
import { 
  createUserSubscription,
  cancelUserSubscription,
  getUserSubscription
} from "../controllers/subscription.controller";
import { authWithLogging } from "../controllers/passport";

const router = express.Router();

/**
 * @swagger
 * /api/subscriptions:
 *   post:
 *     summary: Create a subscription
 *     description: Create a new subscription for the user
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentMethodId
 *             properties:
 *               paymentMethodId:
 *                 type: string
 *                 description: The Stripe payment method ID
 *               priceId:
 *                 type: string
 *                 description: The Stripe price ID (optional, will use default if not provided)
 *     responses:
 *       200:
 *         description: Subscription created successfully
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/", authWithLogging("jwt", {}), createUserSubscription);

/**
 * @swagger
 * /api/subscriptions:
 *   get:
 *     summary: Get subscription details
 *     description: Get the current user's subscription details
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved subscription details
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/", authWithLogging("jwt", {}), getUserSubscription);

/**
 * @swagger
 * /api/subscriptions/cancel:
 *   post:
 *     summary: Cancel subscription
 *     description: Cancel the current user's subscription
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully canceled subscription
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/cancel", authWithLogging("jwt", {}), cancelUserSubscription);

export default router; 