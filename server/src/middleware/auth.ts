import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { IUser } from '../types/index.js';

export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('jwt', { session: false }, (err: Error, user: IUser) => {
    if (err) {
      return res.status(500).json({ message: 'Erro de autenticação', error: err.message });
    }
    
    if (!user) {
      return res.status(401).json({ message: 'Não autorizado. Token inválido ou expirado.' });
    }
    
    req.user = user;
    next();
  })(req, res, next);
};

// Autorização baseada no perfil (nível de acesso)
export const authorizeProfiles = (...profiles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Não autorizado' });
    }
    
    if (!profiles.includes(req.user.profile)) {
      return res.status(403).json({ 
        message: 'Acesso negado. Você não tem permissão para esta ação.' 
      });
    }
    
    next();
  };
};

// Middlewares de autorização por perfil
export const isAdmin = authorizeProfiles('admin');
export const isUsuario = authorizeProfiles('usuario', 'admin');

// Alias para compatibilidade
export const isGerente = isAdmin;
export const isConsultorOrGerente = isUsuario;
