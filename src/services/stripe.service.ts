import Stripe from "stripe";
import { User } from "../models/user.model";
import { Payment } from "../models/payment.model";
import { IUser } from "../models/user.model";
import { IPayment } from "../models/payment.model";

// Initialize Stripe with the API key from environment variables
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16", // Use the latest stable API version
});

// Premium subscription price ID from Stripe dashboard
const PLUS_PRICE_ID = process.env.STRIPE_PLUS_PRICE_ID || "";
const PREMIUM_PRICE_ID = process.env.STRIPE_PREMIUM_PRICE_ID || "";
const PRO_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID || "";

// Subscription plan types
export enum SubscriptionPlan {
  PLUS = "plus",
  PREMIUM = "premium",
  PRO = "pro"
}

// Get price ID based on plan type
export const getPriceIdForPlan = (plan: SubscriptionPlan): string => {
  switch (plan) {
    case SubscriptionPlan.PLUS:
      return PLUS_PRICE_ID;
    case SubscriptionPlan.PREMIUM:
      return PREMIUM_PRICE_ID;
    case SubscriptionPlan.PRO:
      return PRO_PRICE_ID;
    default:
      return PLUS_PRICE_ID; // Default to plus as most basic paid plan
  }
};

/**
 * Create or retrieve a Stripe customer for a user
 */
export const getOrCreateCustomer = async (userId: string): Promise<string> => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // If the user already has a Stripe customer ID, return it
    if (user.stripeCustomerId) {
      return user.stripeCustomerId;
    }

    // Create a new customer in Stripe
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name || undefined,
      metadata: {
        userId: user.id,
      },
    });

    // Update the user with the new Stripe customer ID
    user.stripeCustomerId = customer.id;
    await user.save();

    return customer.id;
  } catch (error) {
    console.error("Error in getOrCreateCustomer:", error);
    throw error;
  }
};

/**
 * Process a payment for a user
 */
export const processPayment = async (
  userId: string,
  amount: number,
  currency: string = "usd",
  paymentMethodId: string,
  description?: string,
  metadata?: Record<string, any>
): Promise<IPayment> => {
  try {
    // Get or create a customer for the user
    const customerId = await getOrCreateCustomer(userId);

    // Create the payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency,
      customer: customerId,
      payment_method: paymentMethodId,
      description,
      metadata: {
        userId,
        ...metadata,
      },
      confirm: true,
      return_url: process.env.STRIPE_RETURN_URL,
    });

    // Retrieve charge data if payment intent is succeeded
    let receiptUrl = undefined;
    if (paymentIntent.status === "succeeded") {
      const charges = await stripe.charges.list({
        payment_intent: paymentIntent.id,
      });
      receiptUrl = charges.data[0]?.receipt_url;
    }

    // Save payment record to database
    const payment = new Payment({
      userId,
      stripePaymentId: paymentIntent.id,
      amount: amount,
      currency,
      status: paymentIntent.status,
      paymentMethod: paymentMethodId,
      description,
      metadata,
      receiptUrl,
    });

    await payment.save();

    // If payment successful, update user's payment method
    if (paymentIntent.status === "succeeded") {
      const paymentMethod = await stripe.paymentMethods.retrieve(
        paymentMethodId
      );
      await updateUserPaymentMethod(userId, paymentMethod);
    }

    return payment;
  } catch (error) {
    console.error("Error in processPayment:", error);
    throw error;
  }
};

/**
 * Process a refund for a payment
 */
export const processRefund = async (
  paymentId: string,
  amount?: number,
  reason?: string
): Promise<IPayment | null> => {
  try {
    // Find the payment record
    const payment = await Payment.findById(paymentId);
    if (!payment) {
      throw new Error("Payment not found");
    }

    // Check if payment is already refunded
    if (payment.status === "refunded") {
      throw new Error("Payment already refunded");
    }

    // Process the refund in Stripe
    const refund = await stripe.refunds.create({
      payment_intent: payment.stripePaymentId,
      amount: amount ? Math.round(amount * 100) : undefined, // Convert to cents if partial refund
      reason: (reason as Stripe.RefundCreateParams.Reason) || undefined,
    });

    // Update the payment record
    const refundAmount = amount || payment.amount;
    payment.refundedAmount = (payment.refundedAmount || 0) + refundAmount;
    payment.refundReason = reason;

    // Update status based on full or partial refund
    if (payment.refundedAmount >= payment.amount) {
      payment.status = "refunded";
    } else {
      payment.status = "partially_refunded";
    }

    await payment.save();

    return payment;
  } catch (error) {
    console.error("Error in processRefund:", error);
    throw error;
  }
};

/**
 * Update a user's payment method details
 */
const updateUserPaymentMethod = async (
  userId: string,
  paymentMethod: Stripe.PaymentMethod
): Promise<IUser | null> => {
  try {
    if (!paymentMethod.card) {
      return null;
    }

    const user = await User.findById(userId);
    if (!user) {
      return null;
    }

    user.paymentMethod = {
      id: paymentMethod.id,
      brand: paymentMethod.card.brand,
      last4: paymentMethod.card.last4,
      expMonth: paymentMethod.card.exp_month,
      expYear: paymentMethod.card.exp_year,
    };

    await user.save();
    return user;
  } catch (error) {
    console.error("Error in updateUserPaymentMethod:", error);
    throw error;
  }
};

/**
 * Get payment history for a user
 */
export const getUserPaymentHistory = async (
  userId: string
): Promise<IPayment[]> => {
  try {
    return await Payment.find({ userId }).sort({ createdAt: -1 });
  } catch (error) {
    console.error("Error in getUserPaymentHistory:", error);
    throw error;
  }
};

/**
 * Create a subscription for a user
 */
export const createSubscription = async (
  userId: string,
  paymentMethodId: string,
  planType: SubscriptionPlan = SubscriptionPlan.PREMIUM
): Promise<any> => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Get price ID for the selected plan
    const priceId = getPriceIdForPlan(planType);
    
    if (!priceId) {
      throw new Error(`Invalid price ID for plan type: ${planType}`);
    }

    // Get or create customer
    const customerId = await getOrCreateCustomer(userId);

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    });

    // Set as default payment method
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    });

    // Create the subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId }],
      expand: ["latest_invoice.payment_intent"],
      payment_behavior: "default_incomplete",
      payment_settings: {
        payment_method_types: ["card"],
        save_default_payment_method: "on_subscription",
      },
      metadata: {
        userId,
        planType,
      },
    });

    // Update user with subscription info
    user.subscription = {
      status:
        subscription.status === "active"
          ? "active"
          : subscription.status === "canceled"
          ? "canceled"
          : subscription.status === "past_due"
          ? "past_due"
          : subscription.status === "trialing"
          ? "trialing"
          : subscription.status === "unpaid"
          ? "unpaid"
          : undefined,
      planId: priceId,
      type:
        priceId === PLUS_PRICE_ID
          ? "plus"
          : priceId === PRO_PRICE_ID
          ? "pro"
          : priceId === PREMIUM_PRICE_ID
          ? "premium"
          : undefined,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
    };
    user.billingAddress = {
      country: user.billingAddress?.country,
      city: user.billingAddress?.city,
      state: user.billingAddress?.state,
      postalCode: user.billingAddress?.postalCode,
      address: user.billingAddress?.address,
    };
    // Save the updated user
    await user.save();

    // Update payment method details
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
    await updateUserPaymentMethod(userId, paymentMethod);

    return {
      subscriptionId: subscription.id,
      status: subscription.status,
      clientSecret: (subscription.latest_invoice as any)?.payment_intent
        ?.client_secret,
    };
  } catch (error) {
    console.error("Error in createSubscription:", error);
    throw error;
  }
};

/**
 * Cancel a user's subscription
 */
export const cancelSubscription = async (userId: string): Promise<any> => {
  try {
    const user = await User.findById(userId);
    if (!user || !user.stripeCustomerId) {
      throw new Error("User or customer ID not found");
    }

    // Get current subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: "active",
    });

    if (subscriptions.data.length === 0) {
      throw new Error("No active subscription found");
    }

    // Cancel the subscription at period end
    const subscription = await stripe.subscriptions.update(
      subscriptions.data[0].id,
      {
        cancel_at_period_end: true,
      }
    );

    // Update user's subscription status
    user.subscription = {
      ...user.subscription,
      status: "canceled",
    };

    await user.save();

    return {
      subscriptionId: subscription.id,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    };
  } catch (error) {
    console.error("Error in cancelSubscription:", error);
    throw error;
  }
};

/**
 * Get subscription details for a user
 */
export const getSubscriptionDetails = async (userId: string): Promise<any> => {
  try {
    let customerId = undefined;
    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }
    if (!user.stripeCustomerId) {
      customerId = await getOrCreateCustomer(userId);
    }
    if (!user.stripeCustomerId) {
      throw new Error("Customer ID not found");
    }
    console.log({ customerId: user.stripeCustomerId });
    // Get current subscriptions
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      expand: ["data.default_payment_method"],
    });

    if (subscriptions.data.length === 0) {
      return { hasSubscription: false };
    }

    const subscription = subscriptions.data[0];

    return {
      hasSubscription: true,
      subscriptionId: subscription.id,
      status: subscription.status,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      priceId: subscription.items.data[0].price.id,
      paymentMethod: user.paymentMethod,
      billingAddress: user.billingAddress,
      planType: user.subscription?.type,
    };
  } catch (error) {
    console.error("Error in getSubscriptionDetails:", error);
    throw error;
  }
};
