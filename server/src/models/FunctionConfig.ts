import mongoose, { Schema } from 'mongoose';
import { IFunctionConfig } from '../types/index.js';

const functionConfigSchema = new Schema<IFunctionConfig>(
  {
    key: {
      type: String,
      required: [true, 'Chave da função é obrigatória'],
      unique: true,
      trim: true,
      lowercase: true,
    },
    label: {
      type: String,
      required: [true, 'Nome da função é obrigatório'],
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

// Indexes (key já tem índice via unique: true)
functionConfigSchema.index({ active: 1 });

const FunctionConfig = mongoose.model<IFunctionConfig>('FunctionConfig', functionConfigSchema);

export default FunctionConfig;

