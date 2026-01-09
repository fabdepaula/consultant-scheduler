import { create } from 'zustand';
import { User, Project, Allocation, BulkAllocationData, StatusConfig } from '../types';
import { usersAPI, projectsAPI, allocationsAPI, statusConfigAPI } from '../services/api';
import { startOfWeek, endOfWeek, format, addWeeks } from 'date-fns';

interface AgendaState {
  consultants: User[];
  projects: Project[];
  allocations: Allocation[];
  groupedAllocations: Record<string, Record<string, Allocation[]>>;
  statusConfigs: StatusConfig[];
  currentWeekStart: Date;
  weeksToShow: number;
  selectedConsultants: string[];
  isLoading: boolean;
  error: string | null;
  
  // Actions
  fetchConsultants: (includeInactive?: boolean) => Promise<void>;
  fetchProjects: () => Promise<void>;
  fetchAllocations: (startDate: Date, endDate: Date, silent?: boolean) => Promise<void>;
  fetchStatusConfigs: () => Promise<void>;
  setCurrentWeek: (date: Date) => void;
  setWeeksToShow: (weeks: number) => void;
  setSelectedConsultants: (ids: string[]) => void;
  nextWeek: () => void;
  prevWeek: () => void;
  
  // Allocation actions
  createAllocation: (data: any) => Promise<void>;
  createBulkAllocations: (data: BulkAllocationData) => Promise<void>;
  updateAllocation: (id: string, data: any) => Promise<void>;
  deleteAllocation: (id: string) => Promise<void>;
  
  // Consultant actions
  createConsultant: (data: any) => Promise<void>;
  updateConsultant: (id: string, data: any) => Promise<void>;
  deleteConsultant: (id: string) => Promise<void>;
  
  // Project actions
  createProject: (data: any) => Promise<void>;
  updateProject: (id: string, data: any) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  
  clearError: () => void;
  refreshData: () => Promise<void>;
}

export const useAgendaStore = create<AgendaState>((set, get) => ({
  consultants: [],
  projects: [],
  allocations: [],
  groupedAllocations: {},
  statusConfigs: [],
  currentWeekStart: startOfWeek(new Date(), { weekStartsOn: 1 }),
  weeksToShow: 1,
  selectedConsultants: [],
  isLoading: false,
  error: null,

  fetchConsultants: async (includeInactive = true) => {
    try {
      const params: any = includeInactive ? {} : { active: true };
      // Adicionar forAgenda=true para aplicar filtro de equipes permitidas
      params.forAgenda = 'true';
      const response = await usersAPI.getAll(params);
      set({ consultants: response.data.users });
    } catch (error: any) {
      set({ error: error.response?.data?.message || 'Erro ao carregar consultores' });
    }
  },

  fetchProjects: async () => {
    try {
      const response = await projectsAPI.getAll({});
      set({ projects: response.data.projects });
    } catch (error: any) {
      set({ error: error.response?.data?.message || 'Erro ao carregar projetos' });
    }
  },

  fetchStatusConfigs: async () => {
    try {
      const response = await statusConfigAPI.getAll();
      const configs = response.data.statuses || response.data.statusConfigs || response.data || [];
      set({ statusConfigs: Array.isArray(configs) ? configs : [] });
    } catch (error: any) {
      console.error('Erro ao carregar status configs:', error);
      set({ statusConfigs: [] });
    }
  },

  fetchAllocations: async (startDate: Date, endDate: Date, silent = false) => {
    try {
      // Apenas definir isLoading se não for uma atualização silenciosa
      if (!silent) {
        set({ isLoading: true });
      }
      
      const response = await allocationsAPI.getAgenda(
        format(startDate, 'yyyy-MM-dd'),
        format(endDate, 'yyyy-MM-dd')
      );
      
      // Comparar com dados existentes para evitar atualização desnecessária
      const currentAllocations = get().allocations;
      const currentGrouped = get().groupedAllocations;
      const newAllocations = response.data.allocations;
      const newGrouped = response.data.grouped;
      
      // Verificar se houve mudanças reais (comparação por IDs e timestamps)
      // Se não houver alocações anteriores, sempre atualizar (primeira carga)
      const hasChanges = currentAllocations.length === 0 || 
        JSON.stringify(currentAllocations.map((a: Allocation) => ({ 
          id: a._id || a.id, 
          status: a.status, 
          projectId: a.projectId, 
          consultantId: a.consultantId,
          date: a.date,
          timeSlot: a.timeSlot 
        }))) !== JSON.stringify(newAllocations.map((a: Allocation) => ({ 
          id: a._id || a.id, 
          status: a.status, 
          projectId: a.projectId, 
          consultantId: a.consultantId,
          date: a.date,
          timeSlot: a.timeSlot 
        }))) ||
        JSON.stringify(currentGrouped) !== JSON.stringify(newGrouped);
      
      // Só atualizar se houver mudanças ou se não for silencioso (primeira carga)
      if (hasChanges || !silent) {
        set({
          allocations: newAllocations,
          groupedAllocations: newGrouped,
          isLoading: false,
        });
      } else if (!silent) {
        // Se não houver mudanças mas não for silencioso, apenas remover loading
        set({ isLoading: false });
      }
    } catch (error: any) {
      set({
        error: error.response?.data?.message || 'Erro ao carregar alocações',
        isLoading: false,
      });
    }
  },

  setCurrentWeek: (date: Date) => {
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    set({ currentWeekStart: weekStart });
    const { weeksToShow } = get();
    const endDate = endOfWeek(addWeeks(weekStart, weeksToShow - 1), { weekStartsOn: 1 });
    get().fetchAllocations(weekStart, endDate);
  },

  setWeeksToShow: (weeks: number) => {
    set({ weeksToShow: weeks });
    const { currentWeekStart } = get();
    const endDate = endOfWeek(addWeeks(currentWeekStart, weeks - 1), { weekStartsOn: 1 });
    get().fetchAllocations(currentWeekStart, endDate);
  },

  setSelectedConsultants: (ids: string[]) => {
    set({ selectedConsultants: ids });
  },

  nextWeek: () => {
    const current = get().currentWeekStart;
    const next = new Date(current);
    next.setDate(next.getDate() + 7);
    get().setCurrentWeek(next);
  },

  prevWeek: () => {
    const current = get().currentWeekStart;
    const prev = new Date(current);
    prev.setDate(prev.getDate() - 7);
    get().setCurrentWeek(prev);
  },

  createAllocation: async (data) => {
    try {
      await allocationsAPI.create(data);
      await get().refreshData();
    } catch (error: any) {
      set({ error: error.response?.data?.message || 'Erro ao criar alocação' });
      throw error;
    }
  },

  createBulkAllocations: async (data: BulkAllocationData) => {
    try {
      // Gera todas as combinações de datas, períodos e horários
      const allocations: any[] = [];
      
      for (const date of data.dates) {
        for (const period of data.periods) {
          for (const timeSlot of data.timeSlots) {
            allocations.push({
              consultantId: data.consultantId,
              projectId: data.projectId,
              date,
              period,
              timeSlot,
              status: data.status,
              notes: data.notes,
            });
          }
        }
      }
      
      await allocationsAPI.createBulk(allocations);
      await get().refreshData();
    } catch (error: any) {
      set({ error: error.response?.data?.message || 'Erro ao criar alocações em massa' });
      throw error;
    }
  },

  updateAllocation: async (id, data) => {
    try {
      await allocationsAPI.update(id, data);
      await get().refreshData();
    } catch (error: any) {
      set({ error: error.response?.data?.message || 'Erro ao atualizar alocação' });
      throw error;
    }
  },

  deleteAllocation: async (id) => {
    try {
      await allocationsAPI.delete(id);
      await get().refreshData();
    } catch (error: any) {
      set({ error: error.response?.data?.message || 'Erro ao remover alocação' });
      throw error;
    }
  },

  createConsultant: async (data) => {
    try {
      await usersAPI.create(data);
      await get().fetchConsultants(true);
    } catch (error: any) {
      set({ error: error.response?.data?.message || 'Erro ao criar consultor' });
      throw error;
    }
  },

  updateConsultant: async (id, data) => {
    try {
      await usersAPI.update(id, data);
      await get().fetchConsultants(true);
    } catch (error: any) {
      set({ error: error.response?.data?.message || 'Erro ao atualizar consultor' });
      throw error;
    }
  },

  deleteConsultant: async (id) => {
    try {
      await usersAPI.delete(id);
      await get().fetchConsultants(true);
    } catch (error: any) {
      set({ error: error.response?.data?.message || 'Erro ao remover consultor' });
      throw error;
    }
  },

  createProject: async (data) => {
    try {
      await projectsAPI.create(data);
      await get().fetchProjects();
    } catch (error: any) {
      set({ error: error.response?.data?.message || 'Erro ao criar projeto' });
      throw error;
    }
  },

  updateProject: async (id, data) => {
    try {
      await projectsAPI.update(id, data);
      await get().fetchProjects();
    } catch (error: any) {
      set({ error: error.response?.data?.message || 'Erro ao atualizar projeto' });
      throw error;
    }
  },

  deleteProject: async (id) => {
    try {
      await projectsAPI.delete(id);
      await get().fetchProjects();
    } catch (error: any) {
      set({ error: error.response?.data?.message || 'Erro ao remover projeto' });
      throw error;
    }
  },

  refreshData: async () => {
    const { currentWeekStart, weeksToShow } = get();
    const endDate = endOfWeek(addWeeks(currentWeekStart, weeksToShow - 1), { weekStartsOn: 1 });
    await get().fetchAllocations(currentWeekStart, endDate);
  },

  clearError: () => set({ error: null }),
}));
