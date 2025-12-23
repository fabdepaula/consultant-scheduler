import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { getAllowedTeamsForUser } from '../services/teamVisibilityService.js';

const DEFAULT_PASSWORD = 'Ngr@123';

// Get all users/consultants
export const getAllConsultants = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { active, profile, functions, search, hasAgenda, team, forAgenda } = req.query;
    
    const query: any = {};
    
    if (active !== undefined) {
      query.active = active === 'true';
    }
    
    if (profile) {
      query.profile = profile;
    }
    
    if (functions) {
      // Filtrar por função (pode ser uma ou várias)
      const funcsArray = (functions as string).split(',');
      query.functions = { $in: funcsArray };
    }

    if (hasAgenda !== undefined) {
      query.hasAgenda = hasAgenda === 'true';
    }

    if (team) {
      query.teams = team;
    }

    // Se for para agenda, aplicar filtro de equipes permitidas
    if (forAgenda === 'true' && req.user) {
      try {
        const userId = req.user._id?.toString();
        if (userId) {
          const allowedTeamIds = await getAllowedTeamsForUser(userId);
          console.log('[getAllConsultants] Allowed teams for user:', {
            userId,
            allowedTeamIds,
            isNull: allowedTeamIds === null,
            length: allowedTeamIds?.length
          });
          
          if (allowedTeamIds !== null) {
            if (allowedTeamIds.length === 0) {
              // Não pode ver nenhuma equipe
              console.log('[getAllConsultants] No allowed teams - returning empty');
              return res.json({ users: [] });
            }
            // Converter IDs de string para ObjectId para comparação correta
            const teamObjectIds = allowedTeamIds
              .filter(id => id && mongoose.Types.ObjectId.isValid(id))
              .map(id => new mongoose.Types.ObjectId(id));
            
            console.log('[getAllConsultants] Filtering by teams:', teamObjectIds);
            // Filtrar por equipes permitidas
            query.teams = { $in: teamObjectIds };
          } else {
            console.log('[getAllConsultants] No team restrictions (null) - showing all consultants');
          }
        }
      } catch (error: any) {
        console.error('[getAllConsultants] Error applying team filter:', error);
        // Em caso de erro, não aplicar filtro (mostrar todos)
      }
    }
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { functions: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .populate('teams', 'name')
      .populate('role', 'name key')
      .sort({ name: 1 });

    res.json({ users });
  } catch (error) {
    next(error);
  }
};

// Get user by ID
export const getConsultantById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password')
      .populate('teams', 'name')
      .populate({
        path: 'role',
        populate: { path: 'permissions' }
      });
    
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    res.json({ user });
  } catch (error) {
    next(error);
  }
};

// Create new user (admin only)
export const createConsultant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, password, profile, role, functions, teams, hasAgenda } = req.body;

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'Email já cadastrado' });
    }

    // Validar role se fornecido
    if (role) {
      const Role = (await import('../models/Role.js')).default;
      const roleExists = await Role.findById(role);
      if (!roleExists) {
        return res.status(400).json({ message: 'Perfil (role) inválido' });
      }
    }

    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password: password || DEFAULT_PASSWORD, // Senha padrão Ngr@123
      profile: profile || 'usuario', // Mantido para compatibilidade
      role: role || undefined, // NOVO: usar role se fornecido
      functions: functions || [],
      teams: teams || [],
      hasAgenda: hasAgenda || false,
      mustChangePassword: true, // Sempre deve trocar senha no primeiro login
    });

    // Populate teams and role for response
    await user.populate('teams', 'name');
    await user.populate('role', 'name key');

    res.status(201).json({
      message: 'Usuário criado com sucesso',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profile: user.profile,
        role: user.role,
        functions: user.functions,
        teams: user.teams,
        hasAgenda: user.hasAgenda,
        active: user.active,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Update user (admin only)
export const updateConsultant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, profile, role, functions, teams, hasAgenda, active, password, resetPassword } = req.body;
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    // Check email uniqueness if changing
    if (email && email.toLowerCase() !== user.email) {
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return res.status(400).json({ message: 'Email já está em uso' });
      }
    }

    // Update fields
    if (name) user.name = name;
    if (email) user.email = email.toLowerCase();
    if (profile) user.profile = profile;
    // Validar role se fornecido
    if (role !== undefined) {
      if (role) {
        const Role = (await import('../models/Role.js')).default;
        const roleExists = await Role.findById(role);
        if (!roleExists) {
          return res.status(400).json({ message: 'Perfil (role) inválido' });
        }
        user.role = role;
      }
      // Se role é null/empty, manter o atual
    }

    if (functions !== undefined) user.functions = functions;
    if (teams !== undefined) user.teams = teams;
    if (hasAgenda !== undefined) user.hasAgenda = hasAgenda;
    if (active !== undefined) user.active = active;
    
    // Se resetPassword = true, restaura a senha padrão e força troca
    if (resetPassword) {
      user.password = DEFAULT_PASSWORD;
      user.mustChangePassword = true;
    } else if (password) {
      user.password = password;
    }

    await user.save();
    
    // Populate teams and role for response
    await user.populate('teams', 'name');
    await user.populate('role', 'name key');

    res.json({
      message: 'Usuário atualizado com sucesso',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        profile: user.profile,
        functions: user.functions,
        teams: user.teams,
        hasAgenda: user.hasAgenda,
        active: user.active,
        mustChangePassword: user.mustChangePassword,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Delete user (admin only) - soft delete
export const deleteConsultant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    // Soft delete - just deactivate
    user.active = false;
    await user.save();

    res.json({ message: 'Usuário desativado com sucesso' });
  } catch (error) {
    next(error);
  }
};

// Hard delete user (admin only)
export const hardDeleteConsultant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.params.id;

    const user = await User.findByIdAndDelete(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuário não encontrado' });
    }

    res.json({ message: 'Usuário removido permanentemente' });
  } catch (error) {
    next(error);
  }
};
