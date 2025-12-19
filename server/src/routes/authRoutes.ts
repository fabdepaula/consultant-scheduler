import { Router } from 'express';
import passport from 'passport';
import * as authController from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// Local auth
router.post('/register', authController.register);
router.post('/login', authController.login);

// Profile
router.get('/profile', authenticate, authController.getProfile);
router.put('/password', authenticate, authController.updatePassword);
router.put('/force-change-password', authenticate, authController.forceChangePassword);

// Google OAuth
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/login' }),
  authController.googleCallback
);

export default router;


