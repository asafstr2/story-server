import express from "express";
import passport from "passport";
import { register, login } from "../controllers/authHandlers";
import config from "../config";
import jwt from "jsonwebtoken";

const router = express.Router();

/**
 * @swagger
 * /api/auth/register:
 *   post:
 *     summary: Register a new owner
 *     description: Creates a new family and registers an owner user. Required fields include email, password, and familyName.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: owner@example.com
 *               password:
 *                 type: string
 *                 example: secretPassword123
 *               familyName:
 *                 type: string
 *                 example: SmithFamily
 *     responses:
 *       201:
 *         description: Owner registered successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   example: your.jwt.token.here
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Missing required fields or family already exists.
 */
router.post("/register", register);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: User login
 *     description: Authenticates a user (owner or kid) using email and password and returns a JWT token upon successful login.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 example: owner@example.com
 *               password:
 *                 type: string
 *                 example: secretPassword123
 *     responses:
 *       200:
 *         description: User logged in successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 token:
 *                   type: string
 *                   example: your.jwt.token.here
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Invalid credentials or missing fields.
 */
router.post("/login", login);

/**
 * @swagger
 * /api/auth/google:
 *   get:
 *     summary: Trigger Google OAuth login
 *     description: Initiates the Google OAuth login process by redirecting the user to Google's authentication page.
 *     responses:
 *       302:
 *         description: Redirects the user to Google for authentication.
 */
router.get("/google", (req, res, next) => {
  const source = req.query.source || "none";
  const role = req.query.role || "none";
  console.log("source", { source });
  passport.authenticate("google", {
    scope: ["profile", "email"],
    state: JSON.stringify({ source, role }),
  })(req, res, next);
});

/**
 * @swagger
 * /api/auth/callback/google:
 *   get:
 *     summary: Google OAuth callback
 *     description: Handles the callback from Google OAuth. On successful authentication, a JWT token is generated and the user is redirected with the token.
 *     responses:
 *       302:
 *         description: Redirects to login success page with the JWT token in the query parameter.
 *       401:
 *         description: Unauthorized. Authentication failed.
 */
router.get(
  "/callback/google",
  passport.authenticate("google", { session: false }),
  (req, res, next) => {
    try {
      // On successful authentication, generate a JWT
      const user = req.user as any;
      const state = req.query.state
        ? JSON.parse(req.query.state as string)
        : {};
      const source = state.source || "none";

      const token = jwt.sign(
        {
          id: user._id,
          email: user.email,
          role: user.role,
          familyId: user.familyId,
          status: user.status,
          profilePicture: user.profilePicture,
          name: user.name,
          source,
        },
        config.jwtSecret,
        { expiresIn: "7d" }
      );
      // Handle different redirects based on source
      if (source === "mobile") {
        // Redirect to app deep link with token
        const deepLink = `dmikis://?token=${token}`;
        res.redirect(deepLink);
        return;
      } else {
        // Web redirect
        res.redirect(`${config.redirectAuthUriSuccess}?token=${token}`);
        return;
      }
    } catch (error) {
      console.log({ error });
      next(error);
    }
  }
);

export default router;
