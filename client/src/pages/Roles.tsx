import { useEffect, useState } from 'react';
import {
  Shield,
  Plus,
  Edit2,
  Trash2,
  X,
  Save,
  Check,
  Users2,
  Lock,
  Eye,
  EyeOff
} from 'lucide-react';
import { rolesAPI, permissionsAPI, teamsAPI } from '../services/api';
import { Role, Permission, Team } from '../types';

export default function Roles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    key: '',
    description: '',
    permissions: [] as string[],
    allowedTeams: undefined as string[] | undefined,
    active: true,
  });
  const [permissionsGrouped, setPermissionsGrouped] = useState<Record<string, Permission[]>>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [rolesRes, permissionsRes, teamsRes] = await Promise.all([
        rolesAPI.getAll(),
        permissionsAPI.getAll({ active: true }),
        teamsAPI.getActive(),
      ]);

      setRoles(rolesRes.data.roles || []);
      const perms = permissionsRes.data.permissions || [];
      setPermissions(perms);

      // Agrupar permissões por categoria
      const grouped: Record<string, Permission[]> = {};
      perms.forEach((perm: Permission) => {
        if (!grouped[perm.category]) {
          grouped[perm.category] = [];
        }
        grouped[perm.category].push(perm);
      });
      setPermissionsGrouped(grouped);

      setTeams(teamsRes.data.teams || []);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(err.response?.data?.message || 'Erro ao carregar dados');
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingRole(null);
    setFormData({
      name: '',
      key: '',
      description: '',
      permissions: [],
      allowedTeams: undefined,
      active: true,
    });
    setModalOpen(true);
  };

  const openEditModal = (role: Role) => {
    setEditingRole(role);
    const rolePermissions = Array.isArray(role.permissions)
      ? role.permissions.map((p: Permission | string) => 
          typeof p === 'object' ? (p._id || p.id) : p
        )
      : [];
    
    const roleTeams = role.allowedTeams
      ? Array.isArray(role.allowedTeams)
        ? role.allowedTeams.map((t: Team | string) => 
            typeof t === 'object' ? (t._id || t.id) : t
          )
        : []
      : undefined;

    setFormData({
      name: role.name,
      key: role.key,
      description: role.description || '',
      permissions: rolePermissions,
      allowedTeams: roleTeams,
      active: role.active,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      // Preparar dados para envio
      const data: any = {
        name: formData.name,
        description: formData.description,
        active: formData.active,
      };

      // Se não for perfil do sistema, incluir permissões
      if (!editingRole || !editingRole.isSystem) {
        data.permissions = formData.permissions;
      }

      // Tratar allowedTeams
      if (formData.allowedTeams && formData.allowedTeams.length > 0) {
        data.allowedTeams = formData.allowedTeams;
      } else {
        // Se não há equipes selecionadas, enviar null para permitir todas
        data.allowedTeams = null;
      }

      if (editingRole) {
        await rolesAPI.update(editingRole._id || editingRole.id, data);
      } else {
        data.key = formData.key;
        await rolesAPI.create(data);
      }
      setModalOpen(false);
      fetchData();
    } catch (err: any) {
      console.error('Error saving role:', err);
      setError(err.response?.data?.message || 'Erro ao salvar perfil');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (role: Role) => {
    if (role.isSystem) {
      alert('Não é possível excluir um perfil do sistema');
      return;
    }

    if (!confirm(`Tem certeza que deseja excluir o perfil "${role.name}"?`)) return;

    try {
      await rolesAPI.delete(role._id || role.id);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao excluir perfil');
    }
  };

  const togglePermission = (permissionId: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permissionId)
        ? prev.permissions.filter(id => id !== permissionId)
        : [...prev.permissions, permissionId],
    }));
  };

  const toggleTeam = (teamId: string) => {
    setFormData(prev => {
      const currentTeams = prev.allowedTeams || [];
      const newTeams = currentTeams.includes(teamId)
        ? currentTeams.filter(id => id !== teamId)
        : [...currentTeams, teamId];
      
      return {
        ...prev,
        allowedTeams: newTeams.length === 0 ? undefined : newTeams,
      };
    });
  };

  const selectAllPermissions = () => {
    setFormData(prev => ({
      ...prev,
      permissions: permissions.map(p => p._id || p.id),
    }));
  };

  const clearPermissions = () => {
    setFormData(prev => ({
      ...prev,
      permissions: [],
    }));
  };

  const selectAllTeams = () => {
    // Quando seleciona todas, selecionar todas as equipes disponíveis
    setFormData(prev => ({
      ...prev,
      allowedTeams: teams.map(t => t._id || t.id),
    }));
  };

  const clearTeams = () => {
    // Quando limpa, restringir todas (nenhuma equipe visível)
    setFormData(prev => ({
      ...prev,
      allowedTeams: undefined, // undefined = nenhuma equipe (todas restritas)
    }));
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-ngr-secondary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-ngr-primary rounded-xl flex items-center justify-center">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Perfis e Permissões</h1>
            <p className="text-sm text-slate-500">Gerenciar perfis de acesso e permissões</p>
          </div>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-ngr-primary text-white rounded-lg hover:bg-ngr-secondary transition-colors"
        >
          <Plus className="w-4 h-4" />
          Novo Perfil
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border-2 border-red-300 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="p-4 border-b border-slate-200">
          <h2 className="font-semibold text-slate-700">Perfis Cadastrados</h2>
        </div>
        <div className="divide-y divide-slate-200">
          {roles.length === 0 ? (
            <div className="p-6 text-slate-500 text-center">Nenhum perfil cadastrado</div>
          ) : (
            roles.map((role) => (
              <div key={role._id || role.id} className="p-4 hover:bg-slate-50">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-slate-800">{role.name}</h3>
                      {role.isSystem && (
                        <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          Sistema
                        </span>
                      )}
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        role.active ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {role.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </div>
                    {role.description && (
                      <p className="text-sm text-slate-600 mb-2">{role.description}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mb-2">
                      <span className="text-xs text-slate-500">
                        Permissões: {Array.isArray(role.permissions) ? role.permissions.length : 0}
                      </span>
                      {role.allowedTeams !== undefined && (
                        <span className="text-xs text-slate-500">
                          Equipes: {Array.isArray(role.allowedTeams) 
                            ? role.allowedTeams.length === 0 
                              ? 'Nenhuma' 
                              : role.allowedTeams.length 
                            : 'Todas'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => openEditModal(role)}
                      className="p-2 text-slate-600 hover:text-ngr-primary hover:bg-slate-100 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {!role.isSystem && (
                      <button
                        onClick={() => handleDelete(role)}
                        className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal de Criar/Editar */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold text-slate-800">
                {editingRole ? 'Editar Perfil' : 'Novo Perfil'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Nome do Perfil *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    disabled={editingRole?.isSystem}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Chave (key) *
                  </label>
                  <input
                    type="text"
                    value={formData.key}
                    onChange={(e) => setFormData(prev => ({ ...prev, key: e.target.value.toLowerCase().replace(/\s+/g, '_') }))}
                    disabled={!!editingRole}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    required
                    placeholder="ex: gerente_regional"
                  />
                  {editingRole && (
                    <p className="text-xs text-slate-500 mt-1">Chave não pode ser alterada</p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Descrição
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm min-h-[80px]"
                  placeholder="Descreva o propósito deste perfil..."
                />
              </div>

              {/* Permissões */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-slate-700">
                    Permissões *
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllPermissions}
                      className="text-xs text-ngr-secondary hover:underline"
                    >
                      Selecionar todas
                    </button>
                    <button
                      type="button"
                      onClick={clearPermissions}
                      className="text-xs text-slate-500 hover:underline"
                    >
                      Limpar
                    </button>
                  </div>
                </div>
                <div className="border border-slate-200 rounded-lg p-4 max-h-64 overflow-y-auto space-y-4">
                  {Object.entries(permissionsGrouped).map(([category, perms]) => (
                    <div key={category}>
                      <h4 className="text-xs font-semibold text-slate-600 mb-2 uppercase">
                        {category}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {perms.map((perm) => {
                          const permId = perm._id || perm.id;
                          const isSelected = formData.permissions.includes(permId);
                          return (
                            <label
                              key={permId}
                              className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                                isSelected
                                  ? 'bg-ngr-light border-ngr-secondary'
                                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => togglePermission(permId)}
                                className="sr-only"
                              />
                              <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                                isSelected
                                  ? 'bg-ngr-secondary border-ngr-secondary'
                                  : 'border-slate-300'
                              }`}>
                                {isSelected && <Check className="w-3 h-3 text-white" />}
                              </div>
                              <div className="flex-1">
                                <div className="text-sm font-medium text-slate-700">
                                  {perm.name}
                                </div>
                                {perm.description && (
                                  <div className="text-xs text-slate-500">
                                    {perm.description}
                                  </div>
                                )}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Equipes Visíveis */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-sm font-medium text-slate-700">
                    Equipes Visíveis na Agenda
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={selectAllTeams}
                      className="text-xs text-ngr-secondary hover:underline"
                    >
                      Selecionar todas
                    </button>
                    <button
                      type="button"
                      onClick={clearTeams}
                      className="text-xs text-slate-500 hover:underline"
                    >
                      Limpar seleção (restringir todas)
                    </button>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mb-2">
                  Selecione as equipes que este perfil pode visualizar na agenda. Se nenhuma for selecionada, nenhuma equipe será visível.
                </p>
                <div className="border border-slate-200 rounded-lg p-3 max-h-48 overflow-y-auto">
                  {teams.length === 0 ? (
                    <p className="text-sm text-slate-400 text-center py-4">
                      Nenhuma equipe cadastrada
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {teams.map((team) => {
                        const teamId = team._id || team.id;
                        const isSelected = formData.allowedTeams?.includes(teamId);
                        return (
                          <label
                            key={teamId}
                            className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-purple-50 border-purple-300'
                                : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected || false}
                              onChange={() => toggleTeam(teamId)}
                              className="sr-only"
                            />
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                              isSelected
                                ? 'bg-purple-600 border-purple-600'
                                : 'border-slate-300'
                            }`}>
                              {isSelected && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <span className="text-sm text-slate-700">{team.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
                {(!formData.allowedTeams || formData.allowedTeams.length === 0) && (
                  <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                    <EyeOff className="w-3 h-3" />
                    Nenhuma equipe será visível (todas restritas)
                  </p>
                )}
                {formData.allowedTeams && formData.allowedTeams.length > 0 && (
                  <p className="text-xs text-blue-600 mt-2">
                    {formData.allowedTeams.length} equipe(s) selecionada(s) - apenas essas equipes serão visíveis
                  </p>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="active"
                  checked={formData.active}
                  onChange={(e) => setFormData(prev => ({ ...prev, active: e.target.checked }))}
                  className="rounded border-slate-300"
                />
                <label htmlFor="active" className="text-sm text-slate-700">
                  Perfil ativo
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || formData.permissions.length === 0}
                  className="px-4 py-2 bg-ngr-primary text-white rounded-lg hover:bg-ngr-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
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

