import { Request, Response, NextFunction } from 'express';
import { publicSystemConfig } from '../config/system.js';

// Retorna configurações públicas do sistema
export const getSystemConfig = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    res.json({
      config: publicSystemConfig,
    });
  } catch (error) {
    next(error);
  }
};

