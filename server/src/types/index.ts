import { Document, Types } from 'mongoose';

// Perfil do usuário (nível de acesso)
export type UserProfile = 'admin' | 'usuario';

// Funções disponíveis
export type UserFunction = 
  | 'gerente'
  | 'import'
  | 'export'
  | 'cambio'
  | 'drawback'
  | 'recof'
  | 'suporte';

export type AllocationStatus = 
  | 'confirmado_presencial'
  | 'confirmado_remoto'
  | 'a_confirmar'
  | 'livre'
  | 'bloqueado'
  | 'conflito'
  | 'ponte'
  | 'feriado'
  | 'fim_semana';

export type Period = 'manha' | 'tarde' | 'noite';

export type TimeSlot = 
  | '08-10' 
  | '10-12' 
  | '13-15' 
  | '15-17' 
  | '18-20' 
  | '20-22';

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  profile: UserProfile;           // Nível de acesso (admin/usuario)
  functions: UserFunction[];      // Funções do consultor
  teams: Types.ObjectId[];        // Equipes que o usuário pertence
  hasAgenda: boolean;             // Se o usuário possui agenda (aparece no AgendaGrid)
  active: boolean;
  mustChangePassword: boolean;    // Força troca de senha no primeiro login
  googleId?: string;
  microsoftId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IProject extends Document {
  _id: Types.ObjectId;
  projectId: string;
  client: string;
  projectType: string;
  projectName: string;
  projectManager?: string;        // Gerente do projeto
  active: boolean;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAllocationHistory {
  _id?: Types.ObjectId;
  action: 'created' | 'updated' | 'status_changed' | 'attachment_added' | 'attachment_removed';
  field?: string;
  oldValue?: any;
  newValue?: any;
  changedBy: Types.ObjectId;
  changedAt: Date;
  description?: string;
}

export interface IAllocationAttachment {
  _id?: Types.ObjectId;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  path: string;
  uploadedBy: Types.ObjectId;
  uploadedAt: Date;
}

export interface IAllocation extends Document {
  _id: Types.ObjectId;
  consultantId: Types.ObjectId;
  projectId?: Types.ObjectId;
  date: Date;
  period: Period;
  timeSlot: TimeSlot;
  status: string; // Agora aceita qualquer status cadastrado
  artiaActivity?: string;
  notes?: string;
  attachments?: IAllocationAttachment[];
  history?: IAllocationHistory[];
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IStatusConfig extends Document {
  _id: Types.ObjectId;
  key: string;
  label: string;
  color: string;
  textColor: string;
  order: number;
  requiresProject: boolean;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFunctionConfig extends Document {
  _id: Types.ObjectId;
  key: string;
  label: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ITeam extends Document {
  _id: Types.ObjectId;
  name: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Data Sync (Middleware)
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
  updateBehavior?: 'update' | 'keep'; // 'update' = sempre atualiza, 'keep' = sempre mantém
}

export interface SchedulePreset {
  type: 'daily' | 'weekly' | 'interval';
  intervalMinutes?: number;
  dayOfWeek?: number;
  timeOfDay?: string;
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
  _id: Types.ObjectId;
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

export interface JwtPayload {
  id: string;
  email: string;
  profile: UserProfile;
}

declare global {
  namespace Express {
    interface User extends IUser {}
  }
}
