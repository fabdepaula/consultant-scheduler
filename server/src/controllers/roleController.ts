import { Request, Response, NextFunction } from 'express';
import Role from '../models/Role.js';
import Permission from '../models/Permission.js';
import Team from '../models/Team.js';
import mongoose from 'mongoose';
import { IRole } from '../types/index.js';

export const getAllRoles = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const roles = await Role.find({})
      .populate('permissions', 'name key resource action category')
      .populate('allowedTeams', 'name active')
      .sort({ name: 1 });

    res.json({ roles });
  } catch (error) {
    next(error);
  }
};

export const getRoleById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = await Role.findById(req.params.id)
      .populate('permissions', 'name key resource action category description')
      .populate('allowedTeams', 'name active');

    if (!role) {
      return res.status(404).json({ message: 'Perfil não encontrado' });
    }

    res.json({ role });
  } catch (error) {
    next(error);
  }
};

export const createRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, key, description, permissions, allowedTeams, active } = req.body;

    // Validar campos obrigatórios
    if (!name || !key) {
      return res.status(400).json({ message: 'Nome e chave são obrigatórios' });
    }

    // Verificar se a chave já existe
    const existingRole = await Role.findOne({ key: key.toLowerCase() });
    if (existingRole) {
      return res.status(400).json({ message: 'Já existe um perfil com esta chave' });
    }

    // Validar permissões
    if (permissions && Array.isArray(permissions)) {
      const validPermissions = await Permission.find({ _id: { $in: permissions } });
      if (validPermissions.length !== permissions.length) {
        return res.status(400).json({ message: 'Uma ou mais permissões são inválidas' });
      }
    }

    const role = await Role.create({
      name,
      key: key.toLowerCase(),
      description,
      permissions: permissions || [],
      allowedTeams: allowedTeams || undefined, // undefined = todas as equipes
      active: active !== undefined ? active : true,
      isSystem: false, // Apenas perfis do sistema podem ter isSystem = true
    });

    const populatedRole = await Role.findById(role._id)
      .populate('permissions', 'name key resource action category')
      .populate('allowedTeams', 'name active');

    res.status(201).json({
      message: 'Perfil criado com sucesso',
      role: populatedRole,
    });
  } catch (error) {
    next(error);
  }
};

export const updateRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, description, permissions, allowedTeams, active } = req.body;
    const role = await Role.findById(req.params.id);

    if (!role) {
      return res.status(404).json({ message: 'Perfil não encontrado' });
    }

    console.log('[RoleController] Updating role:', {
      roleId: req.params.id,
      isSystem: role.isSystem,
      receivedData: { name, description, permissions: permissions?.length, allowedTeams: allowedTeams?.length, active }
    });

    // Não permitir editar perfis do sistema (exceto campos específicos)
    if (role.isSystem) {
      // Permitir apenas atualizar active, description e allowedTeams
      if (name !== undefined && name !== role.name) {
        return res.status(400).json({ message: 'Não é possível alterar o nome de um perfil do sistema' });
      }
      // Se permissions foi enviado e não é undefined, bloquear
      if (permissions !== undefined && permissions !== null) {
        return res.status(400).json({ message: 'Não é possível alterar as permissões de um perfil do sistema' });
      }
    }

    // Validar permissões se fornecidas
    if (permissions && Array.isArray(permissions)) {
      const validPermissions = await Permission.find({ _id: { $in: permissions } });
      if (validPermissions.length !== permissions.length) {
        return res.status(400).json({ message: 'Uma ou mais permissões são inválidas' });
      }
      role.permissions = permissions;
    }

    if (name !== undefined) role.name = name;
    if (description !== undefined) role.description = description;
    // Preparar dados de atualização
    const updateData: any = {};
    const unsetData: any = {};

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (active !== undefined) updateData.active = active;

    if (permissions && Array.isArray(permissions)) {
      updateData.permissions = permissions;
    }

    if (allowedTeams !== undefined) {
      // null = todas as equipes (sem restrição) - remover o campo
      // array vazio [] = nenhuma equipe
      // array com IDs = apenas essas equipes
      if (allowedTeams === null) {
        // Remover o campo usando $unset
        unsetData.allowedTeams = '';
      } else if (Array.isArray(allowedTeams) && allowedTeams.length === 0) {
        // Array vazio = nenhuma equipe
        updateData.allowedTeams = [];
      } else if (Array.isArray(allowedTeams)) {
        // Validar que todos os IDs são válidos ObjectIds
        const validTeamIds = allowedTeams.filter(id => {
          if (typeof id !== 'string') return false;
          return mongoose.Types.ObjectId.isValid(id);
        });
        
        if (validTeamIds.length !== allowedTeams.length) {
          return res.status(400).json({ message: 'Uma ou mais equipes são inválidas' });
        }
        
        // Verificar se as equipes existem
        const existingTeams = await Team.find({ _id: { $in: validTeamIds } });
        if (existingTeams.length !== validTeamIds.length) {
          return res.status(400).json({ message: 'Uma ou mais equipes não foram encontradas' });
        }
        
        // Converter para ObjectIds
        updateData.allowedTeams = validTeamIds.map(id => new mongoose.Types.ObjectId(id));
      } else {
        return res.status(400).json({ message: 'allowedTeams deve ser um array ou null' });
      }
    }

    console.log('[RoleController] Update data:', {
      updateData,
      unsetData
    });

    // Usar findByIdAndUpdate para aplicar $unset quando necessário
    const updateQuery: any = {};
    if (Object.keys(updateData).length > 0) {
      updateQuery.$set = updateData;
    }
    if (Object.keys(unsetData).length > 0) {
      updateQuery.$unset = unsetData;
    }

    const updatedRole = await Role.findByIdAndUpdate(
      req.params.id,
      updateQuery,
      { new: true, runValidators: true }
    );

    if (!updatedRole) {
      return res.status(404).json({ message: 'Perfil não encontrado' });
    }

    console.log('[RoleController] Role updated successfully');

    const populatedRole = await Role.findById(updatedRole._id)
      .populate('permissions', 'name key resource action category')
      .populate('allowedTeams', 'name active');

    res.json({
      message: 'Perfil atualizado com sucesso',
      role: populatedRole,
    });
  } catch (error: any) {
    console.error('[RoleController] Error updating role:', error);
    console.error('[RoleController] Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    next(error);
  }
};

export const deleteRole = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const role = await Role.findById(req.params.id);

    if (!role) {
      return res.status(404).json({ message: 'Perfil não encontrado' });
    }

    // Não permitir deletar perfis do sistema
    if (role.isSystem) {
      return res.status(400).json({ message: 'Não é possível deletar um perfil do sistema' });
    }

    // Verificar se há usuários usando este perfil
    const User = (await import('../models/User.js')).default;
    const usersWithRole = await User.countDocuments({ role: role._id });
    
    if (usersWithRole > 0) {
      return res.status(400).json({
        message: `Não é possível deletar este perfil. Existem ${usersWithRole} usuário(s) usando este perfil.`
      });
    }

    await Role.findByIdAndDelete(req.params.id);

    res.json({ message: 'Perfil removido com sucesso' });
  } catch (error) {
    next(error);
  }
};

