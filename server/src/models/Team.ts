import mongoose, { Schema } from 'mongoose';
import { ITeam } from '../types/index.js';

const teamSchema = new Schema<ITeam>(
  {
    name: {
      type: String,
      required: [true, 'Nome da equipe é obrigatório'],
      unique: true,
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

// Indexes for efficient queries
teamSchema.index({ active: 1 });

const Team = mongoose.model<ITeam>('Team', teamSchema);

export default Team;

