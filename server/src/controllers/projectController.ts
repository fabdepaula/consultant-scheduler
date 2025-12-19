import { Request, Response, NextFunction } from 'express';
import Project from '../models/Project.js';

// Get all projects
export const getAllProjects = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { active, client, projectType, search } = req.query;
    
    const query: any = {};
    
    if (active !== undefined) {
      query.active = active === 'true';
    }
    
    if (client) {
      query.client = { $regex: client, $options: 'i' };
    }
    
    if (projectType) {
      query.projectType = { $regex: projectType, $options: 'i' };
    }
    
    if (search) {
      query.$or = [
        { projectId: { $regex: search, $options: 'i' } },
        { client: { $regex: search, $options: 'i' } },
        { projectName: { $regex: search, $options: 'i' } },
      ];
    }

    const projects = await Project.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({ projects });
  } catch (error) {
    next(error);
  }
};

// Get project by ID
export const getProjectById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const project = await Project.findById(req.params.id)
      .populate('createdBy', 'name email');
    
    if (!project) {
      return res.status(404).json({ message: 'Projeto não encontrado' });
    }

    res.json({ project });
  } catch (error) {
    next(error);
  }
};

// Create new project (gerente only)
export const createProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, client, projectType, projectName, projectManager } = req.body;

    // Check if project ID already exists
    const existingProject = await Project.findOne({ projectId });
    if (existingProject) {
      return res.status(400).json({ message: 'ID do projeto já existe' });
    }

    const project = await Project.create({
      projectId,
      client,
      projectType,
      projectName,
      projectManager,
      createdBy: req.user?._id,
    });

    res.status(201).json({
      message: 'Projeto criado com sucesso',
      project,
    });
  } catch (error) {
    next(error);
  }
};

// Update project (gerente only)
export const updateProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, client, projectType, projectName, projectManager, active } = req.body;
    const id = req.params.id;

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ message: 'Projeto não encontrado' });
    }

    // Check project ID uniqueness if changing
    if (projectId && projectId !== project.projectId) {
      const existingProject = await Project.findOne({ projectId });
      if (existingProject) {
        return res.status(400).json({ message: 'ID do projeto já existe' });
      }
    }

    // Update fields
    if (projectId) project.projectId = projectId;
    if (client) project.client = client;
    if (projectType) project.projectType = projectType;
    if (projectName) project.projectName = projectName;
    if (projectManager !== undefined) project.projectManager = projectManager;
    if (active !== undefined) project.active = active;

    await project.save();

    res.json({
      message: 'Projeto atualizado com sucesso',
      project,
    });
  } catch (error) {
    next(error);
  }
};

// Delete project (gerente only) - soft delete
export const deleteProject = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;

    const project = await Project.findById(id);
    if (!project) {
      return res.status(404).json({ message: 'Projeto não encontrado' });
    }

    // Soft delete
    project.active = false;
    await project.save();

    res.json({ message: 'Projeto desativado com sucesso' });
  } catch (error) {
    next(error);
  }
};

// Get unique clients list
export const getClients = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const clients = await Project.distinct('client', { active: true });
    res.json({ clients: clients.sort() });
  } catch (error) {
    next(error);
  }
};

// Get unique project types list
export const getProjectTypes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const projectTypes = await Project.distinct('projectType', { active: true });
    res.json({ projectTypes: projectTypes.sort() });
  } catch (error) {
    next(error);
  }
};


