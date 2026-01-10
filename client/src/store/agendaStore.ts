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
  fetchAllocations: (startDate: Date, endDate: Date, silent?: boolean, forceUpdate?: boolean) => Promise<void>;
  fetchStatusConfigs: () => Promise<void>;
  setCurrentWeek: (date: Date) => void;
  setWeeksToShow: (weeks: number) => void;
  setSelectedConsultants: (ids: string[]) => void;
  nextWeek: () => void;
  prevWeek: () => void;
  
  // Allocation actions
  createAllocation: (data: any) => Promise<void>;
  createBulkAllocations: (data: BulkAllocationData) => Promise<void>;
  updateAllocation: (id: string, data: any, optimistic?: boolean) => Promise<void>;
  deleteAllocation: (id: string, optimistic?: boolean) => Promise<void>;
  updateAllocationLocally: (id: string, updates: Partial<Allocation>) => void;
  
  // Consultant actions
  createConsultant: (data: any) => Promise<void>;
  updateConsultant: (id: string, data: any) => Promise<void>;
  deleteConsultant: (id: string) => Promise<void>;
  
  // Project actions
  createProject: (data: any) => Promise<void>;
  updateProject: (id: string, data: any) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  
  clearError: () => void;
  refreshData: (silent?: boolean) => Promise<void>;
}

// Helper para formatar data de forma segura (sem problemas de timezone)
// IMPORTANTE: Datas que vêm do backend/MongoDB estão em UTC
// Para manter consistência com o backend, sempre usar UTC ao formatar
const formatDateSafe = (date: Date | string): string => {
  // Se já é string no formato "yyyy-MM-dd", retornar como está
  if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return date;
  }
  
  // Converter para Date se necessário
  const dateObj = date instanceof Date ? date : new Date(date);
  
  // IMPORTANTE: Usar UTC para formatar datas que vêm do backend
  // Isso garante que a chave será consistente com o que o backend criou
  // O backend salva datas como "2026-01-12T12:00:00.000Z" (UTC meio-dia)
  // E agrupa usando UTC, então devemos usar UTC aqui também
  const year = dateObj.getUTCFullYear();
  const month = String(dateObj.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getUTCDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

// Função helper para construir groupedAllocations a partir do array de allocations
// Isso garante consistência e novas referências sempre que necessário
const buildGroupedAllocations = (allocations: Allocation[]): Record<string, Record<string, Allocation[]>> => {
  const grouped: Record<string, Record<string, Allocation[]>> = {};
  
  allocations.forEach((allocation: Allocation) => {
    // Normalizar consultantId (pode ser string ou objeto populado)
    let consultantId: string;
    if (typeof allocation.consultantId === 'string') {
      consultantId = allocation.consultantId;
    } else if (allocation.consultantId && typeof allocation.consultantId === 'object') {
      consultantId = (allocation.consultantId as any)?._id?.toString() || (allocation.consultantId as any)?.id?.toString() || '';
    } else {
      consultantId = '';
    }
    
    if (!consultantId) return; // Pular se não tiver consultantId válido
    
    // Usar formatDateSafe em vez de format para evitar problemas de timezone
    // allocation.date pode vir como Date do MongoDB ou string ISO
    const dateKey = formatDateSafe(allocation.date);
    
    if (!grouped[consultantId]) {
      grouped[consultantId] = {};
    }
    if (!grouped[consultantId][dateKey]) {
      grouped[consultantId][dateKey] = [];
    }
    
    grouped[consultantId][dateKey].push(allocation);
  });
  
  return grouped;
};

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

  fetchAllocations: async (startDate: Date, endDate: Date, silent = false, forceUpdate = false) => {
    try {
      // Apenas definir isLoading se não for uma atualização silenciosa
      if (!silent) {
        set({ isLoading: true });
      }
      
      const response = await allocationsAPI.getAgenda(
        format(startDate, 'yyyy-MM-dd'),
        format(endDate, 'yyyy-MM-dd')
      );
      
      const newAllocations = response.data.allocations || [];
      
      // Se for silencioso (polling) E não for forçado, comparar para evitar atualização desnecessária
      if (silent && !forceUpdate) {
        const currentAllocations = get().allocations;
        
        // Comparação rápida: verificar se os IDs e status principais mudaram
        // Usar formatDateSafe para evitar problemas de timezone na comparação
        const currentIds = currentAllocations.map((a: Allocation) => ({
          id: a._id || a.id,
          status: a.status,
          projectId: typeof a.projectId === 'string' ? a.projectId : (a.projectId as any)?._id || (a.projectId as any)?.id,
          consultantId: typeof a.consultantId === 'string' ? a.consultantId : (a.consultantId as any)?._id || (a.consultantId as any)?.id,
          date: formatDateSafe(a.date),
          timeSlot: a.timeSlot
        })).sort((a: { id?: string }, b: { id?: string }) => (a.id || '').localeCompare(b.id || ''));
        
        const newIds = newAllocations.map((a: Allocation) => ({
          id: a._id || a.id,
          status: a.status,
          projectId: typeof a.projectId === 'string' ? a.projectId : (a.projectId as any)?._id || (a.projectId as any)?.id,
          consultantId: typeof a.consultantId === 'string' ? a.consultantId : (a.consultantId as any)?._id || (a.consultantId as any)?.id,
          date: formatDateSafe(a.date),
          timeSlot: a.timeSlot
        })).sort((a: { id?: string }, b: { id?: string }) => (a.id || '').localeCompare(b.id || ''));
        
        const hasChanges = JSON.stringify(currentIds) !== JSON.stringify(newIds);
        
        // Se não houver mudanças e for silencioso E não forçado, não atualizar
        if (!hasChanges) {
          // Remover loading se estava definido
          if (!silent) {
            set({ isLoading: false });
          }
          return;
        }
      }
      
      // Sempre atualizar se não for silencioso (refresh forçado) ou se detectou mudanças ou se forceUpdate=true
      // Usar helper para construir groupedAllocations a partir do array (garante consistência)
      const rebuiltGrouped = buildGroupedAllocations(newAllocations);
      
      set({
        allocations: [...newAllocations],
        groupedAllocations: rebuiltGrouped, // Nova estrutura reconstruída
        isLoading: false,
      });
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

  updateAllocationLocally: (id, updates) => {
    const state = get();
    
    // Encontrar a alocação atual
    const currentAllocation = state.allocations.find((a: Allocation) => {
      const allocationId = a._id || a.id;
      return allocationId === id || allocationId?.toString() === id?.toString();
    });

    if (!currentAllocation) {
      console.warn('Alocação não encontrada para atualização local:', id);
      return;
    }

    // Atualizar alocação no array (criar nova referência)
    const updatedAllocations = state.allocations.map((a: Allocation) => {
      const allocationId = a._id || a.id;
      if (allocationId === id || allocationId?.toString() === id?.toString()) {
        // Criar nova alocação com updates aplicados
        return { ...a, ...updates };
      }
      return a; // Retornar referência existente se não for a alocação atualizada
    });

    // RECONSTRUIR groupedAllocations do zero usando helper
    // Isso garante que sempre teremos a estrutura correta e novas referências
    const newGrouped = buildGroupedAllocations(updatedAllocations);

    // Atualizar estado com novas referências - isso garantirá que o React detecte a mudança
    set({ 
      allocations: updatedAllocations, // Nova referência do array
      groupedAllocations: newGrouped   // Nova estrutura completamente reconstruída
    });
  },

  updateAllocation: async (id, data, optimistic = true) => {
    try {
      // 1. Atualização otimista (imediata na UI) - apenas para mudanças rápidas como status
      if (optimistic) {
        // Atualizar localmente apenas o campo que está sendo alterado
        get().updateAllocationLocally(id, data);
      }

      // 2. Chamada à API
      await allocationsAPI.update(id, data);

      // 3. Após sucesso da API, SEMPRE fazer refresh completo para garantir sincronização
      // Se foi otimista, fazer refresh silencioso (sem loading) mas forçado
      // Se não foi otimista, fazer refresh completo com loading
      await get().refreshData(optimistic); // silent=optimistic, forceUpdate=true
    } catch (error: any) {
      // Em caso de erro, reverter fazendo refresh completo
      if (optimistic) {
        await get().refreshData();
      }
      set({ error: error.response?.data?.message || 'Erro ao atualizar alocação' });
      throw error;
    }
  },

  deleteAllocation: async (id, optimistic = true) => {
    try {
      // 1. Remover localmente imediatamente (se otimista)
      if (optimistic) {
        const state = get();
        
        // Remover do array de alocações
        const updatedAllocations = state.allocations.filter((a: Allocation) => {
          const allocationId = a._id || a.id;
          return allocationId !== id && allocationId?.toString() !== id?.toString();
        });

        // RECONSTRUIR groupedAllocations do zero usando helper
        const newGrouped = buildGroupedAllocations(updatedAllocations);

        set({ 
          allocations: updatedAllocations,
          groupedAllocations: newGrouped 
        });
      }

      // 2. Chamada à API
      await allocationsAPI.delete(id);

      // 3. Após sucesso, SEMPRE fazer refresh completo para garantir sincronização
      // Usar refreshData() que sempre força atualização
      await get().refreshData();
    } catch (error: any) {
      // Em caso de erro, fazer refresh completo para restaurar estado correto
      await get().refreshData();
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

  refreshData: async (silent = false) => {
    const { currentWeekStart, weeksToShow } = get();
    const startDate = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(addWeeks(startDate, weeksToShow - 1), { weekStartsOn: 1 });
    // Sempre forçar atualização (forceUpdate=true), mas pode ser silencioso
    await get().fetchAllocations(startDate, endDate, silent, true);
  },

  clearError: () => set({ error: null }),
}));
