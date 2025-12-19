import { useEffect, useState } from 'react';
import { 
  Palette, 
  Plus, 
  Edit2, 
  Trash2, 
  X,
  Save,
  Check,
  GripVertical
} from 'lucide-react';
import { statusConfigAPI } from '../services/api';
import { StatusConfig as IStatusConfig } from '../types';

export default function StatusConfig() {
  const [statuses, setStatuses] = useState<IStatusConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStatus, setEditingStatus] = useState<IStatusConfig | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    key: '',
    label: '',
    color: '#CCCCCC',
    textColor: '#000000',
    order: 0,
    requiresProject: true,
  });

  useEffect(() => {
    fetchStatuses();
  }, []);

  const fetchStatuses = async () => {
    try {
      setIsLoading(true);
      const response = await statusConfigAPI.getAll();
      setStatuses(response.data.statuses || []);
    } catch (err) {
      console.error('Error fetching statuses:', err);
      setError('Erro ao carregar status');
    } finally {
      setIsLoading(false);
    }
  };

  const openCreateModal = () => {
    setEditingStatus(null);
    setFormData({
      key: '',
      label: '',
      color: '#CCCCCC',
      textColor: '#000000',
      order: statuses.length + 1,
      requiresProject: true,
    });
    setModalOpen(true);
  };

  const openEditModal = (status: IStatusConfig) => {
    setEditingStatus(status);
    setFormData({
      key: status.key,
      label: status.label,
      color: status.color,
      textColor: status.textColor,
      order: status.order,
      requiresProject: status.requiresProject ?? true,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    try {
      if (editingStatus) {
        await statusConfigAPI.update(editingStatus._id || editingStatus.id, formData);
      } else {
        await statusConfigAPI.create(formData);
      }
      setModalOpen(false);
      fetchStatuses();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao salvar status');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (status: IStatusConfig) => {
    if (!confirm(`Tem certeza que deseja excluir o status "${status.label}"?`)) return;
    
    try {
      await statusConfigAPI.delete(status._id || status.id);
      fetchStatuses();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao excluir status');
    }
  };

  const handleToggleActive = async (status: IStatusConfig) => {
    try {
      await statusConfigAPI.update(status._id || status.id, { active: !status.active });
      fetchStatuses();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao atualizar status');
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
            <Palette className="w-7 h-7 text-ngr-secondary" />
            Status de Alocação
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Gerencie os status disponíveis para as alocações
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Novo Status
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

      {/* Legend Preview */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
        <h3 className="text-sm font-medium text-slate-600 mb-3">Prévia da Legenda</h3>
        <div className="flex flex-wrap gap-3">
          {statuses.filter(s => s.active).sort((a, b) => a.order - b.order).map((status) => (
            <div 
              key={status._id || status.id}
              className="flex items-center gap-2 text-sm"
            >
              <div 
                className="w-6 h-6 rounded border border-slate-300"
                style={{ 
                  backgroundColor: status.color,
                }}
              />
              <span className="text-slate-700">{status.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="w-10"></th>
                <th className="text-left px-4 py-4 text-sm font-semibold text-slate-600">Chave</th>
                <th className="text-left px-4 py-4 text-sm font-semibold text-slate-600">Nome</th>
                <th className="text-left px-4 py-4 text-sm font-semibold text-slate-600">Cor</th>
                <th className="text-left px-4 py-4 text-sm font-semibold text-slate-600">Prévia</th>
                <th className="text-center px-4 py-4 text-sm font-semibold text-slate-600">Projeto</th>
                <th className="text-left px-4 py-4 text-sm font-semibold text-slate-600">Status</th>
                <th className="text-right px-4 py-4 text-sm font-semibold text-slate-600">Ações</th>
              </tr>
            </thead>
            <tbody>
              {statuses.sort((a, b) => a.order - b.order).map((status) => (
                <tr 
                  key={status._id || status.id}
                  className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-2">
                    <GripVertical className="w-4 h-4 text-slate-300" />
                  </td>
                  <td className="px-6 py-4">
                    <code className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-sm">
                      {status.key}
                    </code>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-800">{status.label}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-6 h-6 rounded border border-slate-300"
                        style={{ backgroundColor: status.color }}
                      />
                      <span className="text-sm text-slate-500">{status.color}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div 
                      className="px-3 py-1 rounded text-sm font-medium inline-block"
                      style={{ 
                        backgroundColor: status.color,
                        color: status.textColor 
                      }}
                    >
                      {status.label}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    {status.requiresProject !== false ? (
                      <span className="text-green-600 text-xs font-medium">Sim</span>
                    ) : (
                      <span className="text-slate-400 text-xs">Não</span>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <button
                      onClick={() => handleToggleActive(status)}
                      className={`
                        flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors
                        ${status.active 
                          ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                        }
                      `}
                    >
                      {status.active ? (
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
                        onClick={() => openEditModal(status)}
                        className="p-2 text-slate-400 hover:text-ngr-secondary hover:bg-ngr-light rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(status)}
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

          {statuses.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              Nenhum status cadastrado
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
                {editingStatus ? 'Editar Status' : 'Novo Status'}
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
                  Chave (identificador) *
                </label>
                <input
                  type="text"
                  value={formData.key}
                  onChange={(e) => setFormData(prev => ({ ...prev, key: e.target.value.toLowerCase().replace(/\s/g, '_') }))}
                  className="input-field"
                  placeholder="ex: confirmado_presencial"
                  required
                  disabled={!!editingStatus}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nome *
                </label>
                <input
                  type="text"
                  value={formData.label}
                  onChange={(e) => setFormData(prev => ({ ...prev, label: e.target.value }))}
                  className="input-field"
                  placeholder="ex: Confirmado Presencial"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Cor de Fundo *
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                      className="w-10 h-10 rounded cursor-pointer border border-slate-300"
                    />
                    <input
                      type="text"
                      value={formData.color}
                      onChange={(e) => setFormData(prev => ({ ...prev, color: e.target.value }))}
                      className="input-field flex-1"
                      placeholder="#FFFFFF"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Cor do Texto
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.textColor}
                      onChange={(e) => setFormData(prev => ({ ...prev, textColor: e.target.value }))}
                      className="w-10 h-10 rounded cursor-pointer border border-slate-300"
                    />
                    <input
                      type="text"
                      value={formData.textColor}
                      onChange={(e) => setFormData(prev => ({ ...prev, textColor: e.target.value }))}
                      className="input-field flex-1"
                      placeholder="#000000"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Prévia
                </label>
                <div 
                  className="px-4 py-2 rounded text-center font-medium"
                  style={{ 
                    backgroundColor: formData.color,
                    color: formData.textColor 
                  }}
                >
                  {formData.label || 'Nome do Status'}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Ordem
                </label>
                <input
                  type="number"
                  value={formData.order}
                  onChange={(e) => setFormData(prev => ({ ...prev, order: parseInt(e.target.value) || 0 }))}
                  className="input-field"
                  min={0}
                />
              </div>

              <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-lg">
                <input
                  type="checkbox"
                  id="requiresProject"
                  checked={formData.requiresProject}
                  onChange={(e) => setFormData(prev => ({ ...prev, requiresProject: e.target.checked }))}
                  className="w-5 h-5 text-ngr-secondary rounded border-slate-300 focus:ring-ngr-secondary"
                />
                <label htmlFor="requiresProject" className="text-sm text-slate-700">
                  <span className="font-medium">Requer projeto</span>
                  <p className="text-slate-500 text-xs mt-0.5">
                    Se marcado, será obrigatório selecionar um projeto ao criar alocação com este status
                  </p>
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

