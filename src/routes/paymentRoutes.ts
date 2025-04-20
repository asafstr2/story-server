import express from "express";
import { 
  createPayment, 
  getCustomerPaymentMethod, 
  getPaymentHistory, 
  refundPayment,
  createCustomer
} from "../controllers/payment.controller";
import { authWithLogging } from "../controllers/passport";

const router = express.Router();

/**
 * @swagger
 * /api/payments:
 *   post:
 *     summary: Create a payment
 *     description: Process a payment with Stripe
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - paymentMethodId
 *             properties:
 *               amount:
 *                 type: number
 *                 description: The payment amount
 *               currency:
 *                 type: string
 *                 default: usd
 *                 description: The currency code
 *               paymentMethodId:
 *                 type: string
 *                 description: The Stripe payment method ID
 *               description:
 *                 type: string
 *                 description: Description of the payment
 *               metadata:
 *                 type: object
 *                 description: Additional metadata for the payment
 *     responses:
 *       200:
 *         description: Payment processed successfully
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.post("/", authWithLogging("jwt", {}), createPayment);

/**
 * @swagger
 * /api/payments/customer:
 *   get:
 *     summary: Get or create customer
 *     description: Get an existing Stripe customer or create a new one
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved or created customer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/customer", authWithLogging("jwt", {}), createCustomer);

/**
 * @swagger
 * /api/payments/payment-method:
 *   get:
 *     summary: Get payment method
 *     description: Get the customer's saved payment method
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved payment method
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/payment-method", authWithLogging("jwt", {}), getCustomerPaymentMethod);

/**
 * @swagger
 * /api/payments/history:
 *   get:
 *     summary: Get payment history
 *     description: Get the user's payment history
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved payment history
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/history", authWithLogging("jwt", {}), getPaymentHistory);

/**
 * @swagger
 * /api/payments/refund:
 *   post:
 *     summary: Refund a payment
 *     description: Process a refund for a payment
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentId
 *             properties:
 *               paymentId:
 *                 type: string
 *                 description: The payment ID to refund
 *               amount:
 *                 type: number
 *                 description: The amount to refund (optional for partial refunds)
 *               reason:
 *                 type: string
 *                 enum: [duplicate, fraudulent, requested_by_customer]
 *                 description: The reason for the refund
 *     responses:
 *       200:
 *         description: Refund processed successfully
 *       400:
 *         description: Missing required fields
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Payment not found
 *       500:
 *         description: Server error
 */
router.post("/refund", authWithLogging("jwt", {}), refundPayment);

export default router; 