import mongoose, { Schema, Document } from 'mongoose';

export interface ISessionLog extends Document {
  userId: mongoose.Types.ObjectId;
  userName: string;
  userEmail: string;
  loginAt: Date;
  logoutAt?: Date;
  duration?: number; // em minutos
  ipAddress?: string;
  userAgent?: string;
  active: boolean; // true se ainda está logado
  createdAt: Date;
  updatedAt: Date;
}

const sessionLogSchema = new Schema<ISessionLog>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userName: {
      type: String,
      required: true,
    },
    userEmail: {
      type: String,
      required: true,
      index: true,
    },
    loginAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    logoutAt: {
      type: Date,
      default: null,
    },
    duration: {
      type: Number, // duração em minutos
      default: null,
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Índice composto para consultas eficientes
sessionLogSchema.index({ loginAt: -1 });
sessionLogSchema.index({ userId: 1, loginAt: -1 });
sessionLogSchema.index({ active: 1, loginAt: -1 });

const SessionLog = mongoose.model<ISessionLog>('SessionLog', sessionLogSchema);

export default SessionLog;

