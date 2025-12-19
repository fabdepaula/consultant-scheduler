import mongoose, { Schema, Document } from 'mongoose';

export type TransformationType =
  | 'trim'
  | 'lowercase'
  | 'uppercase'
  | 'toNumber'
  | 'toString'
  | 'toDate'
  | 'mapValue'
  | 'defaultValue';

export interface Transformation {
  type: TransformationType;
  options?: {
    dateFormat?: string;
    map?: { from: any; to: any }[];
    defaultValue?: any;
  };
}

export interface FieldMapping {
  sourceField: string;
  targetField: string;
  transformations?: Transformation[];
}

export interface SchedulePreset {
  type: 'daily' | 'weekly' | 'interval';
  intervalMinutes?: number; // usado quando type === 'interval'
  dayOfWeek?: number; // 0-6 (domingo-sábado) quando weekly
  timeOfDay?: string; // HH:mm opcional para daily/weekly
}

export interface ScheduleConfig {
  mode: 'none' | 'cron' | 'preset';
  cronExpression?: string;
  preset?: SchedulePreset;
}

export interface ExecutionError {
  type: 'validation' | 'duplicate' | 'required' | 'processing' | 'system';
  message: string;
  count: number;
  examples?: string[];
}

export interface ExecutionLog {
  status: 'success' | 'partial' | 'error';
  startedAt: Date;
  finishedAt: Date;
  inserted: number;
  updated: number;
  failed: number;
  totalRecords?: number;
  message?: string;
  errors?: ExecutionError[];
}

export interface IDataSyncConfig extends Document {
  name: string;
  description?: string;
  active: boolean;
  sourceView: string;
  targetCollection: 'projects' | 'users' | 'teams';
  targetApi: string;
  sourceKeyField: string;
  targetKeyField: string;
  filterClause?: string;
  mappings: FieldMapping[];
  schedule: ScheduleConfig;
  history: ExecutionLog[];
  createdAt: Date;
  updatedAt: Date;
}

const TransformationSchema = new Schema<Transformation>(
  {
    type: {
      type: String,
      enum: [
        'trim',
        'lowercase',
        'uppercase',
        'toNumber',
        'toString',
        'toDate',
        'mapValue',
        'defaultValue',
      ],
      required: true,
    },
    options: {
      dateFormat: { type: String },
      map: [
        {
          from: Schema.Types.Mixed,
          to: Schema.Types.Mixed,
          _id: false,
        },
      ],
      defaultValue: { type: Schema.Types.Mixed },
    },
  },
  { _id: false }
);

const FieldMappingSchema = new Schema<FieldMapping>(
  {
    sourceField: { type: String, required: true, trim: true },
    targetField: { type: String, required: true, trim: true },
    transformations: { type: [TransformationSchema], default: [] },
  },
  { _id: false }
);

const SchedulePresetSchema = new Schema<SchedulePreset>(
  {
    type: { type: String, enum: ['daily', 'weekly', 'interval'], required: true },
    intervalMinutes: { type: Number },
    dayOfWeek: { type: Number, min: 0, max: 6 },
    timeOfDay: { type: String }, // HH:mm
  },
  { _id: false }
);

const ScheduleConfigSchema = new Schema<ScheduleConfig>(
  {
    mode: { type: String, enum: ['none', 'cron', 'preset'], default: 'none' },
    cronExpression: { type: String },
    preset: { type: SchedulePresetSchema },
  },
  { _id: false }
);

const ExecutionErrorSchema = new Schema(
  {
    type: { type: String, enum: ['validation', 'duplicate', 'required', 'processing', 'system'], required: true },
    message: { type: String, required: true },
    count: { type: Number, required: true },
    examples: { type: [String], default: [] },
  },
  { _id: false }
);

const ExecutionLogSchema = new Schema<ExecutionLog>(
  {
    status: { type: String, enum: ['success', 'partial', 'error'], required: true },
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, required: true },
    inserted: { type: Number, default: 0 },
    updated: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    totalRecords: { type: Number },
    message: { type: String },
    errors: { type: [ExecutionErrorSchema], default: [] },
  },
  { _id: false }
);

const DataSyncConfigSchema = new Schema<IDataSyncConfig>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    active: { type: Boolean, default: true },
    sourceView: { type: String, required: true, trim: true },
    targetCollection: {
      type: String,
      enum: ['projects', 'users', 'teams'],
      required: true,
    },
    targetApi: { type: String, required: true, trim: true },
    sourceKeyField: { type: String, required: true, trim: true },
    targetKeyField: { type: String, required: true, trim: true },
    filterClause: { type: String, trim: true },
    mappings: { type: [FieldMappingSchema], default: [] },
    schedule: { type: ScheduleConfigSchema, default: { mode: 'none' } },
    history: { type: [ExecutionLogSchema], default: [] },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IDataSyncConfig>('DataSyncConfig', DataSyncConfigSchema);

