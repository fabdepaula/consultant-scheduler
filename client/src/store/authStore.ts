import { create } from 'zustand';
import { User } from '../types';
import { authAPI } from '../services/api';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  mustChangePassword: boolean;
  error: string | null;
  initialized: boolean;
  login: (email: string, password: string) => Promise<{ mustChangePassword: boolean }>;
  logout: () => void;
  checkAuth: () => Promise<void>;
  clearError: () => void;
  forceChangePassword: (newPassword: string) => Promise<void>;
  updateUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: localStorage.getItem('token'),
  isAuthenticated: false,
  isLoading: false,
  mustChangePassword: false,
  error: null,
  initialized: false,

  login: async (email: string, password: string) => {
    try {
      console.log('[AUTH] Login iniciado...');
      set({ error: null, isLoading: true });
      const response = await authAPI.login(email, password);
      const { token, user } = response.data;
      
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      
      const mustChangePassword = user.mustChangePassword || false;
      
      console.log('[AUTH] Atualizando estado...', { isAuthenticated: true, mustChangePassword });
      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        mustChangePassword,
        initialized: true,
      });
      
      console.log('[AUTH] Login completo!');
      return { mustChangePassword };
    } catch (error: any) {
      console.error('[AUTH] Erro no login:', error);
      const message = error.response?.data?.message || 'Erro ao fazer login';
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      mustChangePassword: false,
      error: null,
      initialized: true,
    });
  },

  checkAuth: async () => {
    console.log('[AUTH] checkAuth chamado', { initialized: get().initialized, isAuthenticated: get().isAuthenticated });
    
    // Se já foi inicializado e está autenticado, não precisa verificar novamente
    if (get().initialized && get().isAuthenticated) {
      console.log('[AUTH] Já autenticado, pulando verificação');
      return;
    }

    const token = localStorage.getItem('token');
    console.log('[AUTH] Token do localStorage:', token ? 'existe' : 'não existe');
    
    if (!token) {
      console.log('[AUTH] Sem token, marcando como não autenticado');
      set({ isLoading: false, isAuthenticated: false, initialized: true });
      return;
    }

    try {
      console.log('[AUTH] Verificando perfil com token...');
      set({ isLoading: true });
      const response = await authAPI.getProfile();
      const user = response.data.user;
      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
        mustChangePassword: user.mustChangePassword || false,
        initialized: true,
      });
    } catch (err) {
      console.error('[AUTH] Erro ao verificar perfil:', err);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        mustChangePassword: false,
        initialized: true,
      });
    }
  },

  forceChangePassword: async (newPassword: string) => {
    try {
      set({ isLoading: true, error: null });
      const response = await authAPI.forceChangePassword(newPassword);
      const user = response.data.user;
      
      localStorage.setItem('user', JSON.stringify(user));
      
      set({
        user,
        isLoading: false,
        mustChangePassword: false,
      });
    } catch (error: any) {
      const message = error.response?.data?.message || 'Erro ao alterar senha';
      set({ error: message, isLoading: false });
      throw new Error(message);
    }
  },

  updateUser: (user: User) => {
    localStorage.setItem('user', JSON.stringify(user));
    set({ user });
  },

  clearError: () => set({ error: null }),
}));
