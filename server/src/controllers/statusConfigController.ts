import { Request, Response, NextFunction } from 'express';
import StatusConfig from '../models/StatusConfig.js';

// Get all status configurations
export const getAllStatuses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const statuses = await StatusConfig.find().sort({ order: 1 });
    res.json({ statuses });
  } catch (error) {
    next(error);
  }
};

// Create new status
export const createStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key, label, color, textColor, order, requiresProject, showInContextMenu } = req.body;

    // Check if key already exists
    const existing = await StatusConfig.findOne({ key: key.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: 'Já existe um status com esta chave' });
    }

    const status = await StatusConfig.create({
      key: key.toLowerCase(),
      label,
      color,
      textColor: textColor || '#000000',
      order: order || 0,
      requiresProject: requiresProject !== undefined ? requiresProject : true,
      showInContextMenu: showInContextMenu || false,
    });

    res.status(201).json({
      message: 'Status criado com sucesso',
      status,
    });
  } catch (error) {
    next(error);
  }
};

// Update status
export const updateStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { label, color, textColor, order, active, requiresProject, showInContextMenu } = req.body;
    const statusId = req.params.id;

    const status = await StatusConfig.findById(statusId);
    if (!status) {
      return res.status(404).json({ message: 'Status não encontrado' });
    }

    if (label !== undefined) status.label = label;
    if (color !== undefined) status.color = color;
    if (textColor !== undefined) status.textColor = textColor;
    if (order !== undefined) status.order = order;
    if (active !== undefined) status.active = active;
    if (requiresProject !== undefined) status.requiresProject = requiresProject;
    if (showInContextMenu !== undefined) status.showInContextMenu = showInContextMenu;

    await status.save();

    res.json({
      message: 'Status atualizado com sucesso',
      status,
    });
  } catch (error) {
    next(error);
  }
};

// Delete status
export const deleteStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const statusId = req.params.id;

    const status = await StatusConfig.findByIdAndDelete(statusId);
    if (!status) {
      return res.status(404).json({ message: 'Status não encontrado' });
    }

    res.json({ message: 'Status removido com sucesso' });
  } catch (error) {
    next(error);
  }
};

