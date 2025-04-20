import { Schema, model, Document } from "mongoose";

export interface IUser extends Document {
  email: string;
  password?: string;
  googleOAuthId?: string;
  profilePicture?: string;
  name?: string;
  
  // Stripe payment fields
  stripeCustomerId?: string;
  subscription?: {
    status?: 'active' | 'canceled' | 'past_due' | 'trialing' | 'unpaid';
    planId?: string;
    currentPeriodEnd?: Date;
  };
  paymentMethod?: {
    id?: string;
    brand?: string;
    last4?: string;
    expMonth?: number;
    expYear?: number;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },
    password: {
      type: String,
      // Not required because of OAuth
    },
    googleOAuthId: {
      type: String,
      sparse: true,
      unique: true,
    },
    profilePicture: {
      type: String,
    },
    name: {
      type: String,
    },
    
    // Stripe payment fields
    stripeCustomerId: {
      type: String,
    },
    subscription: {
      status: {
        type: String,
        enum: ['active', 'canceled', 'past_due', 'trialing', 'unpaid'],
      },
      planId: String,
      currentPeriodEnd: Date,
    },
    paymentMethod: {
      id: String,
      brand: String,
      last4: String,
      expMonth: Number,
      expYear: Number,
    },
  },
  { timestamps: true }
);

export const User = model<IUser>("User", userSchema);
