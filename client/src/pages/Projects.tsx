import { useEffect, useState } from 'react';
import { 
  FolderKanban, 
  Plus, 
  Search, 
  Edit2, 
  Trash2, 
  X,
  Save,
  CheckCircle,
  XCircle,
  User
} from 'lucide-react';
import { useAgendaStore } from '../store/agendaStore';
import { Project } from '../types';

interface ProjectFormData {
  projectId: string;
  client: string;
  projectType: string;
  projectName: string;
  projectManager: string;
}

export default function Projects() {
  const { projects, fetchProjects, createProject, updateProject, deleteProject, error, clearError } = useAgendaStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<ProjectFormData>({
    projectId: '',
    client: '',
    projectType: '',
    projectName: '',
    projectManager: ''
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  const filteredProjects = projects.filter(p => 
    p.projectId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.client.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.projectType.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.projectManager && p.projectManager.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const openCreateModal = () => {
    setEditingProject(null);
    setFormData({
      projectId: '',
      client: '',
      projectType: '',
      projectName: '',
      projectManager: ''
    });
    setModalOpen(true);
  };

  const openEditModal = (project: Project) => {
    setEditingProject(project);
    setFormData({
      projectId: project.projectId,
      client: project.client,
      projectType: project.projectType,
      projectName: project.projectName,
      projectManager: project.projectManager || ''
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (editingProject) {
        await updateProject(editingProject._id || editingProject.id, formData);
      } else {
        await createProject(formData);
      }
      setModalOpen(false);
    } catch (err) {
      console.error('Error saving project:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (project: Project) => {
    if (!confirm(`Tem certeza que deseja desativar o projeto "${project.projectName}"?`)) return;
    
    try {
      await deleteProject(project._id || project.id);
    } catch (err) {
      console.error('Error deleting project:', err);
    }
  };

  const handleToggleActive = async (project: Project) => {
    try {
      await updateProject(project._id || project.id, { active: !project.active });
    } catch (err) {
      console.error('Error toggling project status:', err);
    }
  };

  // Get unique clients and types for suggestions
  const uniqueClients = [...new Set(projects.map(p => p.client))].sort();
  const uniqueTypes = [...new Set(projects.map(p => p.projectType))].sort();

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-3">
            <FolderKanban className="w-7 h-7 text-ngr-secondary" />
            Projetos
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Gerencie os projetos da consultoria
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Novo Projeto
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Buscar por ID, cliente, nome ou tipo..."
          className="input-field pl-11"
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-sm">Total de Projetos</p>
          <p className="text-2xl font-bold text-ngr-primary mt-1">{projects.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-sm">Clientes</p>
          <p className="text-2xl font-bold text-ngr-primary mt-1">{uniqueClients.length}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
          <p className="text-slate-500 text-sm">Tipos de Projeto</p>
          <p className="text-2xl font-bold text-ngr-primary mt-1">{uniqueTypes.length}</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">ID</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Cliente</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Nome do Projeto</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Tipo</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Gerente</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-slate-600">Status</th>
                <th className="text-right px-6 py-4 text-sm font-semibold text-slate-600">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filteredProjects.map((project) => (
                <tr 
                  key={project._id || project.id}
                  className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${
                    !project.active ? 'bg-slate-50 opacity-75' : ''
                  }`}
                >
                  <td className="px-6 py-4">
                    <span className="font-mono font-medium text-ngr-secondary">{project.projectId}</span>
                  </td>
                  <td className="px-6 py-4 text-slate-800 font-medium">{project.client}</td>
                  <td className="px-6 py-4 text-slate-600">{project.projectName}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                      {project.projectType}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">
                    {project.projectManager ? (
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {project.projectManager}
                      </span>
                    ) : (
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleActive(project)}
                      className={`
                        flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors
                        ${project.active 
                          ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                          : 'bg-red-100 text-red-600 hover:bg-red-200'
                        }
                      `}
                    >
                      {project.active ? (
                        <>
                          <CheckCircle className="w-3 h-3" />
                          Ativo
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3" />
                          Inativo
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(project)}
                        className="p-2 text-slate-400 hover:text-ngr-secondary hover:bg-ngr-light rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(project)}
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

          {filteredProjects.length === 0 && (
            <div className="text-center py-12 text-slate-400">
              {searchTerm ? 'Nenhum projeto encontrado' : 'Nenhum projeto cadastrado'}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal-content max-w-lg" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-slate-800">
                {editingProject ? 'Editar Projeto' : 'Novo Projeto'}
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
                  ID do Projeto *
                </label>
                <input
                  type="text"
                  value={formData.projectId}
                  onChange={(e) => setFormData(prev => ({ ...prev, projectId: e.target.value.toUpperCase() }))}
                  className="input-field font-mono"
                  placeholder="Ex: ELUX, MDLZ, SUST..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Cliente *
                </label>
                <input
                  type="text"
                  value={formData.client}
                  onChange={(e) => setFormData(prev => ({ ...prev, client: e.target.value }))}
                  className="input-field"
                  placeholder="Nome do cliente"
                  list="clients-list"
                  required
                />
                <datalist id="clients-list">
                  {uniqueClients.map(client => (
                    <option key={client} value={client} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Tipo do Projeto *
                </label>
                <input
                  type="text"
                  value={formData.projectType}
                  onChange={(e) => setFormData(prev => ({ ...prev, projectType: e.target.value }))}
                  className="input-field"
                  placeholder="Ex: Implantação, Integração, Sustentação..."
                  list="types-list"
                  required
                />
                <datalist id="types-list">
                  {uniqueTypes.map(type => (
                    <option key={type} value={type} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Nome do Projeto *
                </label>
                <input
                  type="text"
                  value={formData.projectName}
                  onChange={(e) => setFormData(prev => ({ ...prev, projectName: e.target.value }))}
                  className="input-field"
                  placeholder="Nome descritivo do projeto"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  <User className="w-4 h-4 inline mr-1" />
                  Gerente do Projeto
                </label>
                <input
                  type="text"
                  value={formData.projectManager}
                  onChange={(e) => setFormData(prev => ({ ...prev, projectManager: e.target.value }))}
                  className="input-field"
                  placeholder="Nome do gerente responsável"
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
