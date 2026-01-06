import { useEffect, useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, RotateCcw, Filter, Users, Zap, Building2, Users2 } from 'lucide-react';
import { format, endOfWeek, addWeeks, startOfWeek } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAgendaStore } from '../store/agendaStore';
import { useAuthStore } from '../store/authStore';
import { usePermissions } from '../hooks/usePermissions';
import { teamsAPI } from '../services/api';
import { Team } from '../types';
import AgendaGrid from '../components/Grid/AgendaGrid';
import Legend from '../components/Grid/Legend';
import BulkUpdateModal from '../components/BulkUpdateModal';

export default function Dashboard() {
  const { 
    currentWeekStart, 
    weeksToShow,
    setCurrentWeek, 
    setWeeksToShow,
    nextWeek, 
    prevWeek,
    fetchConsultants,
    fetchProjects,
    fetchAllocations,
    fetchStatusConfigs,
    consultants,
    projects,
    selectedConsultants,
    setSelectedConsultants,
    error,
    clearError
  } = useAgendaStore();
  const { user } = useAuthStore();
  const { hasPermission } = usePermissions();
  const isAdmin = user?.profile === 'admin';
  const canBulkUpdate = hasPermission('allocations.bulk') || isAdmin;

  // Chave para armazenar filtros no localStorage
  const FILTERS_STORAGE_KEY = 'agendaFilters';

  // Função para carregar filtros do localStorage
  const loadFiltersFromStorage = () => {
    try {
      const saved = localStorage.getItem(FILTERS_STORAGE_KEY);
      if (saved) {
        const filters = JSON.parse(saved);
        // Limpar valores inválidos (null, undefined, strings vazias que não sejam arrays)
        return {
          selectedConsultants: Array.isArray(filters.selectedConsultants) ? filters.selectedConsultants : [],
          selectedProject: filters.selectedProject && filters.selectedProject !== 'null' ? filters.selectedProject : '',
          selectedManager: filters.selectedManager && filters.selectedManager !== 'null' ? filters.selectedManager : '',
          selectedTeams: Array.isArray(filters.selectedTeams) ? filters.selectedTeams : [],
          showFilters: filters.showFilters === true,
          currentWeekStart: filters.currentWeekStart ? new Date(filters.currentWeekStart) : null,
        };
      }
    } catch (err) {
      console.error('Error loading filters from storage:', err);
    }
    return {
      selectedConsultants: [],
      selectedProject: '',
      selectedManager: '',
      selectedTeams: [],
      showFilters: false,
      currentWeekStart: null,
    };
  };

  // Função para salvar filtros no localStorage
  const saveFiltersToStorage = (
    consultants: string[],
    project: string,
    manager: string,
    teams: string[],
    showFilters: boolean,
    weekStart: Date | null
  ) => {
    try {
      const filters = {
        selectedConsultants: consultants,
        selectedProject: project,
        selectedManager: manager,
        selectedTeams: teams,
        showFilters: showFilters,
        currentWeekStart: weekStart ? weekStart.toISOString() : null,
      };
      localStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
    } catch (err) {
      console.error('Error saving filters to storage:', err);
    }
  };

  // Carregar filtros salvos ao montar o componente
  const savedFilters = loadFiltersFromStorage();
  
  const [showFilters, setShowFilters] = useState(savedFilters.showFilters);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>(savedFilters.selectedProject);
  const [selectedManager, setSelectedManager] = useState<string>(savedFilters.selectedManager);
  const [availableTeams, setAvailableTeams] = useState<Team[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>(savedFilters.selectedTeams);

  // Obter lista única de gerentes dos projetos ativos
  const uniqueManagers = useMemo(() => {
    const managers = projects
      .filter(p => p.active && p.projectManager)
      .map(p => p.projectManager!)
      .filter((manager, index, self) => self.indexOf(manager) === index)
      .sort();
    return managers;
  }, [projects]);

  // Buscar equipes visíveis (baseado no perfil do usuário)
  useEffect(() => {
    const fetchTeams = async () => {
      try {
        // Usar endpoint de equipes visíveis que respeita as permissões do perfil
        const response = await teamsAPI.getVisible();
        setAvailableTeams(response.data.teams || []);
      } catch (err) {
        console.error('Error fetching visible teams:', err);
        // Fallback: buscar todas as equipes ativas se o endpoint falhar
        try {
          const fallbackResponse = await teamsAPI.getActive();
          setAvailableTeams(fallbackResponse.data.teams || []);
        } catch (fallbackErr) {
          console.error('Error fetching active teams (fallback):', fallbackErr);
        }
      }
    };
    fetchTeams();
  }, []);

  // Filtrar consultores por equipes selecionadas
  const filteredConsultantsByTeams = useMemo(() => {
    if (selectedTeams.length === 0) {
      return consultants.filter(c => c.active && c.hasAgenda);
    }
    
    return consultants.filter(c => {
      if (!c.active || !c.hasAgenda) return false;
      
      // Verificar se o consultor pertence a alguma das equipes selecionadas
      const consultantTeams = c.teams || [];
      return consultantTeams.some(team => {
        const teamId = typeof team === 'object' ? (team._id || team.id) : team;
        return selectedTeams.includes(teamId);
      });
    });
  }, [consultants, selectedTeams]);

  // Carregar filtros salvos e aplicar na primeira renderização
  useEffect(() => {
    const saved = loadFiltersFromStorage();
    if (saved.selectedConsultants.length > 0) {
      setSelectedConsultants(saved.selectedConsultants);
    }
    if (saved.currentWeekStart) {
      setCurrentWeek(saved.currentWeekStart);
    }
  }, []);

  // Salvar filtros sempre que mudarem
  useEffect(() => {
    saveFiltersToStorage(
      selectedConsultants,
      selectedProject,
      selectedManager,
      selectedTeams,
      showFilters,
      currentWeekStart
    );
  }, [selectedConsultants, selectedProject, selectedManager, selectedTeams, showFilters, currentWeekStart]);

  useEffect(() => {
    fetchConsultants(false); // Apenas ativos para a agenda
    fetchProjects();
    fetchStatusConfigs();
    const startDate = startOfWeek(currentWeekStart, { weekStartsOn: 1 });
    const endDate = endOfWeek(addWeeks(currentWeekStart, weeksToShow - 1), { weekStartsOn: 1 });
    fetchAllocations(startDate, endDate);
  }, [currentWeekStart, weeksToShow]);

  const goToToday = () => {
    setCurrentWeek(new Date());
  };

  const toggleConsultantFilter = (id: string) => {
    if (selectedConsultants.includes(id)) {
      setSelectedConsultants(selectedConsultants.filter(c => c !== id));
    } else {
      setSelectedConsultants([...selectedConsultants, id]);
    }
  };

  const toggleTeamFilter = (teamId: string) => {
    if (selectedTeams.includes(teamId)) {
      setSelectedTeams(selectedTeams.filter(t => t !== teamId));
    } else {
      setSelectedTeams([...selectedTeams, teamId]);
    }
    // Limpar seleção de consultores quando mudar filtro de equipes
    setSelectedConsultants([]);
  };

  const selectAllTeams = () => {
    setSelectedTeams(availableTeams.map(t => t._id || t.id));
  };

  const clearTeamFilter = () => {
    setSelectedTeams([]);
    setSelectedConsultants([]);
  };

  const selectAllConsultants = () => {
    const availableConsultants = filteredConsultantsByTeams;
    setSelectedConsultants(availableConsultants.map(c => c._id || c.id));
  };

  const clearConsultantFilter = () => {
    setSelectedConsultants([]);
  };

  // Verificar se há algum filtro ativo
  // Considerar apenas filtros que realmente têm valores válidos
  const hasActiveFilters = 
    (selectedConsultants.length > 0) || 
    (selectedProject !== '' && selectedProject !== null) || 
    (selectedManager !== '' && selectedManager !== null) || 
    (selectedTeams.length > 0);

  // Contar filtros ativos (apenas valores válidos)
  const activeFiltersCount = 
    (selectedConsultants.length > 0 ? 1 : 0) +
    (selectedProject !== '' && selectedProject !== null ? 1 : 0) +
    (selectedManager !== '' && selectedManager !== null ? 1 : 0) +
    (selectedTeams.length > 0 ? 1 : 0);

  const endDate = endOfWeek(addWeeks(currentWeekStart, weeksToShow - 1), { weekStartsOn: 1 });

  return (
    <div className="h-screen flex flex-col overflow-hidden p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Agenda de Consultores</h1>
          <p className="text-slate-500 text-sm mt-1">
            Visualize e gerencie as alocações dos consultores
          </p>
        </div>

        {/* Week navigation */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={prevWeek}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-600 hover:text-ngr-primary transition-colors"
            title="Semana anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-4 py-2">
            <Calendar className="w-4 h-4 text-ngr-secondary" />
            <span className="text-sm font-medium text-slate-700">
              {format(currentWeekStart, "dd MMM", { locale: ptBR })} - {format(endDate, "dd MMM yyyy", { locale: ptBR })}
            </span>
          </div>

          <button
            onClick={nextWeek}
            className="p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg text-slate-600 hover:text-ngr-primary transition-colors"
            title="Próxima semana"
          >
            <ChevronRight className="w-5 h-5" />
          </button>

          <button
            onClick={goToToday}
            className="flex items-center gap-2 px-3 py-2 btn-primary text-sm"
            title="Ir para hoje"
          >
            <RotateCcw className="w-4 h-4" />
            Hoje
          </button>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ${
              showFilters || hasActiveFilters
                ? 'bg-ngr-light border-ngr-secondary text-ngr-primary'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filtros
            {activeFiltersCount > 0 && (
              <span className="bg-ngr-secondary text-white text-xs px-1.5 py-0.5 rounded-full">
                {activeFiltersCount}
              </span>
            )}
          </button>

          {canBulkUpdate && (
            <button
              onClick={() => setShowBulkModal(true)}
              className="flex items-center gap-2 px-3 py-2 btn-primary text-sm"
              title="Atualização em Massa"
            >
              <Zap className="w-4 h-4" />
              Atualização em Massa
            </button>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filtros
            </h3>
            <div className="flex items-center gap-2">
              {/* Weeks to show */}
              <label className="text-sm text-slate-600">Exibir:</label>
              <select
                value={weeksToShow}
                onChange={(e) => setWeeksToShow(parseInt(e.target.value))}
                className="select-field w-auto py-1.5 text-sm"
              >
                <option value={1}>1 semana</option>
                <option value={2}>2 semanas</option>
                <option value={3}>3 semanas</option>
                <option value={4}>4 semanas</option>
              </select>
            </div>
          </div>

          {/* Manager filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Gerente
            </label>
            <select
              value={selectedManager}
              onChange={(e) => {
                setSelectedManager(e.target.value);
                setSelectedProject(''); // Limpar filtro de projeto ao mudar gerente
              }}
              className="select-field w-full"
            >
              <option value="">Todos os gerentes</option>
              {uniqueManagers.map((manager) => (
                <option key={manager} value={manager}>
                  {manager}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Filtra consultores que têm alocações para projetos do gerente selecionado
            </p>
          </div>

          {/* Project filter */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Projeto
            </label>
            <select
              value={selectedProject}
              onChange={(e) => {
                setSelectedProject(e.target.value);
                setSelectedManager(''); // Limpar filtro de gerente ao mudar projeto
              }}
              className="select-field w-full"
            >
              <option value="">Todos os projetos</option>
              {projects.filter(p => p.active).map((project) => (
                <option key={project._id || project.id} value={project._id || project.id}>
                  {project.projectId} - {project.client} ({project.projectName})
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-1">
              Filtra consultores que têm alocações para o projeto selecionado
            </p>
          </div>

          {/* Team filter */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Users2 className="w-4 h-4" />
                Equipes
              </label>
              <div className="flex gap-2">
                <button 
                  onClick={selectAllTeams}
                  className="text-xs text-ngr-secondary hover:underline"
                >
                  Selecionar todas
                </button>
                <span className="text-slate-300">|</span>
                <button 
                  onClick={clearTeamFilter}
                  className="text-xs text-slate-500 hover:underline"
                >
                  Limpar
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {availableTeams.map((team) => (
                <button
                  key={team._id || team.id}
                  onClick={() => toggleTeamFilter(team._id || team.id)}
                  className={`
                    px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                    ${selectedTeams.includes(team._id || team.id)
                      ? 'bg-purple-100 text-purple-700 border border-purple-300'
                      : 'bg-slate-100 text-slate-400 border border-slate-200'
                    }
                  `}
                >
                  {team.name}
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Filtra consultores que pertencem às equipes selecionadas
            </p>
          </div>

          {/* Consultant filter */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Users className="w-4 h-4" />
                Consultores
              </label>
              <div className="flex gap-2">
                <button 
                  onClick={selectAllConsultants}
                  className="text-xs text-ngr-secondary hover:underline"
                >
                  Selecionar todos
                </button>
                <span className="text-slate-300">|</span>
                <button 
                  onClick={clearConsultantFilter}
                  className="text-xs text-slate-500 hover:underline"
                >
                  Limpar
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
              {filteredConsultantsByTeams.map((consultant) => (
                <button
                  key={consultant._id || consultant.id}
                  onClick={() => toggleConsultantFilter(consultant._id || consultant.id)}
                  className={`
                    px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                    ${selectedConsultants.length === 0 || selectedConsultants.includes(consultant._id || consultant.id)
                      ? 'bg-ngr-light text-ngr-primary border border-ngr-secondary/30'
                      : 'bg-slate-100 text-slate-400 border border-slate-200'
                    }
                  `}
                >
                  {consultant.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
          <span className="text-red-600">{error}</span>
          <button onClick={clearError} className="text-red-400 hover:text-red-600">
            ✕
          </button>
        </div>
      )}

      {/* Legend */}
      <Legend />

      {/* Grid Container - Flex-1 para ocupar espaço restante */}
      <div className="flex-1 flex flex-col min-h-0 space-y-4">
        {/* Grid */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm overflow-auto">
          <AgendaGrid selectedProject={selectedProject} selectedManager={selectedManager} selectedTeams={selectedTeams} />
        </div>

        {/* Instructions */}
        <div className="text-center text-sm text-slate-400 space-y-1 flex-shrink-0">
          <p>📝 Clique em uma célula para criar ou editar uma alocação</p>
          {isAdmin && (
            <p>⚡ Use "Atualização em Massa" para criar múltiplas alocações de uma vez</p>
          )}
        </div>
      </div>

      {/* Bulk Update Modal */}
      <BulkUpdateModal
        isOpen={showBulkModal}
        onClose={() => setShowBulkModal(false)}
        currentWeekStart={currentWeekStart}
        weeksToShow={weeksToShow}
      />
    </div>
  );
}
