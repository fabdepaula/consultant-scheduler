import { useEffect, useState, useRef } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  X,
  Save,
  UserCheck,
  UserX,
  KeyRound,
  Calendar,
  Users2,
  ChevronDown,
  Check
} from 'lucide-react';
import { useAgendaStore } from '../store/agendaStore';
import { teamsAPI, functionConfigAPI, rolesAPI, usersAPI } from '../services/api';
import { User, UserProfile, UserFunction, Team, PROFILE_LABELS, FunctionConfig, Role } from '../types';

// Componente MultiSelect Dropdown
interface MultiSelectProps<T extends string> {
  label: string;
  icon?: React.ReactNode;
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (selected: T[]) => void;
  placeholder?: string;
}

function MultiSelectDropdown<T extends string>({ label, icon, options, selected, onChange, placeholder = "Selecione..." }: MultiSelectProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleOption = (value: T) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const selectedLabels = selected.map(v => options.find(o => o.value === v)?.label || v);

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {icon}
        {label}
      </label>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between bg-white border border-slate-300 rounded-lg px-4 py-2 text-left text-slate-900 hover:border-ngr-secondary focus:outline-none focus:border-ngr-secondary focus:ring-2 focus:ring-ngr-secondary/20"
      >
        <span className={selected.length === 0 ? 'text-slate-400' : 'text-slate-900'}>
          {selected.length === 0 ? placeholder : `${selected.length} selecionado(s)`}
        </span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {/* Tags das seleções */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedLabels.map((label, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-ngr-light text-ngr-secondary rounded text-xs font-medium"
            >
              {label}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleOption(selected[idx]);
                }}
                className="hover:text-red-500"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {options.map((option) => {
            const isSelected = selected.includes(option.value);
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => toggleOption(option.value)}
                className={`w-full flex items-center gap-2 px-4 py-2 text-left text-sm hover:bg-slate-50 ${isSelected ? 'bg-ngr-light' : ''}`}
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-ngr-secondary border-ngr-secondary' : 'border-slate-300'}`}>
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
                <span className={isSelected ? 'text-ngr-primary font-medium' : 'text-slate-700'}>{option.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ConsultantFormData {
  name: string;
  email: string;
  password: string;
  profile: UserProfile; // Mantido para compatibilidade
  role: string; // ID do role
  functions: UserFunction[];
  teams: string[];
  hasAgenda: boolean;
}

export default function Consultants() {
  const { consultants, createConsultant, updateConsultant, deleteConsultant, error, clearError } = useAgendaStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingConsultant, setEditingConsultant] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableTeams, setAvailableTeams] = useState<Team[]>([]);
  const [availableFunctions, setAvailableFunctions] = useState<FunctionConfig[]>([]);
  const [availableRoles, setAvailableRoles] = useState<Role[]>([]);
  const [formData, setFormData] = useState<ConsultantFormData>({
    name: '',
    email: '',
    password: '',
    profile: 'usuario', // Mantido para compatibilidade
    role: '', // ID do role
    functions: [],
    teams: [],
    hasAgenda: false
  });

  useEffect(() => {
    fetchAllUsers(); // Usar função separada que não aplica filtro de equipes
    fetchTeams();
    fetchFunctions();
    fetchRoles();
  }, []);

  // Função separada para buscar todos os usuários (sem filtro de equipes)
  const fetchAllUsers = async () => {
    try {
      const response = await usersAPI.getAll({}); // Não enviar forAgenda
      useAgendaStore.setState({ consultants: response.data.users });
    } catch (error: any) {
      console.error('Error fetching users:', error);
      useAgendaStore.setState({ error: error.response?.data?.message || 'Erro ao carregar usuários' });
    }
  };

  const fetchRoles = async () => {
    try {
      console.log('[Consultants] Fetching roles...');
      const response = await rolesAPI.getAll();
      console.log('[Consultants] Roles response:', response.data);
      // Filtrar apenas perfis ativos
      const activeRoles = (response.data.roles || []).filter((r: Role) => r.active);
      console.log('[Consultants] Active roles:', activeRoles);
      setAvailableRoles(activeRoles);
      if (activeRoles.length === 0) {
        console.warn('[Consultants] Nenhum perfil ativo encontrado');
      }
    } catch (err: any) {
      console.error('[Consultants] Error fetching roles:', err);
      console.error('[Consultants] Error details:', err.response?.data || err.message);
      // Em caso de erro, definir array vazio para evitar crash
      setAvailableRoles([]);
    }
  };

  const fetchFunctions = async () => {
    try {
      const response = await functionConfigAPI.getAll();
      // Filtrar apenas funções ativas
      const activeFunctions = (response.data.functions || []).filter((f: FunctionConfig) => f.active);
      setAvailableFunctions(activeFunctions);
    } catch (err) {
      console.error('Error fetching functions:', err);
    }
  };

  // Helper para buscar o label de uma função pelo key
  const getFunctionLabel = (key: string): string => {
    const func = availableFunctions.find(f => f.key === key);
    return func ? func.label : key;
  };

  const fetchTeams = async () => {
    try {
      const response = await teamsAPI.getActive();
      setAvailableTeams(response.data.teams || []);
    } catch (err) {
      console.error('Error fetching teams:', err);
    }
  };

  const filteredConsultants = consultants.filter(c => 
    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.functions || []).some(f => f.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const openCreateModal = () => {
    setEditingConsultant(null);
    // Buscar role padrão "usuario" se existir
    const defaultRole = availableRoles.find(r => r.key === 'usuario');
    setFormData({
      name: '',
      email: '',
      password: '',
      profile: 'usuario', // Mantido para compatibilidade
      role: defaultRole ? (defaultRole._id || defaultRole.id) : '',
      functions: [],
      teams: [],
      hasAgenda: false
    });
    setModalOpen(true);
  };

  const openEditModal = (consultant: User) => {
    setEditingConsultant(consultant);
    // Extrair IDs das equipes (podem vir como objetos ou strings)
    const teamIds = (consultant.teams || []).map(t => 
      typeof t === 'string' ? t : (t._id || t.id)
    );
    // Extrair ID do role (pode vir como objeto ou string)
    const roleId = consultant.role 
      ? (typeof consultant.role === 'object' ? (consultant.role._id || consultant.role.id) : consultant.role)
      : '';
    
    console.log('[Consultants] openEditModal - consultant:', {
      name: consultant.name,
      profile: consultant.profile,
      role: consultant.role,
      roleId: roleId
    });
    
    setFormData({
      name: consultant.name,
      email: consultant.email,
      password: '',
      profile: consultant.profile, // Mantido para compatibilidade
      role: roleId,
      functions: consultant.functions || [],
      teams: teamIds,
      hasAgenda: consultant.hasAgenda || false
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingConsultant) {
        const updateData: any = {
          name: formData.name,
          email: formData.email,
          profile: formData.profile, // Mantido para compatibilidade
          role: formData.role, // NOVO: enviar role
          functions: formData.functions,
          teams: formData.teams,
          hasAgenda: formData.hasAgenda
        };
        if (formData.password) {
          updateData.password = formData.password;
        }
        await updateConsultant(editingConsultant._id || editingConsultant.id, updateData);
      } else {
        await createConsultant({
          name: formData.name,
          email: formData.email,
          password: formData.password || undefined, // Usa senha padrão se vazio
          profile: formData.profile, // Mantido para compatibilidade
          role: formData.role, // NOVO: enviar role
          functions: formData.functions,
          teams: formData.teams,
          hasAgenda: formData.hasAgenda
        });
      }
      setModalOpen(false);
      fetchAllUsers(); // Recarregar lista sem filtro de equipes
    } catch (err) {
      console.error('Error saving consultant:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (consultant: User) => {
    if (!confirm(`Tem certeza que deseja desativar o usuário "${consultant.name}"?`)) return;
    
    try {
      await deleteConsultant(consultant._id || consultant.id);
      fetchAllUsers(); // Recarregar lista sem filtro de equipes
    } catch (err) {
      console.error('Error deleting consultant:', err);
    }
  };

  const handleToggleActive = async (consultant: User) => {
    try {
      const newActive = !consultant.active;
      const payload: any = { active: newActive };

      // Regra: ao desativar, agenda deve ficar como "Não" por padrão
      if (!newActive) {
        payload.hasAgenda = false;
      }

      await updateConsultant(consultant._id || consultant.id, payload);
      fetchAllUsers(); // Recarregar lista sem filtro de equipes
    } catch (err) {
      console.error('Error toggling consultant status:', err);
    }
  };

  const handleToggleAgenda = async (consultant: User) => {
    try {
      const newHasAgenda = !consultant.hasAgenda;
      await updateConsultant(consultant._id || consultant.id, { hasAgenda: newHasAgenda });
      fetchAllUsers(); // Recarregar lista sem filtro de equipes
    } catch (err) {
      console.error('Error toggling consultant agenda:', err);
    }
  };

  const handleResetPassword = async (consultant: User) => {
    if (!confirm(`Resetar a senha de "${consultant.name}" para a senha padrão (Ngr@123)?`)) return;
    
    try {
      await updateConsultant(consultant._id || consultant.id, { resetPassword: true });
      alert('Senha resetada com sucesso! O usuário precisará trocar a senha no próximo login.');
      fetchAllUsers(); // Recarregar lista sem filtro de equipes
    } catch (err) {
      console.error('Error resetting password:', err);
    }
  };


  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <Users className="w-7 h-7 text-ngr-secondary" />
            Usuários
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Gerencie os usuários e consultores do sistema
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Novo Usuário
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
          <span className="text-red-600">{error}</span>
          <button onClick={clearError} className="text-red-400 hover:text-red-600">
            ✕
          </button>
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
        <strong>Nota:</strong> Novos usuários são criados com a senha padrão <code className="bg-blue-100 px-1 rounded">Ngr@123</code> e 
        serão obrigados a trocar a senha no primeiro login.
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por nome, email ou função..."
          className="input-field pl-11"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Nome</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Email</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Funções</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Equipes</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Agenda</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Perfil</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Status</th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredConsultants.map((consultant) => (
                <tr 
                  key={consultant._id || consultant.id}
                  className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                    !consultant.active ? 'bg-slate-50 opacity-75' : ''
                  }`}
                >
                  <td className="px-6 py-4">
                    <span className="font-medium text-slate-800">{consultant.name}</span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">{consultant.email}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {(consultant.functions || []).map(func => (
                        <span 
                          key={func}
                          className="px-2 py-0.5 bg-ngr-light text-ngr-secondary rounded text-xs font-medium"
                        >
                          {getFunctionLabel(func)}
                        </span>
                      ))}
                      {(!consultant.functions || consultant.functions.length === 0) && (
                        <span className="text-slate-400 text-sm">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {(consultant.teams || []).map((team, idx) => {
                        const teamName = typeof team === 'string' ? team : team.name;
                        const teamId = typeof team === 'string' ? team : (team._id || team.id);
                        return (
                          <span 
                            key={teamId || idx}
                            className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium"
                          >
                            {teamName}
                          </span>
                        );
                      })}
                      {(!consultant.teams || consultant.teams.length === 0) && (
                        <span className="text-slate-400 text-sm">-</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleAgenda(consultant)}
                      className={`
                        flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors cursor-pointer
                        ${consultant.hasAgenda 
                          ? 'bg-blue-100 text-blue-700 hover:bg-blue-200' 
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }
                      `}
                    >
                      <Calendar className="w-3 h-3" />
                      {consultant.hasAgenda ? 'Sim' : 'Não'}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      // Priorizar role (novo sistema) sobre profile (antigo)
                      const roleName = consultant.role 
                        ? (typeof consultant.role === 'object' ? consultant.role.name : '')
                        : null;
                      const profileLabel = roleName || PROFILE_LABELS[consultant.profile] || consultant.profile;
                      const isAdmin = consultant.profile === 'admin' || 
                        (typeof consultant.role === 'object' && consultant.role?.key === 'admin') ||
                        (typeof consultant.role === 'string' && consultant.role === 'admin');
                      
                      return (
                        <span className={`
                          px-2 py-1 rounded text-xs font-medium
                          ${isAdmin
                            ? 'bg-purple-100 text-purple-700' 
                            : 'bg-slate-100 text-slate-600'
                          }
                        `}>
                          {profileLabel}
                        </span>
                      );
                    })()}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleActive(consultant)}
                      className={`
                        flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors
                        ${consultant.active 
                          ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                          : 'bg-red-100 text-red-600 hover:bg-red-200'
                        }
                      `}
                    >
                      {consultant.active ? (
                        <>
                          <UserCheck className="w-3 h-3" />
                          Ativo
                        </>
                      ) : (
                        <>
                          <UserX className="w-3 h-3" />
                          Inativo
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleResetPassword(consultant)}
                        className="p-2 text-slate-400 hover:text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Resetar Senha"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEditModal(consultant)}
                        className="p-2 text-slate-400 hover:text-ngr-secondary hover:bg-ngr-light rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(consultant)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Desativar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredConsultants.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              {searchTerm ? 'Nenhum usuário encontrado' : 'Nenhum usuário cadastrado'}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            {/* Header fixo */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-200 flex-shrink-0">
              <h2 className="text-xl font-bold text-slate-800">
                {editingConsultant ? 'Editar Usuário' : 'Novo Usuário'}
              </h2>
              <button 
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Conteúdo com scroll */}
            <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 pt-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nome *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Email *
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  className="input-field"
                  placeholder="usuario@ngrglobal.com.br"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Senha {editingConsultant ? '(deixe em branco para manter)' : '(deixe em branco para usar padrão)'}
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                  className="input-field"
                  minLength={6}
                  placeholder={editingConsultant ? '••••••••' : 'Padrão: Ngr@123'}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Perfil (Nível de Acesso) *
                </label>
                <select
                  value={formData.role}
                  onChange={(e) => {
                    console.log('[Consultants] Role changed:', e.target.value);
                    setFormData(prev => ({ ...prev, role: e.target.value }));
                  }}
                  className="select-field"
                  required
                >
                  <option value="">Selecione um perfil...</option>
                  {(() => {
                    console.log('[Consultants] Rendering select, availableRoles:', availableRoles);
                    if (availableRoles.length === 0) {
                      return <option value="" disabled>Carregando perfis...</option>;
                    }
                    return availableRoles.map((role) => (
                      <option key={role._id || role.id} value={role._id || role.id}>
                        {role.name} {role.isSystem && '(Sistema)'}
                      </option>
                    ));
                  })()}
                </select>
                {formData.role && (
                  <p className="text-xs text-slate-500 mt-1">
                    {availableRoles.find(r => (r._id || r.id) === formData.role)?.description || ''}
                  </p>
                )}
              </div>

              <MultiSelectDropdown
                label="Funções"
                options={availableFunctions.map(func => ({ value: func.key as UserFunction, label: func.label }))}
                selected={formData.functions}
                onChange={(selected) => setFormData(prev => ({ ...prev, functions: selected as UserFunction[] }))}
                placeholder="Selecione as funções..."
              />

              <MultiSelectDropdown
                label="Equipes"
                icon={<Users2 className="w-4 h-4 inline mr-1" />}
                options={availableTeams.map(team => ({ value: team._id || team.id, label: team.name }))}
                selected={formData.teams}
                onChange={(selected) => setFormData(prev => ({ ...prev, teams: selected }))}
                placeholder={availableTeams.length === 0 ? "Nenhuma equipe cadastrada" : "Selecione as equipes..."}
              />

              <div>
                <label 
                  className={`
                    flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                    ${formData.hasAgenda 
                      ? 'bg-blue-50 border-blue-400' 
                      : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                    }
                  `}
                >
                  <input
                    type="checkbox"
                    checked={formData.hasAgenda}
                    onChange={(e) => setFormData(prev => ({ ...prev, hasAgenda: e.target.checked }))}
                    className="sr-only"
                  />
                  <div className={`
                    w-5 h-5 rounded border flex items-center justify-center
                    ${formData.hasAgenda 
                      ? 'bg-blue-500 border-blue-500' 
                      : 'border-slate-300'
                    }
                  `}>
                    {formData.hasAgenda && (
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <span className={`font-medium ${formData.hasAgenda ? 'text-blue-700' : 'text-slate-700'}`}>
                      <Calendar className="w-4 h-4 inline mr-1" />
                      Possui Agenda
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Marque se este usuário deve aparecer na grade de agenda
                    </p>
                  </div>
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="btn-primary flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
