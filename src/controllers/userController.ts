import { Request, Response, NextFunction } from "express";
import multer from "multer";
import path from "path";
import { cloudinaryUploadStream } from "../services/cloudinaryUploadStream";
import { IUser } from "../models/user.model";

/**
 * Update user profile information
 */
export const updateUserProfile = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as IUser;

    const { name, email, bio, location, website } = req.body;

    // Find user by ID
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Update fields if provided
    if (name) user.name = name;
    if (email) user.email = email;
    if (bio !== undefined) user.bio = bio;
    if (location !== undefined) user.location = location;
    if (website !== undefined) user.website = website;

    // Save updated user
    await user.save();

    // Return updated user
    res.status(200).json({ user });
  } catch (error) {
    next(error);
  }
};

// Configure multer storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  },
});

// Export multer middleware
export const uploadProfilePicture = upload.single("profilePicture");

/**
 * Update user profile picture
 */
export const updateProfilePicture = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = req.user as IUser;

    // Check if file exists
    if (!req.file) {
      res.status(400).json({ message: "No file uploaded" });
      return;
    }

    // Find user by ID
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Upload image to Cloudinary
    const result = await cloudinaryUploadStream(req.file.buffer);

    // Update user profile picture
    user.profilePicture = result.secure_url;
    await user.save();

    // Return updated user
    res.status(200).json({ profilePicture: result.secure_url });
  } catch (error) {
    next(error);
  }
};
