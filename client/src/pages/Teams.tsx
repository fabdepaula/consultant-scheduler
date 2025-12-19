import { useEffect, useState } from 'react';
import { 
  Users2, 
  Plus, 
  Edit2, 
  Trash2, 
  X,
  Save,
  Check
} from 'lucide-react';
import { teamsAPI } from '../services/api';
import { Team } from '../types';

export default function Teams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
  });

  useEffect(() => {
    fetchTeams();
  }, []);

  const fetchTeams = async () => {
    try {
      setIsLoading(true);
      const response = await teamsAPI.getAll();
      setTeams(response.data.teams || []);
    } catch (err) {
      console.error('Error fetching teams:', err);
      setError('Erro ao carregar equipes');
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingTeam(null);
    setFormData({ name: '' });
    setModalOpen(true);
  };

  const openEditModal = (team: Team) => {
    setEditingTeam(team);
    setFormData({
      name: team.name,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      if (editingTeam) {
        await teamsAPI.update(editingTeam._id || editingTeam.id, formData);
      } else {
        await teamsAPI.create(formData);
      }
      setModalOpen(false);
      fetchTeams();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao salvar equipe');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (team: Team) => {
    if (!confirm(`Tem certeza que deseja excluir a equipe "${team.name}"?`)) return;
    
    try {
      await teamsAPI.delete(team._id || team.id);
      fetchTeams();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao excluir equipe');
    }
  };

  const handleToggleActive = async (team: Team) => {
    try {
      await teamsAPI.update(team._id || team.id, { active: !team.active });
      fetchTeams();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao atualizar equipe');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-ngr-secondary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <Users2 className="w-7 h-7 text-ngr-secondary" />
            Equipes
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Gerencie as equipes para agrupar consultores
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nova Equipe
        </button>
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
          <span className="text-red-600">{error}</span>
          <button onClick={() => setError('')} className="text-red-400 hover:text-red-600">
            ✕
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Nome da Equipe</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Status</th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600">Ações</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((team) => (
                <tr 
                  key={team._id || team.id}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-6 py-4 font-medium text-slate-800">{team.name}</td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleActive(team)}
                      className={`
                        flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors
                        ${team.active 
                          ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }
                      `}
                    >
                      {team.active ? (
                        <>
                          <Check className="w-3 h-3" />
                          Ativo
                        </>
                      ) : (
                        'Inativo'
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(team)}
                        className="p-2 text-slate-400 hover:text-ngr-secondary hover:bg-ngr-light rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(team)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {teams.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              Nenhuma equipe cadastrada
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-800">
                {editingTeam ? 'Editar Equipe' : 'Nova Equipe'}
              </h2>
              <button 
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nome da Equipe *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="input-field"
                  placeholder="ex: Equipe Import, Equipe Export"
                  required
                />
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

