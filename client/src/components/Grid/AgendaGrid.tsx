import { useState, useMemo, useEffect } from 'react';
import { format, addDays, isSameDay, isWeekend } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAgendaStore } from '../../store/agendaStore';
import { useAuthStore } from '../../store/authStore';
import { usePermissions } from '../../hooks/usePermissions';
import { functionConfigAPI } from '../../services/api';
import { 
  User, 
  Allocation, 
  TIME_SLOTS_BY_PERIOD,
  Period,
  TimeSlot,
  Project,
  PERIOD_LABELS,
  StatusConfig,
  FunctionConfig
} from '../../types';
import AllocationModal from './AllocationModal';
import CellTooltip from './CellTooltip';

// Cores padrão para fallback
const DEFAULT_COLORS: Record<string, { bg: string; text: string }> = {
  confirmado_presencial: { bg: '#FFFF00', text: '#000000' },
  confirmado_remoto: { bg: '#4472C4', text: '#FFFFFF' },
  a_confirmar: { bg: '#70AD47', text: '#FFFFFF' },
  livre: { bg: '#C6EFCE', text: '#000000' },
  bloqueado: { bg: '#808080', text: '#FFFFFF' },
  conflito: { bg: '#FF0000', text: '#FFFFFF' },
  ponte: { bg: '#BFBFBF', text: '#000000' },
  feriado: { bg: '#A6A6A6', text: '#FFFFFF' },
  fim_semana: { bg: '#D9D9D9', text: '#666666' },
};

const PERIODS: Period[] = ['manha', 'tarde', 'noite'];

interface AgendaGridProps {
  selectedProject?: string;
  selectedManager?: string;
  selectedTeams?: string[];
}

export default function AgendaGrid({ selectedProject, selectedManager, selectedTeams = [] }: AgendaGridProps = {}) {
  const { 
    consultants, 
    groupedAllocations, 
    allocations,
    projects,
    currentWeekStart,
    weeksToShow,
    selectedConsultants,
    statusConfigs,
    isLoading 
  } = useAgendaStore();
  const { user } = useAuthStore();
  const { hasPermission } = usePermissions();
  // Compatibilidade: manter isAdmin para verificação rápida
  const isAdmin = user?.profile === 'admin' || hasPermission('allocations.create');
  const [functions, setFunctions] = useState<FunctionConfig[]>([]);

  useEffect(() => {
    const fetchFunctions = async () => {
      try {
        const response = await functionConfigAPI.getAll();
        const activeFunctions = (response.data.functions || []).filter((f: FunctionConfig) => f.active);
        setFunctions(activeFunctions);
      } catch (err) {
        console.error('Error fetching functions:', err);
      }
    };
    fetchFunctions();
  }, []);

  // Helper para buscar o label de uma função pelo key
  const getFunctionLabel = (key: string): string => {
    const func = functions.find(f => f.key === key);
    return func ? func.label : key;
  };

  // Cria um mapa de cores a partir dos status cadastrados
  const statusColorsMap = useMemo(() => {
    const map: Record<string, { bg: string; text: string }> = { ...DEFAULT_COLORS };
    if (Array.isArray(statusConfigs)) {
      statusConfigs.forEach((config: StatusConfig) => {
        if (config.active) {
          map[config.key] = {
            bg: config.color,
            text: config.textColor
          };
        }
      });
    }
    return map;
  }, [statusConfigs]);

  // Cria um mapa de labels a partir dos status cadastrados
  const statusLabelsMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (Array.isArray(statusConfigs)) {
      statusConfigs.forEach((config: StatusConfig) => {
        if (config.active) {
          map[config.key] = config.label;
        }
      });
    }
    return map;
  }, [statusConfigs]);

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{
    consultant: User;
    date: Date;
    timeSlot?: TimeSlot;
    period?: Period;
    allocation?: Allocation;
    existingAllocations?: Allocation[];
  } | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{
    allocation: Allocation;
    x: number;
    y: number;
  } | null>(null);

  // Generate days for all weeks
  const totalDays = 7 * weeksToShow;
  const weekDays = Array.from({ length: totalDays }, (_, i) => addDays(currentWeekStart, i));

  const handleCellClick = (
    consultant: User, 
    date: Date, 
    timeSlot: TimeSlot,
    period: Period,
    allocations: Allocation[]
  ) => {
    // Permitir que todos os usuários abram o modal (consultores podem visualizar)
    // A edição será bloqueada no modal para não-admins
    
    // Se há apenas 1 alocação, abre para edição/visualização
    // Se há múltiplas (conflito), passa undefined para mostrar seletor
    // Se não há nenhuma, abre para criar nova (apenas admins podem criar)
    const singleAllocation = allocations.length === 1 ? allocations[0] : undefined;
    
    setSelectedCell({ 
      consultant, 
      date, 
      timeSlot, 
      period, 
      allocation: singleAllocation,
      existingAllocations: allocations
    });
    setModalOpen(true);
  };

  const handleCellHover = (
    e: React.MouseEvent,
    allocation: Allocation | undefined
  ) => {
    if (!allocation) {
      setHoveredCell(null);
      return;
    }
    
    setHoveredCell({
      allocation,
      x: e.clientX,
      y: e.clientY
    });
  };

  const getAllocationsForSlot = (
    consultantId: string, 
    date: Date, 
    timeSlot: TimeSlot
  ): Allocation[] => {
    const dateKey = format(date, 'yyyy-MM-dd');
    const allocations = groupedAllocations[consultantId]?.[dateKey] || [];
    return allocations.filter(a => a.timeSlot === timeSlot);
  };

  const getCellContent = (allocations: Allocation[], period: Period, isWeekendDay: boolean): string => {
    if (allocations.length === 0) {
      if (period === 'noite' || isWeekendDay) {
        return '';
      }
      return 'Livre';
    }
    
    // Se há conflito (mais de uma alocação), mostrar os nomes dos clientes separados por "/"
    if (allocations.length > 1) {
      const clients = allocations.map(a => {
        const project = a.projectId as Project;
        if (project && typeof project === 'object') {
          return project.client || project.projectId || '?';
        }
        return a.notes || '?';
      });
      return clients.join('/');
    }
    
    const allocation = allocations[0];
    const specialStatuses = ['feriado', 'ponte', 'livre', 'bloqueado', 'fim_semana'];
    if (specialStatuses.includes(allocation.status)) {
      return statusLabelsMap[allocation.status] || allocation.status;
    }
    
    const project = allocation.projectId as Project;
    if (project && typeof project === 'object') {
      return project.client || project.projectId;
    }
    
    return allocation.notes || statusLabelsMap[allocation.status] || '';
  };

  // Helper para verificar se uma alocação pertence ao projeto selecionado
  const isAllocationForSelectedProject = (allocation: Allocation): boolean => {
    if (!selectedProject) return false;
    const project = allocation.projectId as Project;
    if (project && typeof project === 'object') {
      return (project._id || project.id) === selectedProject;
    }
    return false;
  };

  // Helper para verificar se uma alocação pertence a um projeto com o gerente selecionado
  const isAllocationForSelectedManager = (allocation: Allocation): boolean => {
    if (!selectedManager) return false;
    const project = allocation.projectId as Project;
    if (project && typeof project === 'object') {
      // Buscar o projeto completo na lista para pegar o projectManager
      const fullProject = projects.find(p => (p._id || p.id) === (project._id || project.id));
      return fullProject?.projectManager === selectedManager;
    }
    return false;
  };

  const getCellStyle = (
    allocations: Allocation[], 
    period: Period, 
    isWeekendDay: boolean
  ): { backgroundColor: string; color: string; boxShadow?: string; border?: string } => {
    if (allocations.length === 0) {
      if (period === 'noite' || isWeekendDay) {
        return { backgroundColor: '#707070', color: '#FFFFFF' };
      }
      return { backgroundColor: '#a9e5b5', color: '#000000' };
    }
    
    if (allocations.length > 1) {
      const conflictColor = statusColorsMap['conflito'] || DEFAULT_COLORS.conflito;
      const hasSelectedProject = allocations.some(isAllocationForSelectedProject);
      const hasSelectedManager = allocations.some(isAllocationForSelectedManager);
      const shouldHighlight = (hasSelectedProject && selectedProject) || (hasSelectedManager && selectedManager);
      return { 
        backgroundColor: conflictColor.bg, 
        color: conflictColor.text,
        ...(shouldHighlight ? {
          boxShadow: '0 0 0 3px rgba(255, 235, 59, 0.6)',
          border: '2px solid #ffc107'
        } : {})
      };
    }
    
    const allocation = allocations[0];
    const statusColor = statusColorsMap[allocation.status] || DEFAULT_COLORS[allocation.status];
    const hasSelectedProject = isAllocationForSelectedProject(allocation);
    const hasSelectedManager = isAllocationForSelectedManager(allocation);
    const shouldHighlight = (hasSelectedProject && selectedProject) || (hasSelectedManager && selectedManager);
    
    const baseStyle = statusColor 
      ? { backgroundColor: statusColor.bg, color: statusColor.text }
      : { backgroundColor: '#FFFFFF', color: '#000000' };
    
    if (shouldHighlight) {
      return {
        ...baseStyle,
        boxShadow: '0 0 0 3px rgba(255, 235, 59, 0.6)',
        border: '2px solid #ffc107'
      };
    }
    
    return baseStyle;
  };

  // Filtrar consultores que têm alocações com o projeto selecionado
  const consultantsWithSelectedProject = useMemo(() => {
    if (!selectedProject) return new Set<string>();
    
    const consultantIds = new Set<string>();
    allocations.forEach(allocation => {
      const project = allocation.projectId as Project;
      if (project && typeof project === 'object') {
        if ((project._id || project.id) === selectedProject) {
          const consultantId = allocation.consultantId as User;
          if (consultantId && typeof consultantId === 'object') {
            consultantIds.add((consultantId._id || consultantId.id) as string);
          } else {
            consultantIds.add(consultantId as string);
          }
        }
      }
    });
    
    return consultantIds;
  }, [allocations, selectedProject]);

  // Filtrar consultores que têm alocações com projetos do gerente selecionado
  const consultantsWithSelectedManager = useMemo(() => {
    if (!selectedManager) return new Set<string>();
    
    const consultantIds = new Set<string>();
    allocations.forEach(allocation => {
      const project = allocation.projectId as Project;
      if (project && typeof project === 'object') {
        // Buscar o projeto completo na lista para pegar o projectManager
        const fullProject = projects.find(p => (p._id || p.id) === (project._id || project.id));
        if (fullProject?.projectManager === selectedManager) {
          const consultantId = allocation.consultantId as User;
          if (consultantId && typeof consultantId === 'object') {
            consultantIds.add((consultantId._id || consultantId.id) as string);
          } else {
            consultantIds.add(consultantId as string);
          }
        }
      }
    });
    
    return consultantIds;
  }, [allocations, selectedManager, projects]);

  const displayedConsultants = consultants
    .filter(c => c.active)
    .filter(c => c.hasAgenda) // Somente usuários com agenda
    .filter(c => {
      const consultantId = c._id || c.id;
      
      // Se há equipes selecionadas, mostrar apenas consultores que pertencem a essas equipes
      if (selectedTeams.length > 0) {
        const consultantTeams = c.teams || [];
        const belongsToSelectedTeam = consultantTeams.some(team => {
          const teamId = typeof team === 'object' ? (team._id || team.id) : team;
          return selectedTeams.includes(teamId);
        });
        if (!belongsToSelectedTeam) {
          return false;
        }
      }
      
      // Se há projeto selecionado, mostrar apenas consultores com alocações desse projeto
      if (selectedProject) {
        if (!consultantsWithSelectedProject.has(consultantId)) {
          return false;
        }
      }
      
      // Se há gerente selecionado, mostrar apenas consultores com alocações de projetos desse gerente
      if (selectedManager) {
        if (!consultantsWithSelectedManager.has(consultantId)) {
          return false;
        }
      }
      
      // Aplicar filtro de consultores selecionados
      if (selectedConsultants.length > 0) {
        return selectedConsultants.includes(consultantId);
      }
      return true;
    });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-ngr-secondary"></div>
      </div>
    );
  }

  return (
    <div className="overflow-auto h-full">
      <table className="w-full min-w-[1200px] border-collapse text-xs">
        <thead className="sticky top-0 z-10">
          {/* Header principal */}
          <tr>
            <th colSpan={3} className="bg-[#003366] text-white text-left px-3 py-2 border border-slate-300 font-bold sticky left-0 z-20">
              NGR GLOBAL Agenda de Consultores
            </th>
            <th 
              colSpan={totalDays} 
              className="bg-[#003366] text-white text-center py-2 border border-slate-300 font-bold"
            >
              {format(currentWeekStart, "MMMM 'de' yyyy", { locale: ptBR })}
            </th>
          </tr>
          
          {/* Sub-header com colunas */}
          <tr className="bg-[#003366] text-white">
            <th className="px-2 py-2 border border-slate-300 text-left w-[130px] min-w-[130px] sticky left-0 z-10 bg-[#003366]">CONSULTOR</th>
            <th className="px-2 py-2 border border-slate-300 text-left w-[120px] min-w-[120px] sticky left-[130px] z-10 bg-[#003366]">FUNÇÃO</th>
            <th className="px-1 py-2 border border-slate-300 text-center w-[60px] min-w-[60px] sticky left-[250px] z-10 bg-[#003366]">Período</th>
            {weekDays.map((day) => {
              const isWeekendDay = isWeekend(day);
              const isToday = isSameDay(day, new Date());
              
              return (
                <th 
                  key={format(day, 'yyyy-MM-dd')}
                  className={`
                    px-1 py-2 border border-slate-300 text-center w-[85px] min-w-[85px]
                    ${isWeekendDay ? 'bg-[#4472C4]' : 'bg-[#003366]'}
                    ${isToday ? 'ring-2 ring-yellow-400 ring-inset' : ''}
                  `}
                >
                  <div className="font-bold">{format(day, 'dd')}</div>
                  <div className="font-normal text-[10px] opacity-80">
                    {format(day, 'EEEE', { locale: ptBR })}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {displayedConsultants.map((consultant) => {
            const consultantId = consultant.id || consultant._id || '';
            const functionsText = (consultant.functions || [])
              .map(f => getFunctionLabel(f))
              .join(', ') || '-';
            
            return PERIODS.map((period, periodIndex) => {
              const isFirstPeriod = periodIndex === 0;
              const isLastPeriod = periodIndex === PERIODS.length - 1;
              const timeSlots = TIME_SLOTS_BY_PERIOD[period];
              
              return timeSlots.map((timeSlot, slotIndex) => {
                const isFirstSlot = slotIndex === 0;
                const rowSpan = timeSlots.length;
                
                return (
                  <tr 
                    key={`${consultantId}-${period}-${timeSlot}`}
                    className={`
                      ${isLastPeriod && slotIndex === timeSlots.length - 1 ? 'border-b-2 border-slate-400' : ''}
                    `}
                  >
                    {/* Nome do Consultor - sticky */}
                    {isFirstPeriod && isFirstSlot && (
                      <td 
                        rowSpan={PERIODS.reduce((acc, p) => acc + TIME_SLOTS_BY_PERIOD[p].length, 0)}
                        className="px-2 py-1 border border-slate-300 font-medium text-[#003366] align-top sticky left-0 z-[8] bg-slate-50"
                        style={{ backgroundColor: '#f8fafc' }}
                      >
                        {consultant.name}
                      </td>
                    )}
                    
                    {/* Função - sticky */}
                    {isFirstPeriod && isFirstSlot && (
                      <td 
                        rowSpan={PERIODS.reduce((acc, p) => acc + TIME_SLOTS_BY_PERIOD[p].length, 0)}
                        className="px-2 py-1 border border-slate-300 text-slate-600 text-[10px] align-top sticky left-[130px] z-[8] bg-slate-50"
                        style={{ backgroundColor: '#f8fafc' }}
                      >
                        {functionsText}
                      </td>
                    )}
                    
                    {/* Período - sticky */}
                    {isFirstSlot && (
                      <td 
                        rowSpan={rowSpan}
                        className="px-1 py-1 border border-slate-300 text-center text-slate-700 font-medium align-middle text-[10px] sticky left-[250px] z-[8] bg-slate-100"
                        style={{ backgroundColor: '#f1f5f9' }}
                      >
                        {PERIOD_LABELS[period]}
                      </td>
                    )}
                    
                    {/* Células dos dias */}
                    {weekDays.map((day) => {
                      const dateKey = format(day, 'yyyy-MM-dd');
                      const isWeekendDay = isWeekend(day);
                      const allocations = getAllocationsForSlot(consultantId, day, timeSlot);
                      const cellStyle = getCellStyle(allocations, period, isWeekendDay);
                      const hasConflict = allocations.length > 1;
                      const content = getCellContent(allocations, period, isWeekendDay);
                      
                      return (
                        <td
                          key={`${consultantId}-${dateKey}-${timeSlot}`}
                          className={`
                            border border-slate-300 text-center align-middle
                            h-[26px] min-h-[26px] max-h-[26px]
                            relative
                            cursor-pointer hover:opacity-80
                            ${hasConflict ? 'animate-pulse' : ''}
                          `}
                          style={{
                            backgroundColor: cellStyle.backgroundColor,
                            color: cellStyle.color,
                            ...(cellStyle.boxShadow && { boxShadow: cellStyle.boxShadow }),
                            ...(cellStyle.border && { border: cellStyle.border }),
                          }}
                          onClick={() => handleCellClick(consultant, day, timeSlot, period, allocations)}
                          onMouseEnter={(e) => handleCellHover(e, allocations[0])}
                          onMouseLeave={() => setHoveredCell(null)}
                        >
                          <span className="truncate block px-1 text-[10px] font-medium">
                            {content}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              });
            });
          })}
        </tbody>
      </table>

      {/* Allocation Modal */}
      {modalOpen && selectedCell && (
        <AllocationModal
          consultant={selectedCell.consultant}
          date={selectedCell.date}
          timeSlot={selectedCell.timeSlot}
          period={selectedCell.period}
          allocation={selectedCell.allocation}
          existingAllocations={selectedCell.existingAllocations}
          isAdmin={isAdmin}
          onClose={() => {
            setModalOpen(false);
            setSelectedCell(null);
          }}
        />
      )}

      {/* Cell Tooltip */}
      {hoveredCell && (
        <CellTooltip
          allocation={hoveredCell.allocation}
          x={hoveredCell.x}
          y={hoveredCell.y}
        />
      )}
    </div>
  );
}
