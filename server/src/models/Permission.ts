import mongoose, { Schema } from 'mongoose';
import { IPermission } from '../types/index.js';

const permissionSchema = new Schema<IPermission>(
  {
    name: {
      type: String,
      required: [true, 'Nome da permissão é obrigatório'],
      trim: true,
    },
    key: {
      type: String,
      required: [true, 'Chave da permissão é obrigatória'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    resource: {
      type: String,
      required: [true, 'Recurso é obrigatório'],
      trim: true,
      lowercase: true,
    },
    action: {
      type: String,
      required: [true, 'Ação é obrigatória'],
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Categoria é obrigatória'],
      trim: true,
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

// Índices para consultas eficientes (key já tem índice via unique: true)
permissionSchema.index({ resource: 1, action: 1 });
permissionSchema.index({ active: 1 });
permissionSchema.index({ category: 1 });

const Permission = mongoose.model<IPermission>('Permission', permissionSchema);

export default Permission;

