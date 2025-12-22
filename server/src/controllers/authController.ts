import { Request, Response, NextFunction } from 'express';
import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { JwtPayload } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN: string = process.env.JWT_EXPIRES_IN || '7d';

const generateToken = (user: any): string => {
  const payload: JwtPayload = {
    id: user._id.toString(),
    email: user.email,
    profile: user.profile,
  };
  
  const options: SignOptions = {
    expiresIn: JWT_EXPIRES_IN as string | number,
  };
  
  return jwt.sign(payload, JWT_SECRET, options);
};

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, profile, functions } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'Email já cadastrado' });
    }

    // Create new user with default password requirement
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: password || 'Ngr@123', // Senha padrão
      profile: profile || 'usuario',
      functions: functions || [],
      mustChangePassword: true, // Sempre deve trocar senha no primeiro login
    });

    // Generate token
    const token = generateToken(user);

    res.status(201).json({
      message: 'Usuário criado com sucesso',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profile: user.profile,
        functions: user.functions,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Email ou senha inválidos' });
    }

    // Check if user is active
    if (!user.active) {
      return res.status(401).json({ message: 'Usuário inativo' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Email ou senha inválidos' });
    }

    // Generate token
    const token = generateToken(user);

    res.json({
      message: 'Login realizado com sucesso',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profile: user.profile,
        functions: user.functions,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({ message: 'Não autorizado' });
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profile: user.profile,
        functions: user.functions,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updatePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user?._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Senha atual incorreta' });
    }

    // Update password and remove mustChangePassword flag
    user.password = newPassword;
    user.mustChangePassword = false;
    await user.save();

    res.json({ message: 'Senha atualizada com sucesso' });
  } catch (error) {
    next(error);
  }
};

export const forceChangePassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { newPassword } = req.body;
    const userId = req.user?._id;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'A nova senha deve ter pelo menos 6 caracteres' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    // Update password and remove mustChangePassword flag
    user.password = newPassword;
    user.mustChangePassword = false;
    await user.save();

    res.json({ 
      message: 'Senha alterada com sucesso',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profile: user.profile,
        functions: user.functions,
        mustChangePassword: false,
      }
    });
  } catch (error) {
    next(error);
  }
};

// Google OAuth callback
export const googleCallback = async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      return res.redirect(`${process.env.CLIENT_URL}/login?error=auth_failed`);
    }

    const token = generateToken(user);
    res.redirect(`${process.env.CLIENT_URL}/auth/callback?token=${token}`);
  } catch (error) {
    res.redirect(`${process.env.CLIENT_URL}/login?error=auth_failed`);
  }
};
