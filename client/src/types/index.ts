// Perfil do usuário (nível de acesso)
export type UserProfile = 'admin' | 'usuario';

// Funções disponíveis (um usuário pode ter múltiplas)
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

// Horários corrigidos: manhã 08-12, tarde 13-17, noite 18-22
export type TimeSlot = 
  | '08-10' 
  | '10-12' 
  | '13-15' 
  | '15-17' 
  | '18-20' 
  | '20-22';

// RBAC - Permissões e Perfis
export interface Permission {
  id: string;
  _id?: string;
  name: string;
  key: string;
  resource: string;
  action: string;
  description?: string;
  category: string;
  active: boolean;
}

export interface Role {
  id: string;
  _id?: string;
  name: string;
  key: string;
  description?: string;
  permissions: Permission[] | string[];
  allowedTeams?: Team[] | string[];
  active: boolean;
  isSystem: boolean;
}

export interface User {
  id: string;
  _id?: string;
  name: string;
  email: string;
  profile: UserProfile;      // Nível de acesso (admin/usuario) - DEPRECATED, manter para compatibilidade
  role?: Role | string;      // NOVO: Referência para Role
  functions: UserFunction[]; // Funções do consultor
  teams?: Team[] | string[]; // Equipes do usuário
  hasAgenda: boolean;        // Se o usuário possui agenda
  active: boolean;
  mustChangePassword?: boolean;
}

export interface Project {
  id: string;
  _id?: string;
  projectId: string;
  client: string;
  projectType: string;
  projectName: string;
  projectManager?: string;   // Gerente do projeto
  active: boolean;
  createdBy?: User;
}

export interface StatusConfig {
  id: string;
  _id?: string;
  key: string;
  label: string;
  color: string;
  textColor: string;
  order: number;
  requiresProject: boolean;
  active: boolean;
  showInContextMenu?: boolean;
}

export interface FunctionConfig {
  id: string;
  _id?: string;
  key: string;
  label: string;
  active: boolean;
}

export interface Team {
  id: string;
  _id?: string;
  name: string;
  active: boolean;
}

export interface AllocationHistory {
  _id?: string;
  action: 'created' | 'updated' | 'status_changed' | 'attachment_added' | 'attachment_removed';
  field?: string;
  oldValue?: any;
  newValue?: any;
  changedBy: User | string;
  changedAt: string;
  description?: string;
}

export interface AllocationAttachment {
  _id?: string;
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
  path: string;
  uploadedBy: User | string;
  uploadedAt: string;
}

export interface Allocation {
  id: string;
  _id?: string;
  consultantId: User | string;
  projectId?: Project | string | null;
  date: string;
  period: Period;
  timeSlot: TimeSlot;
  status: string; // Aceita qualquer status cadastrado
  artiaActivity?: string;
  notes?: string;
  attachments?: AllocationAttachment[];
  history?: AllocationHistory[];
  createdBy?: User | string;
  createdAt?: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  mustChangePassword: boolean;
}

export interface AllocationFormData {
  consultantId: string;
  projectId?: string;
  date: string;
  period: Period;
  timeSlot: TimeSlot;
  status: AllocationStatus;
  notes?: string;
}

// Alocação em massa
export interface BulkAllocationData {
  consultantId: string;
  projectId?: string;
  dates: string[];
  periods: Period[];
  timeSlots: TimeSlot[];
  status: AllocationStatus;
  notes?: string;
}

export const STATUS_LABELS: Record<AllocationStatus, string> = {
  confirmado_presencial: 'Confirmado Presencial',
  confirmado_remoto: 'Confirmado Remoto',
  a_confirmar: 'À Confirmar',
  livre: 'Livre',
  bloqueado: 'Bloqueado',
  conflito: 'Conflito',
  ponte: 'Ponte',
  feriado: 'Feriado',
  fim_semana: 'Final de Semana',
};

export const STATUS_COLORS: Record<AllocationStatus, string> = {
  confirmado_presencial: 'bg-status-confirmado-presencial',
  confirmado_remoto: 'bg-status-confirmado-remoto',
  a_confirmar: 'bg-status-a-confirmar',
  livre: 'bg-status-livre',
  bloqueado: 'bg-status-bloqueado',
  conflito: 'bg-status-conflito',
  ponte: 'bg-status-ponte',
  feriado: 'bg-status-feriado',
  fim_semana: 'bg-status-fim-semana',
};

export const PROFILE_LABELS: Record<UserProfile, string> = {
  admin: 'Administrador',
  usuario: 'Usuário',
};

export const FUNCTION_LABELS: Record<UserFunction, string> = {
  gerente: 'Gerente',
  import: 'Import',
  export: 'Export',
  cambio: 'Câmbio',
  drawback: 'Drawback',
  recof: 'Recof',
  suporte: 'Suporte',
};

export const PERIOD_LABELS: Record<Period, string> = {
  manha: 'manhã',
  tarde: 'tarde',
  noite: 'Extra',
};

// Horários corrigidos
export const TIME_SLOTS_BY_PERIOD: Record<Period, TimeSlot[]> = {
  manha: ['08-10', '10-12'],
  tarde: ['13-15', '15-17'],
  noite: ['18-20', '20-22'],
};

export const ALL_TIME_SLOTS: TimeSlot[] = [
  '08-10', '10-12', '13-15', '15-17', '18-20', '20-22'
];

export const TIME_SLOT_LABELS: Record<TimeSlot, string> = {
  '08-10': '08:00-10:00',
  '10-12': '10:00-12:00',
  '13-15': '13:00-15:00',
  '15-17': '15:00-17:00',
  '18-20': '18:00-20:00',
  '20-22': '20:00-22:00',
};

export const ALL_FUNCTIONS: UserFunction[] = [
  'gerente', 'import', 'export', 'cambio', 'drawback', 'recof', 'suporte'
];
