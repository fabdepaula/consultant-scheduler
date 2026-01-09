import { Request, Response, NextFunction } from 'express';
import SessionLog from '../models/SessionLog.js';
import User from '../models/User.js';

// Criar log de login
export const createLoginLog = async (
  userId: string,
  ipAddress?: string,
  userAgent?: string
) => {
  try {
    const user = await User.findById(userId).select('name email');
    if (!user) return null;

    const sessionLog = await SessionLog.create({
      userId,
      userName: user.name,
      userEmail: user.email,
      loginAt: new Date(),
      ipAddress: ipAddress || undefined,
      userAgent: userAgent || undefined,
      active: true,
    });

    return sessionLog;
  } catch (error) {
    console.error('[SessionLog] Erro ao criar log de login:', error);
    return null;
  }
};

// Atualizar log de logout
export const updateLogoutLog = async (userId: string) => {
  try {
    const activeSession = await SessionLog.findOne({
      userId,
      active: true,
    }).sort({ loginAt: -1 });

    if (!activeSession) return null;

    const logoutAt = new Date();
    const duration = Math.round(
      (logoutAt.getTime() - activeSession.loginAt.getTime()) / 60000
    ); // minutos

    activeSession.logoutAt = logoutAt;
    activeSession.duration = duration;
    activeSession.active = false;
    await activeSession.save();

    return activeSession;
  } catch (error) {
    console.error('[SessionLog] Erro ao atualizar log de logout:', error);
    return null;
  }
};

// Listar logs (apenas admin)
export const getSessionLogs = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Verificar se é admin
    if (req.user?.profile !== 'admin') {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    const { page = 1, limit = 50, userId, search } = req.query;

    const query: any = {};

    // Filtrar por usuário
    if (userId) {
      query.userId = userId;
    }

    // Busca por nome ou email
    if (search) {
      query.$or = [
        { userName: { $regex: search, $options: 'i' } },
        { userEmail: { $regex: search, $options: 'i' } },
      ];
    }

    // Buscar apenas logs das últimas 32 horas
    const thirtyTwoHoursAgo = new Date(Date.now() - 32 * 60 * 60 * 1000);
    query.loginAt = { $gte: thirtyTwoHoursAgo };

    const skip = (Number(page) - 1) * Number(limit);

    const [logs, total] = await Promise.all([
      SessionLog.find(query)
        .sort({ loginAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .select('-__v')
        .lean(),
      SessionLog.countDocuments(query),
    ]);

    res.json({
      logs,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
};

// Estatísticas (opcional)
export const getSessionStats = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (req.user?.profile !== 'admin') {
      return res.status(403).json({ message: 'Acesso negado' });
    }

    const thirtyTwoHoursAgo = new Date(Date.now() - 32 * 60 * 60 * 1000);

    const [totalLogins, activeSessions, uniqueUsers] = await Promise.all([
      SessionLog.countDocuments({
        loginAt: { $gte: thirtyTwoHoursAgo },
      }),
      SessionLog.countDocuments({
        active: true,
        loginAt: { $gte: thirtyTwoHoursAgo },
      }),
      SessionLog.distinct('userId', {
        loginAt: { $gte: thirtyTwoHoursAgo },
      }),
    ]);

    res.json({
      totalLogins,
      activeSessions,
      uniqueUsers: uniqueUsers.length,
    });
  } catch (error) {
    next(error);
  }
};

