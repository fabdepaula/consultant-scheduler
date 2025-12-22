import { useState, useEffect, useRef } from 'react';
import { X, Save, Calendar, Clock, Building2, Users2, ChevronDown, Check, Trash2, Plus } from 'lucide-react';
import { format, eachDayOfInterval, endOfWeek, addWeeks } from 'date-fns';
import { useAgendaStore } from '../store/agendaStore';
import { allocationsAPI } from '../services/api';
import { Period, TimeSlot, TIME_SLOTS_BY_PERIOD, TIME_SLOT_LABELS, PERIOD_LABELS } from '../types';

interface MultiSelectProps<T extends string> {
  label: string;
  icon?: React.ReactNode;
  options: { value: T; label: string }[];
  selected: T[];
  onChange: (selected: T[]) => void;
  placeholder?: string;
  showSelectAll?: boolean;
}

function MultiSelectDropdown<T extends string>({ label, icon, options, selected, onChange, placeholder = "Selecione...", showSelectAll = false }: MultiSelectProps<T>) {
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
          {/* Botões de ação rápida */}
          {showSelectAll && options.length > 0 && (
            <div className="sticky top-0 bg-slate-50 border-b border-slate-200 px-4 py-2 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  const allSelected = selected.length === options.length;
                  if (allSelected) {
                    onChange([]);
                  } else {
                    onChange(options.map(o => o.value));
                  }
                }}
                className="text-xs text-ngr-secondary hover:text-ngr-primary hover:underline font-medium"
              >
                {selected.length === options.length ? 'Desmarcar todos' : 'Selecionar todos'}
              </button>
              {selected.length > 0 && (
                <>
                  <span className="text-slate-300">|</span>
                  <button
                    type="button"
                    onClick={() => onChange([])}
                    className="text-xs text-slate-500 hover:text-red-600 hover:underline"
                  >
                    Limpar
                  </button>
                </>
              )}
            </div>
          )}
          
          {/* Lista de opções */}
          <div className="max-h-40 overflow-y-auto">
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
        </div>
      )}
    </div>
  );
}

interface BulkUpdateModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentWeekStart: Date;
  weeksToShow: number;
}

export default function BulkUpdateModal({ isOpen, onClose, currentWeekStart, weeksToShow }: BulkUpdateModalProps) {
  const { consultants, projects, statusConfigs, refreshData } = useAgendaStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'create' | 'delete'>('create'); // Modo: criar ou excluir
  
  const [formData, setFormData] = useState({
    periods: ['manha'] as Period[],
    projectId: '',
    status: '', // Vazio por padrão para permitir filtrar todos no modo delete
    consultantIds: [] as string[],
    startDate: format(currentWeekStart, 'yyyy-MM-dd'),
    endDate: format(endOfWeek(addWeeks(currentWeekStart, weeksToShow - 1), { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    timeSlots: [] as TimeSlot[],
    overwriteExisting: false, // Não sobrepor por padrão
  });

  // Limpar formulário quando o modal abrir
  useEffect(() => {
    if (isOpen) {
      // Resetar para valores padrão quando o modal abrir
      const endDate = endOfWeek(addWeeks(currentWeekStart, weeksToShow - 1), { weekStartsOn: 1 });
      setFormData({
        periods: ['manha'] as Period[],
        projectId: '',
        status: '',
        consultantIds: [],
        startDate: format(currentWeekStart, 'yyyy-MM-dd'),
        endDate: format(endDate, 'yyyy-MM-dd'),
        timeSlots: TIME_SLOTS_BY_PERIOD['manha'],
        overwriteExisting: false,
      });
      setMode('create');
      setError('');
    }
  }, [isOpen, currentWeekStart, weeksToShow]);

  // Resetar status e projeto quando mudar de modo
  useEffect(() => {
    if (mode === 'delete') {
      setFormData(prev => ({ ...prev, status: '', projectId: '' }));
    } else {
      setFormData(prev => ({ ...prev, status: prev.status || 'a_confirmar' }));
    }
  }, [mode]);

  // Lista de status disponíveis
  const availableStatuses = statusConfigs
    .filter(config => config.active && config.key !== 'conflito' && config.key !== 'fim_semana')
    .sort((a, b) => a.order - b.order);

  // Consultores com agenda
  const consultantsWithAgenda = consultants.filter(c => c.active && c.hasAgenda);

  // Horários disponíveis para todos os períodos selecionados
  const availableTimeSlots = formData.periods.flatMap(period => TIME_SLOTS_BY_PERIOD[period]);

  // Inicializar com todos os horários dos períodos selecionados
  useEffect(() => {
    if (formData.periods.length > 0) {
      const allTimeSlots = formData.periods.flatMap(period => TIME_SLOTS_BY_PERIOD[period]);
      // Atualiza os horários quando os períodos mudam, mantendo os já selecionados se ainda forem válidos
      setFormData(prev => ({
        ...prev,
        timeSlots: prev.timeSlots.length === 0 
          ? allTimeSlots 
          : prev.timeSlots.filter(ts => allTimeSlots.includes(ts))
      }));
    }
  }, [formData.periods]);

  // Função helper para criar data no timezone local sem problemas
  const createLocalDate = (dateString: string): Date => {
    const [year, month, day] = dateString.split('-').map(Number);
    // Criar data no timezone local (mês é 0-indexed no JS)
    return new Date(year, month - 1, day);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.consultantIds.length === 0) {
      setError('Selecione pelo menos um consultor');
      return;
    }

    if (formData.periods.length === 0) {
      setError('Selecione pelo menos um período');
      return;
    }

    if (formData.timeSlots.length === 0) {
      setError('Selecione pelo menos um horário');
      return;
    }

    // Validar status no modo create
    if (!formData.status || formData.status.trim() === '') {
      setError('Selecione um status');
      return;
    }

    // Validar projeto se necessário
    const statusConfig = availableStatuses.find(s => s.key === formData.status);
    if (statusConfig?.requiresProject !== false && !formData.projectId) {
      setError('Selecione um projeto');
      return;
    }

    setIsSubmitting(true);

    try {
      // Gerar todas as combinações de datas, períodos, consultores e horários
      // Usar função helper para evitar problemas de timezone
      const start = createLocalDate(formData.startDate);
      const end = createLocalDate(formData.endDate);
      // Garantir que as datas estão no início do dia no timezone local
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      const dates = eachDayOfInterval({ start, end });

      const allocations: any[] = [];

      for (const date of dates) {
        // Pular fins de semana
        const dayOfWeek = date.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;

        for (const consultantId of formData.consultantIds) {
          for (const period of formData.periods) {
            // Filtrar apenas os horários que pertencem a este período
            const periodTimeSlots = formData.timeSlots.filter(ts => 
              TIME_SLOTS_BY_PERIOD[period].includes(ts)
            );
            
            for (const timeSlot of periodTimeSlots) {
              allocations.push({
                consultantId,
                projectId: formData.projectId || undefined,
                date: format(date, 'yyyy-MM-dd'),
                period,
                timeSlot,
                status: formData.status,
              });
            }
          }
        }
      }

      if (allocations.length === 0) {
        setError('Nenhuma alocação será criada. Verifique as datas selecionadas.');
        setIsSubmitting(false);
        return;
      }

      // Se não deve sobrepor, filtrar apenas as que não existem
      let allocationsToCreate = allocations;
      let skippedCount = 0;

      if (!formData.overwriteExisting) {
        console.log('[BulkUpdate] Checkbox DESMARCADO - verificando alocações existentes...');
        
        // Buscar alocações existentes no período
        const startDateStr = format(start, 'yyyy-MM-dd');
        const endDateStr = format(end, 'yyyy-MM-dd');
        const response = await allocationsAPI.getAgenda(startDateStr, endDateStr);
        const existingAllocations = response.data.allocations || [];

        console.log('[BulkUpdate] Total de alocações existentes no período:', existingAllocations.length);

        // Criar um Set para busca rápida de alocações existentes
        // Normalizar a data para formato YYYY-MM-DD
        const existingKeys = new Set(
          existingAllocations.map((alloc: any) => {
            const consultantId = alloc.consultantId?._id || alloc.consultantId?.id || alloc.consultantId;
            // Normalizar data para YYYY-MM-DD
            const dateStr = typeof alloc.date === 'string' 
              ? alloc.date.split('T')[0] 
              : format(new Date(alloc.date), 'yyyy-MM-dd');
            const key = `${consultantId}-${dateStr}-${alloc.period}-${alloc.timeSlot}`;
            return key;
          })
        );

        console.log('[BulkUpdate] Chaves de alocações existentes:', Array.from(existingKeys).slice(0, 5), '...');

        // Filtrar apenas alocações que não existem
        allocationsToCreate = allocations.filter(alloc => {
          const key = `${alloc.consultantId}-${alloc.date}-${alloc.period}-${alloc.timeSlot}`;
          const exists = existingKeys.has(key);
          if (exists) {
            console.log('[BulkUpdate] IGNORANDO (já existe):', key);
            skippedCount++;
          }
          return !exists;
        });

        console.log('[BulkUpdate] Total a criar:', allocationsToCreate.length);
        console.log('[BulkUpdate] Total ignoradas:', skippedCount);

        if (allocationsToCreate.length === 0) {
          setError('Todas as alocações já existem no período selecionado. Marque "Sobrepor agendas existentes" para criar novas alocações (gerando conflitos).');
          setIsSubmitting(false);
          return;
        }
      } else {
        console.log('[BulkUpdate] Checkbox MARCADO - criando todas as alocações (pode gerar conflitos)');
      }

      await allocationsAPI.createBulk(allocationsToCreate);
      await refreshData();
      onClose();
      
      const message = skippedCount > 0
        ? `✅ ${allocationsToCreate.length} alocações criadas com sucesso!\n📝 ${skippedCount} alocações já existentes foram ignoradas.`
        : `✅ ${allocationsToCreate.length} alocações criadas com sucesso!`;
      
      alert(message);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao criar alocações em massa');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.consultantIds.length === 0) {
      setError('Selecione pelo menos um consultor');
      return;
    }

    if (formData.periods.length === 0) {
      setError('Selecione pelo menos um período');
      return;
    }

    if (formData.timeSlots.length === 0) {
      setError('Selecione pelo menos um horário');
      return;
    }

    // Confirmar exclusão
    const start = createLocalDate(formData.startDate);
    const end = createLocalDate(formData.endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    const dates = eachDayOfInterval({ start, end }).filter(d => {
      const day = d.getDay();
      return day !== 0 && day !== 6;
    });

    let estimatedCount = 0;
    for (const period of formData.periods) {
      const periodTimeSlots = formData.timeSlots.filter(ts => 
        TIME_SLOTS_BY_PERIOD[period].includes(ts)
      );
      estimatedCount += dates.length * formData.consultantIds.length * periodTimeSlots.length;
    }

    if (!confirm(`Tem certeza que deseja excluir aproximadamente ${estimatedCount} alocações?\n\nEsta ação não pode ser desfeita!`)) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Buscar todas as alocações que correspondem aos critérios
      const startDateStr = format(start, 'yyyy-MM-dd');
      const endDateStr = format(end, 'yyyy-MM-dd');
      
      // Usar getAgenda para buscar alocações no período (mais eficiente)
      const response = await allocationsAPI.getAgenda(startDateStr, endDateStr);

      const allAllocations = response.data.allocations || [];
      
      // Filtrar alocações que correspondem aos critérios
      const allocationsToDelete = allAllocations.filter((alloc: any) => {
        // Verificar consultor
        const consultantId = alloc.consultantId?._id || alloc.consultantId?.id || alloc.consultantId;
        if (!formData.consultantIds.includes(consultantId)) return false;

        // Verificar período
        if (!formData.periods.includes(alloc.period)) return false;

        // Verificar horário
        if (!formData.timeSlots.includes(alloc.timeSlot)) return false;

        // Verificar status (apenas se foi especificado e não está vazio)
        if (formData.status && formData.status.trim() !== '') {
          if (alloc.status !== formData.status) return false;
        }

        // Verificar projeto (apenas se foi especificado e não está vazio)
        if (formData.projectId && formData.projectId.trim() !== '') {
          const projectId = alloc.projectId?._id || alloc.projectId?.id || alloc.projectId;
          // Se o filtro tem projeto, a alocação deve ter o mesmo projeto
          if (projectId !== formData.projectId) return false;
        }
        // Se projeto não foi especificado, inclui todas (com ou sem projeto)

        return true;
      });

      if (allocationsToDelete.length === 0) {
        setError('Nenhuma alocação encontrada com os critérios selecionados');
        setIsSubmitting(false);
        return;
      }

      // Extrair IDs das alocações
      const allocationIds = allocationsToDelete.map((alloc: any) => alloc._id || alloc.id);

      // Excluir em massa
      await allocationsAPI.deleteBulk(allocationIds);
      await refreshData();
      onClose();
      
      alert(`✅ ${allocationIds.length} alocações excluídas com sucesso!`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erro ao excluir alocações em massa');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    if (mode === 'create') {
      await handleCreate(e);
    } else {
      await handleDelete(e);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 flex-shrink-0">
          <h2 className="text-xl font-bold text-slate-800">
            Atualização em Massa
          </h2>
          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200 flex-shrink-0 mt-4">
          <button
            type="button"
            onClick={() => setMode('create')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              mode === 'create'
                ? 'border-ngr-secondary text-ngr-primary'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Plus className="w-4 h-4 inline mr-1" />
            Criar Alocações
          </button>
          <button
            type="button"
            onClick={() => setMode('delete')}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              mode === 'delete'
                ? 'border-red-500 text-red-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Trash2 className="w-4 h-4 inline mr-1" />
            Excluir Alocações
          </button>
        </div>

        {/* Conteúdo */}
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto flex-1 pt-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-600 text-sm">
              {error}
            </div>
          )}

          {/* Períodos */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <Clock className="w-4 h-4 inline mr-1" />
              Períodos *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['manha', 'tarde', 'noite'] as Period[]).map((p) => {
                const isSelected = formData.periods.includes(p);
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setFormData(prev => {
                        const newPeriods = isSelected
                          ? prev.periods.filter(period => period !== p)
                          : [...prev.periods, p];
                        
                        // Atualiza horários para incluir todos dos períodos selecionados
                        const allTimeSlots = newPeriods.flatMap(period => TIME_SLOTS_BY_PERIOD[period]);
                        
                        return {
                          ...prev,
                          periods: newPeriods,
                          timeSlots: prev.timeSlots.filter(ts => allTimeSlots.includes(ts))
                        };
                      });
                    }}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition-all border flex items-center justify-center gap-2 ${
                      isSelected
                        ? 'bg-ngr-secondary text-white border-ngr-secondary' 
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {isSelected && <Check className="w-4 h-4" />}
                    {PERIOD_LABELS[p]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Horários */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Horários *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {availableTimeSlots.map((slot) => (
                <label
                  key={slot}
                  className={`
                    flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors
                    ${formData.timeSlots.includes(slot)
                      ? 'bg-ngr-light border-ngr-secondary text-ngr-primary'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }
                  `}
                >
                  <input
                    type="checkbox"
                    checked={formData.timeSlots.includes(slot)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData(prev => ({ ...prev, timeSlots: [...prev.timeSlots, slot] }));
                      } else {
                        setFormData(prev => ({ ...prev, timeSlots: prev.timeSlots.filter(t => t !== slot) }));
                      }
                    }}
                    className="sr-only"
                  />
                  <div className={`
                    w-4 h-4 rounded border flex items-center justify-center
                    ${formData.timeSlots.includes(slot)
                      ? 'bg-ngr-secondary border-ngr-secondary'
                      : 'border-slate-300'
                    }
                  `}>
                    {formData.timeSlots.includes(slot) && (
                      <Check className="w-3 h-3 text-white" />
                    )}
                  </div>
                  <span className="text-sm">{TIME_SLOT_LABELS[slot]}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Status {mode === 'create' ? '*' : '(opcional)'}
            </label>
            <select
              value={formData.status}
              onChange={(e) => {
                const newStatus = e.target.value;
                // No modo delete, permite vazio
                if (mode === 'delete') {
                  setFormData(prev => ({ ...prev, status: newStatus }));
                } else {
                  // No modo create, valida projeto se necessário
                  const statusConfig = availableStatuses.find(s => s.key === newStatus);
                  const requiresProject = statusConfig?.requiresProject ?? true;
                  setFormData(prev => ({
                    ...prev,
                    status: newStatus,
                    projectId: requiresProject ? prev.projectId : ''
                  }));
                }
              }}
              className="select-field"
              required={mode === 'create'}
            >
              <option value="">{mode === 'delete' ? 'Todos os status' : 'Selecione...'}</option>
              {availableStatuses.map(({ key, label }) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          {/* Projeto */}
          {(mode === 'create' ? availableStatuses.find(s => s.key === formData.status)?.requiresProject !== false : true) && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Building2 className="w-4 h-4 inline mr-1" />
                Projeto {mode === 'create' && availableStatuses.find(s => s.key === formData.status)?.requiresProject !== false ? '*' : '(opcional)'}
              </label>
              <select
                value={formData.projectId}
                onChange={(e) => setFormData(prev => ({ ...prev, projectId: e.target.value }))}
                className="select-field"
                required={mode === 'create' && availableStatuses.find(s => s.key === formData.status)?.requiresProject !== false}
              >
                <option value="">{mode === 'delete' ? 'Todos os projetos' : 'Selecione um projeto...'}</option>
                {projects.filter(p => p.active).map((project) => (
                  <option key={project._id || project.id} value={project._id || project.id}>
                    {project.projectId} - {project.client} ({project.projectName})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Consultores */}
          <MultiSelectDropdown
            label="Consultores"
            icon={<Users2 className="w-4 h-4 inline mr-1" />}
            options={consultantsWithAgenda.map(c => ({ 
              value: c._id || c.id, 
              label: c.name 
            }))}
            selected={formData.consultantIds}
            onChange={(selected) => setFormData(prev => ({ ...prev, consultantIds: selected }))}
            placeholder="Selecione os consultores..."
            showSelectAll={true}
          />

          {/* Datas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Data Inicial *
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                className="input-field"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Data Final *
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                className="input-field"
                required
                min={formData.startDate}
              />
            </div>
          </div>

          {/* Checkbox para sobrepor agendas existentes (apenas no modo create) */}
          {mode === 'create' && (
            <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.overwriteExisting}
                  onChange={(e) => setFormData(prev => ({ ...prev, overwriteExisting: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 text-ngr-secondary border-slate-300 rounded focus:ring-2 focus:ring-ngr-secondary/20"
                />
                <div className="flex-1">
                  <span className="text-sm font-medium text-slate-700">
                    Criar mesmo com agendas existentes (gerar conflitos)
                  </span>
                  <p className="text-xs text-slate-500 mt-1">
                    <strong>Desmarcado:</strong> Apenas cria alocações em horários sem agenda existente.<br/>
                    <strong>Marcado:</strong> Sempre cria novas alocações, mesmo que já existam outras no mesmo horário (gerando conflitos).
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Preview */}
          {formData.consultantIds.length > 0 && formData.periods.length > 0 && formData.timeSlots.length > 0 && formData.startDate && formData.endDate && (
            <div className={`border rounded-lg p-3 text-sm ${
              mode === 'delete' 
                ? 'bg-red-50 border-red-200 text-red-800' 
                : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}>
              <strong>Preview:</strong> {mode === 'delete' ? 'Serão excluídas aproximadamente' : 'Tentativa de criar até'}{' '}
              <strong>
                {(() => {
                  // Usar função helper para evitar problemas de timezone
                  const createLocalDate = (dateString: string): Date => {
                    const [year, month, day] = dateString.split('-').map(Number);
                    return new Date(year, month - 1, day);
                  };
                  
                  const start = createLocalDate(formData.startDate);
                  const end = createLocalDate(formData.endDate);
                  start.setHours(0, 0, 0, 0);
                  end.setHours(23, 59, 59, 999);
                  const dates = eachDayOfInterval({ start, end }).filter(d => {
                    const day = d.getDay();
                    return day !== 0 && day !== 6; // Exclui fins de semana
                  });
                  
                  // Contar alocações considerando períodos e horários
                  let total = 0;
                  for (const period of formData.periods) {
                    const periodTimeSlots = formData.timeSlots.filter(ts => 
                      TIME_SLOTS_BY_PERIOD[period].includes(ts)
                    );
                    total += dates.length * formData.consultantIds.length * periodTimeSlots.length;
                  }
                  
                  return total;
                })()}
              </strong>{' '}
              alocações
              {mode === 'create' && !formData.overwriteExisting && (
                <p className="text-xs mt-1 text-blue-600">
                  ℹ️ Apenas horários sem alocações existentes serão preenchidos
                </p>
              )}
              {mode === 'create' && formData.overwriteExisting && (
                <p className="text-xs mt-1 text-orange-600">
                  ⚠️ Criará novas alocações mesmo em horários já ocupados (gerará conflitos)
                </p>
              )}
              {mode === 'delete' && (
                <p className="text-xs mt-1 text-red-600">
                  ⚠️ Esta ação não pode ser desfeita!
                </p>
              )}
            </div>
          )}

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={isSubmitting}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex items-center gap-2 ${
                mode === 'delete' 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'btn-primary'
              }`}
            >
              {isSubmitting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white" />
              ) : mode === 'delete' ? (
                <Trash2 className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {mode === 'delete' ? 'Excluir Alocações' : 'Criar Alocações'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

