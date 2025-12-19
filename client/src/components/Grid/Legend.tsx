import { useState, useEffect } from 'react';
import { useAgendaStore } from '../../store/agendaStore';
import { STATUS_LABELS, AllocationStatus } from '../../types';

// Cores padrão para fallback
const DEFAULT_STATUS_CONFIG: Record<string, { bg: string; text: string; label: string }> = {
  confirmado_presencial: { bg: '#FFFF00', text: '#000000', label: 'Confirmado Presencial' },
  confirmado_remoto: { bg: '#4472C4', text: '#FFFFFF', label: 'Confirmado Remoto' },
  a_confirmar: { bg: '#70AD47', text: '#FFFFFF', label: 'À Confirmar' },
  livre: { bg: '#C6EFCE', text: '#000000', label: 'Livre' },
  bloqueado: { bg: '#808080', text: '#FFFFFF', label: 'Bloqueado' },
  conflito: { bg: '#FF0000', text: '#FFFFFF', label: 'Conflito' },
  ponte: { bg: '#BFBFBF', text: '#000000', label: 'Ponte' },
  feriado: { bg: '#A6A6A6', text: '#FFFFFF', label: 'Feriado' },
  fim_semana: { bg: '#D9D9D9', text: '#000000', label: 'Final de Semana' },
};

const LEGEND_EXPANDED_KEY = 'legendExpanded';

export default function Legend() {
  const { statusConfigs } = useAgendaStore();
  
  // Estado para controlar se a legenda está expandida (padrão: colapsada)
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem(LEGEND_EXPANDED_KEY);
    return saved === 'true';
  });

  // Salvar preferência no localStorage
  useEffect(() => {
    localStorage.setItem(LEGEND_EXPANDED_KEY, isExpanded.toString());
  }, [isExpanded]);

  // Usa os status do backend se disponíveis, senão usa os padrões
  const statusItems = Array.isArray(statusConfigs) && statusConfigs.length > 0
    ? statusConfigs
        .filter(s => s.active)
        .sort((a, b) => a.order - b.order)
        .map(s => ({
          key: s.key,
          label: s.label,
          color: s.color,
          textColor: s.textColor
        }))
    : Object.entries(DEFAULT_STATUS_CONFIG).map(([key, config]) => ({
        key,
        label: config.label,
        color: config.bg,
        textColor: config.text
      }));

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
      {/* Header colapsável */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 hover:text-slate-900 transition-colors focus:outline-none"
        title={isExpanded ? 'Recolher legenda' : 'Expandir legenda'}
      >
        <span className="text-slate-500 text-sm">
          {isExpanded ? '▼' : '▶'}
        </span>
        <h3 className="text-sm font-semibold text-slate-600">Legenda</h3>
      </button>
      
      {/* Conteúdo colapsável com animação */}
      {isExpanded && (
        <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            {statusItems.map((status) => (
              <div key={status.key} className="legend-item">
                <div 
                  className="legend-color"
                  style={{ backgroundColor: status.color }}
                />
                <span className="text-slate-600">{status.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
