import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { User } from "../models/user.model";
import config from "../config";

export async function register(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({
        message: "Missing required fields: email, password, familyName, role",
      });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // Create owner user
    const user = new User({
      email,
      password: hashedPassword,
    });
    await user.save();

    // Generate JWT (include all relevant user data)
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,
        profilePicture: user.profilePicture,
      },
      config.jwtSecret,
      { expiresIn: "7d" }
    );

    res.status(201).json({ token, user });

    return;
  } catch (error) {
    next(error);
  }
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ message: "Missing email or password" });
      return;
    }

    const user = await User.findOne({ email });
    if (!user) {
      res.status(400).json({ message: "Invalid credentials" });
      return;
    }
    if (!user.password) {
      res.status(400).json({ message: "Invalid user" });
      return;
    }

    // Compare provided password with stored hash
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      res.status(400).json({ message: "Invalid credentials" });
      return;
    }

    // Generate JWT including all user data
    const token = jwt.sign(
      {
        id: user._id,
        email: user.email,

        profilePicture: user.profilePicture,
      },
      config.jwtSecret,
      { expiresIn: "7d" }
    );

    res.status(200).json({ token, user });
  } catch (error) {
    next(error);
  }
}
