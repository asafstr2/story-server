import { Schema, model, Document, Types } from "mongoose";

export interface IPayment extends Document {
  userId: Types.ObjectId;
  stripePaymentId: string;
  amount: number;
  currency: string;
  status: 'succeeded' | 'pending' | 'failed' | 'refunded' | 'partially_refunded';
  paymentMethod: string;
  description?: string;
  metadata?: Record<string, any>;
  refundedAmount?: number;
  refundReason?: string;
  receiptUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    stripePaymentId: {
      type: String,
      required: true,
      unique: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
      default: "usd",
    },
    status: {
      type: String,
      required: true,
      enum: ['succeeded', 'pending', 'failed', 'refunded', 'partially_refunded'],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      required: true,
    },
    description: {
      type: String,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
    refundedAmount: {
      type: Number,
      default: 0,
    },
    refundReason: {
      type: String,
    },
    receiptUrl: {
      type: String,
    },
  },
  { timestamps: true }
);

// Index for faster lookups
paymentSchema.index({ stripePaymentId: 1 });
paymentSchema.index({ status: 1 });

export const Payment = model<IPayment>("Payment", paymentSchema); 