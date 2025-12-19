import mongoose, { Schema } from 'mongoose';
import { IProject } from '../types/index.js';

const projectSchema = new Schema<IProject>(
  {
    projectId: {
      type: String,
      required: [true, 'ID do projeto é obrigatório'],
      unique: true,
      trim: true,
    },
    client: {
      type: String,
      required: [true, 'Cliente é obrigatório'],
      trim: true,
    },
    projectType: {
      type: String,
      required: [true, 'Tipo do projeto é obrigatório'],
      trim: true,
    },
    projectName: {
      type: String,
      required: [true, 'Nome do projeto é obrigatório'],
      trim: true,
    },
    projectManager: {
      type: String,
      trim: true,
    },
    active: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient queries (projectId já tem índice via unique: true)
projectSchema.index({ client: 1 });
projectSchema.index({ projectType: 1 });
projectSchema.index({ active: 1 });

const Project = mongoose.model<IProject>('Project', projectSchema);

export default Project;


