import { Schema, model, Document } from "mongoose";

export interface IUser extends Document {
  email: string;
  password?: string;
  googleOAuthId?: string;
  profilePicture?: string;
  name?: string;
  bio?: string;
  location?: string;
  website?: string;

  // Stripe payment fields
  stripeCustomerId?: string;
  subscription?: {
    status?: "active" | "canceled" | "past_due" | "trialing" | "unpaid";
    planId?: string;
    currentPeriodEnd?: Date;
    type?: "free" | "plus" | "pro" | "premium";
  };
  billingAddress?: {
    country?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    address?: string;
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
  id: string;
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
    bio: {
      type: String,
    },
    location: {
      type: String, 
    },
    website: {
      type: String,
    },

    // Stripe payment fields
    stripeCustomerId: {
      type: String,
    },
    subscription: {
      status: {
        type: String,
        enum: ["active", "canceled", "past_due", "trialing", "unpaid"],
      },
      planId: String,
      currentPeriodEnd: Date,
      type: {
        type: String,
        enum: ["free", "plus", "pro", "premium"],
        default: "free",
        lowercase: true,

      },
    },
    paymentMethod: {
      id: String,
      brand: String,
      last4: String,
      expMonth: Number,
      expYear: Number,
    },
    billingAddress: {
      country: String,
      city: String,
      state: String,
      postalCode: String,
      address: String,
    },
  },
  { timestamps: true }
);

// Add virtual property for id that returns _id as string
userSchema.virtual("id").get(function () {
  return this._id.toHexString();
});

// Ensure virtual fields are included when converting to JSON
userSchema.set("toJSON", {
  virtuals: true,
});

export const User = model<IUser>("User", userSchema);
