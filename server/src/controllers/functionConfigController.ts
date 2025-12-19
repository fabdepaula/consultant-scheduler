import { Request, Response, NextFunction } from 'express';
import FunctionConfig from '../models/FunctionConfig.js';

// Get all function configurations
export const getAllFunctions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { active } = req.query;
    const query: any = {};
    
    // Se active for especificado, filtrar por status
    if (active !== undefined) {
      query.active = active === 'true';
    }
    
    const functions = await FunctionConfig.find(query).sort({ label: 1 });
    res.json({ functions });
  } catch (error) {
    next(error);
  }
};

// Create new function
export const createFunction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key, label } = req.body;

    // Check if key already exists
    const existing = await FunctionConfig.findOne({ key: key.toLowerCase() });
    if (existing) {
      return res.status(400).json({ message: 'Já existe uma função com esta chave' });
    }

    const func = await FunctionConfig.create({
      key: key.toLowerCase(),
      label,
    });

    res.status(201).json({
      message: 'Função criada com sucesso',
      function: func,
    });
  } catch (error) {
    next(error);
  }
};

// Update function
export const updateFunction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { label, active } = req.body;
    const funcId = req.params.id;

    const func = await FunctionConfig.findById(funcId);
    if (!func) {
      return res.status(404).json({ message: 'Função não encontrada' });
    }

    if (label !== undefined) func.label = label;
    if (active !== undefined) func.active = active;

    await func.save();

    res.json({
      message: 'Função atualizada com sucesso',
      function: func,
    });
  } catch (error) {
    next(error);
  }
};

// Delete function
export const deleteFunction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const funcId = req.params.id;

    const func = await FunctionConfig.findByIdAndDelete(funcId);
    if (!func) {
      return res.status(404).json({ message: 'Função não encontrada' });
    }

    res.json({ message: 'Função removida com sucesso' });
  } catch (error) {
    next(error);
  }
};

