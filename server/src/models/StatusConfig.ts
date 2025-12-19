import mongoose, { Schema } from 'mongoose';
import { IStatusConfig } from '../types/index.js';

const statusConfigSchema = new Schema<IStatusConfig>(
  {
    key: {
      type: String,
      required: [true, 'Chave do status é obrigatória'],
      unique: true,
      trim: true,
    },
    label: {
      type: String,
      required: [true, 'Nome do status é obrigatório'],
      trim: true,
    },
    color: {
      type: String,
      required: [true, 'Cor do status é obrigatória'],
      default: '#CCCCCC',
    },
    textColor: {
      type: String,
      default: '#000000',
    },
    order: {
      type: Number,
      default: 0,
    },
    requiresProject: {
      type: Boolean,
      default: true, // Por padrão, status requer projeto
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes (key já tem índice via unique: true)
statusConfigSchema.index({ order: 1 });
statusConfigSchema.index({ active: 1 });

const StatusConfig = mongoose.model<IStatusConfig>('StatusConfig', statusConfigSchema);

export default StatusConfig;

