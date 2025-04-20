import passport from "passport";
import { Strategy as JwtStrategy, ExtractJwt } from "passport-jwt";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { IUser, User } from "../models/user.model";
import { Request, Response, NextFunction } from "express";
import config from "../config";

const jwtOptions = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: config.jwtSecret,
};

passport.use(
  new JwtStrategy(jwtOptions, async (payload, done) => {
    try {
      const user = await User.findById(payload.id);
      if (user) {
        return done(null, user);
      }
      console.error("No User found not authenticated");

      return done(null, false);
    } catch (error) {
      console.error("Error in JwtStrategy:", error);
      done(error, false);
    }
  })
);

passport.use(
  new GoogleStrategy(
    {
      clientID: config.googleClientId,
      clientSecret: config.googleClientSecret,
      callbackURL: config.redirectAuthUri,
      passReqToCallback: true,
    },
    async (req, accessToken, refreshToken, profile, done) => {
      try {
        const state = req.query.state
          ? JSON.parse(req.query.state as string)
          : {};
        const source = state.source || "web";
        const role = state.role || "none";

        let user = await User.findOne({ googleOAuthId: profile.id });
        if (user) {
          return done(null, user);
        }
        if (!user) {
          const email = profile.emails ? profile.emails[0].value : "";
          user = await User.findOne({ email });
          if (user) {
            if (user.googleOAuthId) {
              console.log({ user });
              return done(null, user);
            }
            // If user exists but doesn't have Google OAuth ID, update it
            user.googleOAuthId = profile.id;
            await user.save();
            return done(null, user);
          }

          user = new User({
            email: profile.emails ? profile.emails[0].value : "",
            googleOAuthId: profile.id,
            profilePicture: profile.photos ? profile.photos[0].value : "",
          });
          await user.save();

          return done(null, user);
        }
      } catch (error) {
        done(error, false);
      }
    }
  )
);
export default passport;

// src/middleware/authLogger.ts

export const authWithLogging = (strategy: string, options: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // Check for token in the request headers (Authorization header)
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      console.log("No token provided in the request");
      return next({ message: "No token provided", status: 401 });
    }
    passport.authenticate(
      strategy,
      options,
      (err: any, user: IUser | undefined, info: any) => {
        if (err) {
          console.error("Authentication error:", err);
          return next(err);
        }
        if (!user) {
          console.log("Authentication failed:", info);
          return res.status(401).json({ message: "Unauthorized" });
        }
        console.log(" logged in as:", user.email);
        req.user = user;
        next();
      }
    )(req, res, next);
  };
};
