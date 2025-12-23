import axios from 'axios';
import { UserFunction, UserProfile } from '../types';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Não faz nada especial para 401 - deixa o erro propagar
    // O componente que chamou vai tratar o erro
    // Não fazemos logout automático aqui para evitar loops
    return Promise.reject(error);
  }
);

export default api;

// Auth API
export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  
  register: (data: { name: string; email: string; password?: string; profile?: UserProfile; functions?: UserFunction[] }) =>
    api.post('/auth/register', data),
  
  getProfile: () =>
    api.get('/auth/profile'),
  
  updatePassword: (currentPassword: string, newPassword: string) =>
    api.put('/auth/password', { currentPassword, newPassword }),

  forceChangePassword: (newPassword: string) =>
    api.put('/auth/force-change-password', { newPassword }),
};

// Users API
export const usersAPI = {
  getAll: (params?: { active?: boolean; profile?: UserProfile; functions?: string; search?: string; hasAgenda?: boolean; team?: string }) =>
    api.get('/users', { params }),
  
  getById: (id: string) =>
    api.get(`/users/${id}`),
  
  create: (data: { name: string; email: string; password?: string; profile?: UserProfile; functions?: UserFunction[]; teams?: string[]; hasAgenda?: boolean }) =>
    api.post('/users', data),
  
  update: (id: string, data: Partial<{ 
    name: string; 
    email: string; 
    profile: UserProfile; 
    functions: UserFunction[]; 
    teams: string[];
    hasAgenda: boolean;
    active: boolean; 
    password: string;
    resetPassword: boolean;
  }>) =>
    api.put(`/users/${id}`, data),
  
  delete: (id: string) =>
    api.delete(`/users/${id}`),
  
  hardDelete: (id: string) =>
    api.delete(`/users/${id}/permanent`),
};

// Projects API
export const projectsAPI = {
  getAll: (params?: { active?: boolean; client?: string; projectType?: string; search?: string }) =>
    api.get('/projects', { params }),
  
  getById: (id: string) =>
    api.get(`/projects/${id}`),
  
  getClients: () =>
    api.get('/projects/clients'),
  
  getTypes: () =>
    api.get('/projects/types'),
  
  create: (data: { projectId: string; client: string; projectType: string; projectName: string; projectManager?: string }) =>
    api.post('/projects', data),
  
  update: (id: string, data: Partial<{ projectId: string; client: string; projectType: string; projectName: string; projectManager: string; active: boolean }>) =>
    api.put(`/projects/${id}`, data),
  
  delete: (id: string) =>
    api.delete(`/projects/${id}`),
};

// Allocations API
export const allocationsAPI = {
  getAll: (params?: { consultantId?: string; projectId?: string; startDate?: string; endDate?: string; status?: string; period?: string }) =>
    api.get('/allocations', { params }),
  
  getById: (id: string) =>
    api.get(`/allocations/${id}`),
  
  getAgenda: (startDate: string, endDate: string) =>
    api.get('/allocations/agenda', { params: { startDate, endDate } }),
  
  getHistory: (id: string) =>
    api.get(`/allocations/${id}/history`),
  
  create: (data: { consultantId: string; projectId?: string; date: string; period: string; timeSlot: string; status: string; artiaActivity?: string; notes?: string }) =>
    api.post('/allocations', data),
  
  createBulk: (allocations: Array<{ consultantId: string; projectId?: string; date: string; period: string; timeSlot: string; status: string; artiaActivity?: string; notes?: string }>) =>
    api.post('/allocations/bulk', { allocations }),
  
  copy: (data: { sourceStartDate: string; sourceEndDate: string; targetStartDate: string; consultantIds?: string[] }) =>
    api.post('/allocations/copy', data),
  
  update: (id: string, data: Partial<{ projectId: string; period: string; timeSlot: string; status: string; artiaActivity: string; notes: string }>) =>
    api.put(`/allocations/${id}`, data),
  
  delete: (id: string) =>
    api.delete(`/allocations/${id}`),
  
  deleteBulk: (ids: string[]) =>
    api.delete('/allocations/bulk/delete', { data: { ids } }),
  
  // Attachments
  addAttachment: (id: string, formData: FormData) =>
    api.post(`/allocations/${id}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  
  removeAttachment: (id: string, attachmentId: string) =>
    api.delete(`/allocations/${id}/attachments/${attachmentId}`),
};

// Status Config API
export const statusConfigAPI = {
  getAll: () =>
    api.get('/status-config'),
  
  create: (data: { key: string; label: string; color: string; textColor?: string; order?: number }) =>
    api.post('/status-config', data),
  
  update: (id: string, data: Partial<{ key: string; label: string; color: string; textColor: string; order: number; active: boolean }>) =>
    api.put(`/status-config/${id}`, data),
  
  delete: (id: string) =>
    api.delete(`/status-config/${id}`),
};

// Function Config API
export const functionConfigAPI = {
  getAll: (params?: { active?: boolean }) =>
    api.get('/function-config', { params }),
  
  create: (data: { key: string; label: string }) =>
    api.post('/function-config', data),
  
  update: (id: string, data: Partial<{ key: string; label: string; active: boolean }>) =>
    api.put(`/function-config/${id}`, data),
  
  delete: (id: string) =>
    api.delete(`/function-config/${id}`),
};

// Teams API
export const teamsAPI = {
  getAll: () =>
    api.get('/teams'),
  
  getActive: () =>
    api.get('/teams/active'),
  
  getVisible: () =>
    api.get('/teams/visible'),
  
  create: (data: { name: string }) =>
    api.post('/teams', data),
  
  update: (id: string, data: Partial<{ name: string; active: boolean }>) =>
    api.put(`/teams/${id}`, data),
  
  delete: (id: string) =>
    api.delete(`/teams/${id}`),
};

// Roles API
export const rolesAPI = {
  getAll: () =>
    api.get('/roles'),
  
  getById: (id: string) =>
    api.get(`/roles/${id}`),
  
  create: (data: {
    name: string;
    key: string;
    description?: string;
    permissions: string[];
    allowedTeams?: string[] | null;
    active?: boolean;
  }) =>
    api.post('/roles', data),
  
  update: (id: string, data: Partial<{
    name: string;
    description?: string;
    permissions: string[];
    allowedTeams?: string[] | null;
    active: boolean;
  }>) =>
    api.put(`/roles/${id}`, data),
  
  delete: (id: string) =>
    api.delete(`/roles/${id}`),
};

// Permissions API
export const permissionsAPI = {
  getAll: (params?: { category?: string; active?: boolean }) =>
    api.get('/permissions', { params }),
  
  getById: (id: string) =>
    api.get(`/permissions/${id}`),
  
  getByCategory: (category: string) =>
    api.get(`/permissions/category/${category}`),
};

// External Data API (MySQL Views)
export const externalDataAPI = {
  testConnection: () =>
    api.get('/external-data/test-connection'),
  
  listViews: () =>
    api.get('/external-data/views'),
  
  getViewData: (viewName: string, params?: { limit?: number; offset?: number }) =>
    api.get(`/external-data/views/${encodeURIComponent(viewName)}`, { params }),
  
  getViewStructure: (viewName: string) =>
    api.get(`/external-data/views/${encodeURIComponent(viewName)}/structure`),
  
  executeQuery: (query: string) =>
    api.post('/external-data/query', { query }),
};

// Middleware / Data Sync API
export const middlewareAPI = {
  getConfigs: () => api.get('/middleware'),
  getById: (id: string) => api.get(`/middleware/${id}`),
  create: (data: any) => api.post('/middleware', data),
  update: (id: string, data: any) => api.put(`/middleware/${id}`, data),
  remove: (id: string) => api.delete(`/middleware/${id}`),
  execute: (id: string) => api.post(`/middleware/${id}/execute`),
};
