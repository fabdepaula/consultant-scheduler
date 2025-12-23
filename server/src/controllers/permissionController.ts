import { Request, Response, NextFunction } from 'express';
import Permission from '../models/Permission.js';

export const getAllPermissions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, active } = req.query;
    
    const query: any = {};
    if (category) query.category = category;
    if (active !== undefined) query.active = active === 'true';

    const permissions = await Permission.find(query)
      .sort({ category: 1, resource: 1, action: 1 });

    // Agrupar por categoria para facilitar visualização
    const grouped = permissions.reduce((acc: any, perm) => {
      if (!acc[perm.category]) {
        acc[perm.category] = [];
      }
      acc[perm.category].push(perm);
      return acc;
    }, {});

    res.json({
      permissions,
      grouped,
    });
  } catch (error) {
    next(error);
  }
};

export const getPermissionById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const permission = await Permission.findById(req.params.id);

    if (!permission) {
      return res.status(404).json({ message: 'Permissão não encontrada' });
    }

    res.json({ permission });
  } catch (error) {
    next(error);
  }
};

export const getPermissionsByCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const permissions = await Permission.find({ active: true })
      .sort({ category: 1, resource: 1, action: 1 });

    const grouped = permissions.reduce((acc: any, perm) => {
      if (!acc[perm.category]) {
        acc[perm.category] = [];
      }
      acc[perm.category].push(perm);
      return acc;
    }, {});

    res.json({ grouped });
  } catch (error) {
    next(error);
  }
};

