import { Request, Response, NextFunction } from 'express';
import Allocation from '../models/Allocation.js';
import StatusConfig from '../models/StatusConfig.js';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';

// Get allocations with filters
export const getAllocations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { consultantId, projectId, startDate, endDate, status, period } = req.query;
    
    const query: any = {};
    
    if (consultantId) {
      query.consultantId = consultantId;
    }
    
    if (projectId) {
      query.projectId = projectId;
    }
    
    if (startDate || endDate) {
      query.date = {};
      if (startDate) {
        query.date.$gte = new Date(startDate as string);
      }
      if (endDate) {
        query.date.$lte = new Date(endDate as string);
      }
    }
    
    if (status) {
      query.status = status;
    }
    
    if (period) {
      query.period = period;
    }

    const allocations = await Allocation.find(query)
      .populate('consultantId', 'name email profile functions')
      .populate('projectId', 'projectId client projectName projectType')
      .populate('createdBy', 'name')
      .populate('history.changedBy', 'name')
      .populate('attachments.uploadedBy', 'name')
      .sort({ date: 1, timeSlot: 1 });

    res.json({ allocations });
  } catch (error) {
    next(error);
  }
};

// Get single allocation with full details
export const getAllocationById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allocation = await Allocation.findById(req.params.id)
      .populate('consultantId', 'name email profile functions')
      .populate('projectId', 'projectId client projectName projectType')
      .populate('createdBy', 'name')
      .populate('history.changedBy', 'name')
      .populate('attachments.uploadedBy', 'name');

    if (!allocation) {
      return res.status(404).json({ message: 'Alocação não encontrada' });
    }

    res.json({ allocation });
  } catch (error) {
    next(error);
  }
};

// Get allocations for agenda view (optimized for grid)
export const getAgendaAllocations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate e endDate são obrigatórios' });
    }

    const query: any = {
      date: {
        $gte: new Date(startDate as string),
        $lte: new Date(endDate as string),
      },
    };

    const allocations = await Allocation.find(query)
      .populate('consultantId', 'name email profile functions')
      .populate('projectId', 'projectId client projectName projectType')
      .populate('createdBy', 'name')
      .sort({ consultantId: 1, date: 1, timeSlot: 1 });

    // Group allocations by consultant and date
    const grouped: Record<string, Record<string, any[]>> = {};
    
    allocations.forEach((allocation) => {
      const consultantId = allocation.consultantId._id.toString();
      const dateKey = allocation.date.toISOString().split('T')[0];
      
      if (!grouped[consultantId]) {
        grouped[consultantId] = {};
      }
      if (!grouped[consultantId][dateKey]) {
        grouped[consultantId][dateKey] = [];
      }
      
      grouped[consultantId][dateKey].push(allocation);
    });

    res.json({ 
      allocations,
      grouped,
    });
  } catch (error) {
    next(error);
  }
};

// Create allocation (admin only)
export const createAllocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { consultantId, projectId, date, period, timeSlot, status, artiaActivity, notes } = req.body;
    
    // Criar datas separadas para não modificar a original
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Verificar se já existem alocações no mesmo slot ANTES de criar
    const existingAllocations = await Allocation.find({
      consultantId,
      date: {
        $gte: startOfDay,
        $lt: endOfDay
      },
      timeSlot
    });

    // Se já existem alocações, a nova deve ser criada como conflito
    const finalStatus = existingAllocations.length > 0 ? 'conflito' : status;

    const allocation = await Allocation.create({
      consultantId,
      projectId: projectId || null,
      date: new Date(date),
      period,
      timeSlot,
      status: finalStatus,
      artiaActivity,
      notes,
      createdBy: req.user!._id,
      history: [{
        action: 'created',
        changedBy: req.user?._id,
        changedAt: new Date(),
        description: existingAllocations.length > 0 
          ? 'Alocação criada com status CONFLITO (slot já ocupado)' 
          : 'Alocação criada',
      }],
    });

    // Se havia alocações existentes, atualizar TODAS para conflito
    if (existingAllocations.length > 0) {
      for (const existing of existingAllocations) {
        if (existing.status !== 'conflito') {
          existing.status = 'conflito';
          existing.history = existing.history || [];
          existing.history.push({
            action: 'status_changed',
            field: 'status',
            oldValue: existing.status,
            newValue: 'conflito',
            changedBy: req.user!._id,
            changedAt: new Date(),
            description: 'Status alterado para CONFLITO automaticamente (nova alocação no mesmo slot)',
          });
          await existing.save();
        }
      }
    }

    const populatedAllocation = await Allocation.findById(allocation._id)
      .populate('consultantId', 'name email profile functions')
      .populate('projectId', 'projectId client projectName projectType')
      .populate('createdBy', 'name');

    res.status(201).json({
      message: existingAllocations.length > 0 
        ? 'Alocação criada com CONFLITO (já existiam alocações neste slot)'
        : 'Alocação criada com sucesso',
      allocation: populatedAllocation,
      hasConflict: existingAllocations.length > 0,
    });
  } catch (error) {
    next(error);
  }
};

// Create multiple allocations at once (admin only)
export const createBulkAllocations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { allocations } = req.body;
    
    if (!Array.isArray(allocations) || allocations.length === 0) {
      return res.status(400).json({ message: 'Array de alocações é obrigatório' });
    }

    const results = {
      created: [] as any[],
      errors: [] as any[],
    };

    for (const alloc of allocations) {
      try {
        const allocation = await Allocation.create({
          ...alloc,
          date: new Date(alloc.date),
          createdBy: req.user!._id,
          history: [{
            action: 'created',
            changedBy: req.user!._id,
            changedAt: new Date(),
            description: 'Alocação criada em massa',
          }],
        });

        results.created.push(allocation);
      } catch (err: any) {
        results.errors.push({
          ...alloc,
          error: err.message,
        });
      }
    }

    res.status(201).json({
      message: `Criadas ${results.created.length} alocações`,
      ...results,
    });
  } catch (error) {
    next(error);
  }
};

// Update allocation (admin only)
export const updateAllocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { projectId, period, timeSlot, status, artiaActivity, notes } = req.body;
    const id = req.params.id;

    const allocation = await Allocation.findById(id);
    if (!allocation) {
      return res.status(404).json({ message: 'Alocação não encontrada' });
    }

    // Registrar alterações no histórico
    const changes: any[] = [];

    if (projectId !== undefined && allocation.projectId?.toString() !== projectId) {
      changes.push({
        action: 'updated',
        field: 'projectId',
        oldValue: allocation.projectId,
        newValue: projectId || null,
        changedBy: req.user?._id,
        changedAt: new Date(),
        description: 'Projeto alterado',
      });
      allocation.projectId = projectId || undefined;
    }

    if (period && allocation.period !== period) {
      changes.push({
        action: 'updated',
        field: 'period',
        oldValue: allocation.period,
        newValue: period,
        changedBy: req.user?._id,
        changedAt: new Date(),
        description: 'Período alterado',
      });
      allocation.period = period;
    }

    if (timeSlot && allocation.timeSlot !== timeSlot) {
      changes.push({
        action: 'updated',
        field: 'timeSlot',
        oldValue: allocation.timeSlot,
        newValue: timeSlot,
        changedBy: req.user?._id,
        changedAt: new Date(),
        description: 'Horário alterado',
      });
      allocation.timeSlot = timeSlot;
    }

    if (status && allocation.status !== status) {
      changes.push({
        action: 'status_changed',
        field: 'status',
        oldValue: allocation.status,
        newValue: status,
        changedBy: req.user?._id,
        changedAt: new Date(),
        description: `Status alterado de "${allocation.status}" para "${status}"`,
      });
      allocation.status = status;

      // Verifica se o novo status requer projeto
      const statusConfig = await StatusConfig.findOne({ key: status });
      if (statusConfig && statusConfig.requiresProject === false) {
        // Se o status não requer projeto, limpa o projeto
        if (allocation.projectId) {
          changes.push({
            action: 'updated',
            field: 'projectId',
            oldValue: allocation.projectId,
            newValue: null,
            changedBy: req.user!._id,
            changedAt: new Date(),
            description: 'Projeto removido automaticamente (status não requer projeto)',
          });
          allocation.projectId = undefined;
        }
      }
    }

    if (artiaActivity !== undefined && allocation.artiaActivity !== artiaActivity) {
      changes.push({
        action: 'updated',
        field: 'artiaActivity',
        oldValue: allocation.artiaActivity,
        newValue: artiaActivity,
        changedBy: req.user?._id,
        changedAt: new Date(),
        description: 'Atividade Artia alterada',
      });
      allocation.artiaActivity = artiaActivity;
    }

    if (notes !== undefined && allocation.notes !== notes) {
      changes.push({
        action: 'updated',
        field: 'notes',
        oldValue: allocation.notes,
        newValue: notes,
        changedBy: req.user?._id,
        changedAt: new Date(),
        description: 'Observações alteradas',
      });
      allocation.notes = notes;
    }

    // Adicionar alterações ao histórico
    if (changes.length > 0) {
      allocation.history = [...(allocation.history || []), ...changes];
    }

    await allocation.save();

    const populatedAllocation = await Allocation.findById(allocation._id)
      .populate('consultantId', 'name email profile functions')
      .populate('projectId', 'projectId client projectName projectType')
      .populate('createdBy', 'name')
      .populate('history.changedBy', 'name');

    res.json({
      message: 'Alocação atualizada com sucesso',
      allocation: populatedAllocation,
    });
  } catch (error) {
    next(error);
  }
};

// Add attachment to allocation
export const addAttachment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ message: 'Arquivo é obrigatório' });
    }

    const allocation = await Allocation.findById(id);
    if (!allocation) {
      // Remove arquivo se alocação não existir
      if (file.path) fs.unlinkSync(file.path);
      return res.status(404).json({ message: 'Alocação não encontrada' });
    }

    const attachment = {
      filename: file.filename,
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: file.path,
      uploadedBy: req.user!._id,
      uploadedAt: new Date(),
    };

    allocation.attachments = [...(allocation.attachments || []), attachment];
    
    // Registrar no histórico
    allocation.history = [...(allocation.history || []), {
      action: 'attachment_added',
      field: 'attachments',
      newValue: file.originalname,
      changedBy: req.user?._id,
      changedAt: new Date(),
      description: `Arquivo "${file.originalname}" anexado`,
    }];

    await allocation.save();

    const populatedAllocation = await Allocation.findById(allocation._id)
      .populate('consultantId', 'name email profile functions')
      .populate('projectId', 'projectId client projectName projectType')
      .populate('createdBy', 'name')
      .populate('attachments.uploadedBy', 'name');

    res.json({
      message: 'Arquivo anexado com sucesso',
      allocation: populatedAllocation,
    });
  } catch (error) {
    next(error);
  }
};

// Remove attachment from allocation
export const removeAttachment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, attachmentId } = req.params;

    const allocation = await Allocation.findById(id);
    if (!allocation) {
      return res.status(404).json({ message: 'Alocação não encontrada' });
    }

    const attachment = allocation.attachments?.find(
      (a: any) => a._id.toString() === attachmentId
    );

    if (!attachment) {
      return res.status(404).json({ message: 'Anexo não encontrado' });
    }

    // Remove arquivo do disco
    if (attachment.path && fs.existsSync(attachment.path)) {
      fs.unlinkSync(attachment.path);
    }

    // Remove do array
    allocation.attachments = allocation.attachments?.filter(
      (a: any) => a._id.toString() !== attachmentId
    );

    // Registrar no histórico
    allocation.history = [...(allocation.history || []), {
      action: 'attachment_removed',
      field: 'attachments',
      oldValue: attachment.originalName,
      changedBy: req.user?._id,
      changedAt: new Date(),
      description: `Arquivo "${attachment.originalName}" removido`,
    }];

    await allocation.save();

    res.json({ message: 'Anexo removido com sucesso' });
  } catch (error) {
    next(error);
  }
};

// Get allocation history
export const getAllocationHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const allocation = await Allocation.findById(req.params.id)
      .select('history')
      .populate('history.changedBy', 'name email');

    if (!allocation) {
      return res.status(404).json({ message: 'Alocação não encontrada' });
    }

    res.json({ history: allocation.history || [] });
  } catch (error) {
    next(error);
  }
};

// Delete allocation (admin only)
export const deleteAllocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id;

    const allocation = await Allocation.findById(id);
    if (!allocation) {
      return res.status(404).json({ message: 'Alocação não encontrada' });
    }

    // Guardar dados do slot antes de excluir para verificar conflitos depois
    const { consultantId, date, timeSlot } = allocation;
    const allocationDate = new Date(date);

    // Remove arquivos anexados
    if (allocation.attachments && allocation.attachments.length > 0) {
      for (const attachment of allocation.attachments) {
        if (attachment.path && fs.existsSync(attachment.path)) {
          fs.unlinkSync(attachment.path);
        }
      }
    }

    await Allocation.findByIdAndDelete(id);

    // Verificar se restam alocações no mesmo slot
    const remainingAllocations = await Allocation.find({
      consultantId,
      date: {
        $gte: new Date(new Date(allocationDate).setHours(0, 0, 0, 0)),
        $lt: new Date(new Date(allocationDate).setHours(23, 59, 59, 999))
      },
      timeSlot
    });

    // Se restar apenas 1 alocação e ela estiver com status conflito, mudar para a_confirmar
    if (remainingAllocations.length === 1) {
      const remaining = remainingAllocations[0];
      if (remaining.status === 'conflito') {
        remaining.status = 'a_confirmar';
        remaining.history = remaining.history || [];
        remaining.history.push({
          action: 'status_changed',
          field: 'status',
          oldValue: 'conflito',
          newValue: 'a_confirmar',
          changedBy: req.user?._id,
          changedAt: new Date(),
          description: 'Status alterado para À CONFIRMAR automaticamente (conflito resolvido)',
        });
        await remaining.save();
      }
    }

    res.json({ 
      message: 'Alocação removida com sucesso',
      conflictResolved: remainingAllocations.length === 1
    });
  } catch (error) {
    next(error);
  }
};

// Delete multiple allocations (admin only)
export const deleteBulkAllocations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: 'Array de IDs é obrigatório' });
    }

    // Remove arquivos anexados de todas as alocações
    const allocations = await Allocation.find({
      _id: { $in: ids.map(id => new mongoose.Types.ObjectId(id)) },
    });

    for (const allocation of allocations) {
      if (allocation.attachments && allocation.attachments.length > 0) {
        for (const attachment of allocation.attachments) {
          if (attachment.path && fs.existsSync(attachment.path)) {
            fs.unlinkSync(attachment.path);
          }
        }
      }
    }

    const result = await Allocation.deleteMany({
      _id: { $in: ids.map(id => new mongoose.Types.ObjectId(id)) },
    });

    res.json({ 
      message: `${result.deletedCount} alocações removidas`,
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    next(error);
  }
};

// Copy allocations from one period to another (admin only)
export const copyAllocations = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sourceStartDate, sourceEndDate, targetStartDate, consultantIds } = req.body;

    const sourceStart = new Date(sourceStartDate);
    const sourceEnd = new Date(sourceEndDate);
    const targetStart = new Date(targetStartDate);

    const daysDiff = Math.floor((targetStart.getTime() - sourceStart.getTime()) / (1000 * 60 * 60 * 24));

    const query: any = {
      date: {
        $gte: sourceStart,
        $lte: sourceEnd,
      },
    };

    if (consultantIds && consultantIds.length > 0) {
      query.consultantId = { $in: consultantIds };
    }

    const sourceAllocations = await Allocation.find(query);

    let created = 0;

    for (const alloc of sourceAllocations) {
      const newDate = new Date(alloc.date);
      newDate.setDate(newDate.getDate() + daysDiff);

      await Allocation.create({
        consultantId: alloc.consultantId,
        projectId: alloc.projectId,
        date: newDate,
        period: alloc.period,
        timeSlot: alloc.timeSlot,
        status: alloc.status,
        artiaActivity: alloc.artiaActivity,
        notes: alloc.notes,
        createdBy: req.user!._id,
        history: [{
          action: 'created',
          changedBy: req.user?._id,
          changedAt: new Date(),
          description: 'Alocação copiada',
        }],
      });

      created++;
    }

    res.json({
      message: `Copiadas ${created} alocações`,
      created,
    });
  } catch (error) {
    next(error);
  }
};
