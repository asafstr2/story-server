import { Request, Response, NextFunction } from "express";
import {
  createSubscription,
  cancelSubscription,
  getSubscriptionDetails,
  SubscriptionPlan
} from "../services/stripe.service";
import { IUser } from "../models/user.model";

/**
 * Create a subscription for a user
 */
export const createUserSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user as IUser;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { paymentMethodId, planType = SubscriptionPlan.PREMIUM } = req.body;

    if (!paymentMethodId) {
      return res.status(400).json({ message: "Payment method ID is required" });
    }

    // Validate plan type
    if (planType && !Object.values(SubscriptionPlan).includes(planType as SubscriptionPlan)) {
      return res.status(400).json({ message: "Invalid subscription plan type" });
    }

    const subscription = await createSubscription(
      user.id,
      paymentMethodId,
      planType as SubscriptionPlan
    );

    res.status(200).json({ subscription });
  } catch (error: any) {
    console.error("Error in createUserSubscription:", error);
    res.status(500).json({ message: error.message || "Failed to create subscription" });
  }
};

/**
 * Cancel a user's subscription
 */
export const cancelUserSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user as IUser;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const result = await cancelSubscription(user.id);
    res.status(200).json(result);
  } catch (error: any) {
    console.error("Error in cancelUserSubscription:", error);
    res.status(500).json({ message: error.message || "Failed to cancel subscription" });
  }
};

/**
 * Get subscription details for a user
 */
export const getUserSubscription = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const user = req.user as IUser;
    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const subscriptionDetails = await getSubscriptionDetails(user._id);
    res.status(200).json(subscriptionDetails);
  } catch (error: any) {
    console.error("Error in getUserSubscription:", error);
    res.status(500).json({ message: error.message || "Failed to get subscription details" });
  }
}; 