import Stripe from 'stripe';
import { User } from '../models/user.model';
import { Payment } from '../models/payment.model';
import { IUser } from '../models/user.model';
import { IPayment } from '../models/payment.model';

// Initialize Stripe with the API key from environment variables
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2023-10-16', // Use the latest stable API version
});

/**
 * Create or retrieve a Stripe customer for a user
 */
export const getOrCreateCustomer = async (userId: string): Promise<string> => {
  try {
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('User not found');
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
    console.error('Error in getOrCreateCustomer:', error);
    throw error;
  }
};

/**
 * Process a payment for a user
 */
export const processPayment = async (
  userId: string,
  amount: number,
  currency: string = 'usd',
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
    if (paymentIntent.status === 'succeeded') {
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
    if (paymentIntent.status === 'succeeded') {
      const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId);
      await updateUserPaymentMethod(userId, paymentMethod);
    }

    return payment;
  } catch (error) {
    console.error('Error in processPayment:', error);
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
      throw new Error('Payment not found');
    }

    // Check if payment is already refunded
    if (payment.status === 'refunded') {
      throw new Error('Payment already refunded');
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
      payment.status = 'refunded';
    } else {
      payment.status = 'partially_refunded';
    }
    
    await payment.save();
    
    return payment;
  } catch (error) {
    console.error('Error in processRefund:', error);
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
    console.error('Error in updateUserPaymentMethod:', error);
    throw error;
  }
};

/**
 * Get payment history for a user
 */
export const getUserPaymentHistory = async (userId: string): Promise<IPayment[]> => {
  try {
    return await Payment.find({ userId }).sort({ createdAt: -1 });
  } catch (error) {
    console.error('Error in getUserPaymentHistory:', error);
    throw error;
  }
}; 