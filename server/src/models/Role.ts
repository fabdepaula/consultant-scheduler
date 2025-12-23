import mongoose, { Schema } from 'mongoose';
import { IRole } from '../types/index.js';

const roleSchema = new Schema<IRole>(
  {
    name: {
      type: String,
      required: [true, 'Nome do perfil é obrigatório'],
      trim: true,
    },
    key: {
      type: String,
      required: [true, 'Chave do perfil é obrigatória'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      trim: true,
    },
    permissions: [{
      type: Schema.Types.ObjectId,
      ref: 'Permission',
    }],
    allowedTeams: {
      type: [{
        type: Schema.Types.ObjectId,
        ref: 'Team',
      }],
      default: undefined, // undefined = todas as equipes
    },
    active: {
      type: Boolean,
      default: true,
    },
    isSystem: {
      type: Boolean,
      default: false, // Perfis do sistema não podem ser deletados
    },
  },
  {
    timestamps: true,
  }
);

// Índices para consultas eficientes (key já tem índice via unique: true)
roleSchema.index({ active: 1 });
roleSchema.index({ isSystem: 1 });

const Role = mongoose.model<IRole>('Role', roleSchema);

export default Role;

