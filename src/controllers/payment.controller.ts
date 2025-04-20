import { Request, Response, NextFunction } from "express";
import { 
  processPayment, 
  processRefund, 
  getUserPaymentHistory,
  getOrCreateCustomer
} from "../services/stripe.service";
import { IUser } from "../models/user.model";

/**
 * Create a payment intent
 */
export const createPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user as IUser;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { amount, currency, paymentMethodId, description, metadata } = req.body;

    if (!amount || !paymentMethodId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const payment = await processPayment(
      user.id,
      amount,
      currency || "usd",
      paymentMethodId,
      description,
      metadata
    );

    res.status(200).json({ payment });
  } catch (error: any) {
    console.error("Error in createPayment:", error);
    res.status(500).json({ message: error.message || "Payment processing failed" });
  }
};

/**
 * Get customer payment methods
 */
export const getCustomerPaymentMethod = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user as IUser;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Return the payment method saved in the user document
    res.status(200).json({ paymentMethod: user.paymentMethod || null });
  } catch (error: any) {
    console.error("Error in getCustomerPaymentMethod:", error);
    res.status(500).json({ message: error.message || "Failed to retrieve payment method" });
  }
};

/**
 * Get user payment history
 */
export const getPaymentHistory = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user as IUser;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const payments = await getUserPaymentHistory(user.id);
    res.status(200).json({ payments });
  } catch (error: any) {
    console.error("Error in getPaymentHistory:", error);
    res.status(500).json({ message: error.message || "Failed to retrieve payment history" });
  }
};

/**
 * Process a refund
 */
export const refundPayment = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user as IUser;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { paymentId, amount, reason } = req.body;

    if (!paymentId) {
      return res.status(400).json({ message: "Payment ID is required" });
    }

    const payment = await processRefund(paymentId, amount, reason);
    
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    res.status(200).json({ payment });
  } catch (error: any) {
    console.error("Error in refundPayment:", error);
    res.status(500).json({ message: error.message || "Refund processing failed" });
  }
};

/**
 * Create or get Stripe customer
 */
export const createCustomer = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user as IUser;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const customerId = await getOrCreateCustomer(user.id);
    res.status(200).json({ customerId });
  } catch (error: any) {
    console.error("Error in createCustomer:", error);
    res.status(500).json({ message: error.message || "Failed to create customer" });
  }
}; 