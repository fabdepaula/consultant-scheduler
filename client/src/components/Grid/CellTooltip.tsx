import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useMemo } from 'react';
import { useAgendaStore } from '../../store/agendaStore';
import { Allocation, Project, User, STATUS_LABELS, TIME_SLOT_LABELS, PERIOD_LABELS, StatusConfig } from '../../types';

interface Props {
  allocation: Allocation;
  x: number;
  y: number;
}

export default function CellTooltip({ allocation, x, y }: Props) {
  const { statusConfigs, projects } = useAgendaStore();
  const project = allocation.projectId as Project | null;
  const createdBy = allocation.createdBy as User | null;

  // Busca a configuração de cor e label do status no banco
  const statusStyle = useMemo(() => {
    if (Array.isArray(statusConfigs)) {
      const config = statusConfigs.find((s: StatusConfig) => s.key === allocation.status);
      if (config) {
        return {
          backgroundColor: config.color,
          color: config.textColor,
          label: config.label
        };
      }
    }
    // Fallback para labels fixos se não encontrar no banco
    return {
      backgroundColor: '#CCCCCC',
      color: '#000000',
      label: (STATUS_LABELS[allocation.status as AllocationStatus] || allocation.status) as string
    };
  }, [statusConfigs, allocation.status]);

  return (
    <div 
      className="fixed z-50 bg-white border border-slate-200 rounded-lg shadow-xl p-4 max-w-xs pointer-events-none"
      style={{
        left: Math.min(x + 10, window.innerWidth - 320),
        top: Math.min(y + 10, window.innerHeight - 200),
      }}
    >
      <div className="space-y-2 text-sm">
        {/* Status - usando cores do banco de dados */}
        <div className="flex items-center gap-2">
          <span 
            className="px-2 py-0.5 rounded text-xs font-medium border"
            style={{
              backgroundColor: statusStyle.backgroundColor,
              color: statusStyle.color,
              borderColor: statusStyle.backgroundColor
            }}
          >
            {statusStyle.label}
          </span>
        </div>

        {/* Project info */}
        {project && typeof project === 'object' && (() => {
          const fullProject = projects.find(p => (p._id || p.id) === (project._id || project.id));
          return (
            <div className="border-t border-slate-200 pt-2 mt-2">
              <p className="font-medium text-slate-800">{project.client}</p>
              <p className="text-slate-600">{project.projectName}</p>
              <p className="text-xs text-slate-400">ID: {project.projectId}</p>
              {fullProject?.projectManager && (
                <p className="text-xs text-slate-500 mt-1">
                  Gerente: <span className="font-medium">{fullProject.projectManager}</span>
                </p>
              )}
            </div>
          );
        })()}

        {/* Time info */}
        <div className="text-slate-500 text-xs space-y-1">
          <p>📅 {format(new Date(allocation.date), "dd/MM/yyyy", { locale: ptBR })}</p>
          <p>🕐 {PERIOD_LABELS[allocation.period]} - {TIME_SLOT_LABELS[allocation.timeSlot]}</p>
        </div>

        {/* Notes */}
        {allocation.notes && (
          <div className="border-t border-slate-200 pt-2 mt-2">
            <p className="text-slate-500 italic">{allocation.notes}</p>
          </div>
        )}

        {/* Created by */}
        {createdBy && typeof createdBy === 'object' && (
          <div className="border-t border-slate-200 pt-2 mt-2 text-xs text-slate-400">
            <p>Criado por: {createdBy.name}</p>
            {allocation.createdAt && (
              <p>Em: {format(new Date(allocation.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
