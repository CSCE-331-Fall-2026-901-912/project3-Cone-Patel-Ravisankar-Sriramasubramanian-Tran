import { pool } from "../db.js";
import { Router } from "express";
import * as oidc from "openid-client";

const router = Router();

let googleConfig;

async function getGoogleConfig() {
  if (!googleConfig) {
    googleConfig = await oidc.discovery(
      new URL("https://accounts.google.com"),
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
  }

  return googleConfig;
}

async function getEmployeeRole(googleId) {
  const result = await pool.query(
    `SELECT e.employee_id, e.role
     FROM employee e
     JOIN user_accounts a ON e.account_id = a.account_id
     WHERE a.google_id = $1`,
    [googleId]
  );

  return result.rows[0] || null;
}

// Start Google sign-in
router.get("/google", async (req, res, next) => {
  try {
    const config = await getGoogleConfig();

    const state = oidc.randomState();
    const codeVerifier = oidc.randomPKCECodeVerifier();
    const codeChallenge =
      await oidc.calculatePKCECodeChallenge(codeVerifier);

    req.session.oauth = { state, codeVerifier };

    const url = oidc.buildAuthorizationUrl(config, {
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      scope: "openid email profile",
      response_type: "code",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    req.session.save((error) => {
      if (error) return next(error);
      res.redirect(url.href);
    });
  } catch (error) {
    next(error);
  }
});

// Handle Google callback
router.get("/google/callback", async (req, res, next) => {
  try {
    const { state, codeVerifier } = req.session.oauth || {};

    if (!state || !codeVerifier) {
      return res.status(400).json({
        error: "Missing OAuth session",
      });
    }

    const config = await getGoogleConfig();

    const currentUrl = new URL(
      req.originalUrl,
      new URL(process.env.GOOGLE_REDIRECT_URI).origin
    );

    const tokens = await oidc.authorizationCodeGrant(
      config,
      currentUrl,
      {
        pkceCodeVerifier: codeVerifier,
        expectedState: state,
        idTokenExpected: true,
      }
    );

    const claims = tokens.claims();

    if (!claims?.sub || !claims?.email || !claims.email_verified) {
      return res.status(403).json({
        error: "Google account could not be verified",
      });
    }

    const user = {
      googleId: claims.sub,
      email: claims.email,
      name: claims.name || claims.email,
      picture: claims.picture || null,
    };

    const account = await pool.query(
      `INSERT INTO user_accounts
        (google_id, google_email, display_name, picture_url)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (google_id)
      DO UPDATE SET
        google_email = EXCLUDED.google_email,
        display_name = EXCLUDED.display_name,
        picture_url = EXCLUDED.picture_url,
        last_login = NOW()
      RETURNING account_id`,
      [user.googleId, user.email, user.name, user.picture]
    );

    await pool.query(
      `INSERT INTO login_history (account_id)
      VALUES ($1)`,
      [account.rows[0].account_id]
    );

    const employee = await getEmployeeRole(user.googleId);

    user.role = employee?.role || "unassigned";
    user.employeeId = employee?.employee_id || null;

    req.session.regenerate((error) => {
      if (error) return next(error);

      req.session.user = user;

      req.session.save((saveError) => {
        if (saveError) return next(saveError);

        res.redirect(
          process.env.CLIENT_ORIGIN || "http://localhost:5173"
        );
      });
    });
  } catch (error) {
    next(error);
  }
});

// Get authenticated user
router.get("/me", async (req, res, next) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        error: "Not authenticated",
      });
    }

    const employee = await getEmployeeRole(
      req.session.user.googleId
    );

    res.json({
      user: {
        ...req.session.user,
        role: employee?.role || "unassigned",
        employeeId: employee?.employee_id || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Logout
router.post("/logout", (req, res, next) => {
  req.session.destroy((error) => {
    if (error) return next(error);

    res.clearCookie("bobabliss.sid");
    res.json({ message: "Logged out successfully" });
  });
});

export default router;
