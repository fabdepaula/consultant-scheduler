import mongoose, { Schema } from 'mongoose';
import { IAllocation } from '../types/index.js';

// Schema para histórico de alterações
const historySchema = new Schema({
  action: {
    type: String,
    enum: ['created', 'updated', 'status_changed', 'attachment_added', 'attachment_removed'],
    required: true,
  },
  field: String,
  oldValue: Schema.Types.Mixed,
  newValue: Schema.Types.Mixed,
  changedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  changedAt: {
    type: Date,
    default: Date.now,
  },
  description: String,
}, { _id: true });

// Schema para anexos
const attachmentSchema = new Schema({
  filename: {
    type: String,
    required: true,
  },
  originalName: {
    type: String,
    required: true,
  },
  mimetype: {
    type: String,
    required: true,
  },
  size: {
    type: Number,
    required: true,
  },
  path: {
    type: String,
    required: true,
  },
  uploadedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
  },
}, { _id: true });

const allocationSchema = new Schema<IAllocation>(
  {
    consultantId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Consultor é obrigatório'],
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
    },
    date: {
      type: Date,
      required: [true, 'Data é obrigatória'],
    },
    period: {
      type: String,
      enum: ['manha', 'tarde', 'noite'],
      required: [true, 'Período é obrigatório'],
    },
    timeSlot: {
      type: String,
      enum: ['08-10', '10-12', '13-15', '15-17', '18-20', '20-22'],
      required: [true, 'Horário é obrigatório'],
    },
    status: {
      type: String,
      required: [true, 'Status é obrigatório'],
    },
    artiaActivity: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    attachments: [attachmentSchema],
    history: [historySchema],
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

// Indexes for efficient queries
allocationSchema.index({ consultantId: 1 });
allocationSchema.index({ projectId: 1 });
allocationSchema.index({ date: 1 });
allocationSchema.index({ status: 1 });
allocationSchema.index({ consultantId: 1, date: 1 });
allocationSchema.index({ consultantId: 1, date: 1, timeSlot: 1 });

const Allocation = mongoose.model<IAllocation>('Allocation', allocationSchema);

export default Allocation;
