import { Request, Response, NextFunction } from 'express';
import Team from '../models/Team.js';

// Get all teams
export const getAllTeams = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teams = await Team.find().sort({ name: 1 });
    res.json({ teams });
  } catch (error) {
    next(error);
  }
};

// Get active teams only
export const getActiveTeams = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teams = await Team.find({ active: true }).sort({ name: 1 });
    res.json({ teams });
  } catch (error) {
    next(error);
  }
};

// Create new team
export const createTeam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = req.body;

    // Check if name already exists
    const existing = await Team.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } });
    if (existing) {
      return res.status(400).json({ message: 'Já existe uma equipe com este nome' });
    }

    const team = await Team.create({ name });

    res.status(201).json({
      message: 'Equipe criada com sucesso',
      team,
    });
  } catch (error) {
    next(error);
  }
};

// Update team
export const updateTeam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, active } = req.body;
    const teamId = req.params.id;

    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(404).json({ message: 'Equipe não encontrada' });
    }

    // Check if new name already exists
    if (name && name !== team.name) {
      const existing = await Team.findOne({ 
        name: { $regex: new RegExp(`^${name}$`, 'i') },
        _id: { $ne: teamId }
      });
      if (existing) {
        return res.status(400).json({ message: 'Já existe uma equipe com este nome' });
      }
      team.name = name;
    }
    
    if (active !== undefined) team.active = active;

    await team.save();

    res.json({
      message: 'Equipe atualizada com sucesso',
      team,
    });
  } catch (error) {
    next(error);
  }
};

// Delete team
export const deleteTeam = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const teamId = req.params.id;

    const team = await Team.findByIdAndDelete(teamId);
    if (!team) {
      return res.status(404).json({ message: 'Equipe não encontrada' });
    }

    res.json({ message: 'Equipe removida com sucesso' });
  } catch (error) {
    next(error);
  }
};

