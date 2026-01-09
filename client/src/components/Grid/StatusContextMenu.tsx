import { useEffect, useRef } from 'react';
import { Trash2, X } from 'lucide-react';
import { StatusConfig, Allocation } from '../../types';

interface Props {
  allocation: Allocation | null;
  allocations: Allocation[]; // Para casos de conflito
  x: number;
  y: number;
  onClose: () => void;
  onStatusChange: (allocationId: string, newStatus: string) => Promise<void>;
  onDelete: (allocationId: string) => Promise<void>;
  availableStatuses: StatusConfig[];
  canEdit: boolean;
  canDelete: boolean;
}

export default function StatusContextMenu({
  allocation,
  allocations,
  x,
  y,
  onClose,
  onStatusChange,
  onDelete,
  availableStatuses,
  canEdit,
  canDelete
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Buscar os 4 status marcados para menu de contexto, ordenados por 'order'
  const contextMenuStatuses = availableStatuses
    .filter(status => status.active && status.showInContextMenu)
    .sort((a, b) => a.order - b.order)
    .slice(0, 4); // Máximo 4 status

  // Fechar ao clicar fora ou pressionar ESC
  useEffect(() => {
    // Flag para rastrear se o menu está sendo fechado para evitar abrir o modal
    let isClosing = false;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        isClosing = true;
        // Prevenir que o clique fora dispare o onClick da célula
        e.stopPropagation();
        e.preventDefault();
        
        // Usar timeout para garantir que o flag seja processado antes de fechar
        setTimeout(() => {
          onClose();
          // Resetar o flag após um delay maior para garantir que não abra o modal
          setTimeout(() => {
            isClosing = false;
          }, 100);
        }, 0);
      }
    };

    const handleRightClick = (e: MouseEvent) => {
      // Se clicar com botão direito fora do menu, fechar sem abrir modal
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        isClosing = true;
        e.stopPropagation();
        e.preventDefault();
        onClose();
        setTimeout(() => {
          isClosing = false;
        }, 200);
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        isClosing = true;
        e.stopPropagation();
        onClose();
        setTimeout(() => {
          isClosing = false;
        }, 100);
      }
    };

    // Usar timeout para garantir que o menu foi renderizado antes de adicionar os listeners
    const timeoutId = setTimeout(() => {
      // Usar capture phase (true) para interceptar o evento antes que ele chegue à célula
      document.addEventListener('mousedown', handleClickOutside, true);
      document.addEventListener('contextmenu', handleRightClick, true);
      document.addEventListener('keydown', handleEscape, true);
    }, 0);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('contextmenu', handleRightClick, true);
      document.removeEventListener('keydown', handleEscape, true);
    };
  }, [onClose]);

  // Não mostrar se não há permissão ou se não há alocação (exceto se houver conflito)
  if (!canEdit && !canDelete) {
    return null;
  }

  // Se há múltiplas alocações (conflito), não mostrar menu de status rápido
  if (allocations.length > 1) {
    return null;
  }

  // Se não há alocação, não mostrar menu
  if (!allocation) {
    return null;
  }

  const handleStatusClick = async (statusKey: string) => {
    if (!allocation._id && !allocation.id) return;
    
    try {
      await onStatusChange(allocation._id || allocation.id, statusKey);
      onClose();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
    }
  };

  const handleDeleteClick = async () => {
    if (!allocation._id && !allocation.id) return;
    
    if (!confirm('Tem certeza que deseja excluir esta alocação?')) {
      return;
    }

    try {
      await onDelete(allocation._id || allocation.id);
      onClose();
    } catch (error) {
      console.error('Erro ao excluir alocação:', error);
    }
  };

  // Calcular posição do menu (evitar sair da tela)
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: Math.min(x, window.innerWidth - 160),
    top: Math.min(y, window.innerHeight - 250),
    zIndex: 1000,
  };

  return (
    <div
      ref={menuRef}
      className="bg-white border border-slate-300 rounded-md shadow-lg py-1 min-w-[150px] max-w-[180px]"
      style={menuStyle}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header com botão fechar */}
      {contextMenuStatuses.length > 0 && canEdit && (
        <>
          <div className="px-2 py-1.5 text-[10px] font-medium text-slate-600 uppercase border-b border-slate-200 flex items-center justify-between">
            <span>Atalho</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onClose();
              }}
              className="p-0.5 hover:bg-slate-100 rounded transition-colors text-slate-400 hover:text-slate-600"
              title="Fechar"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
          
          {/* Lista de status */}
          {contextMenuStatuses.map((status) => {
            const isCurrentStatus = allocation.status === status.key;
            return (
              <button
                key={status.key}
                onClick={() => handleStatusClick(status.key)}
                disabled={isCurrentStatus}
                className={`
                  w-full text-left px-2 py-1.5 text-xs transition-colors
                  ${isCurrentStatus 
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                    : 'hover:bg-slate-50 text-slate-700'
                  }
                `}
              >
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded border border-slate-300 flex-shrink-0"
                    style={{ backgroundColor: status.color }}
                  />
                  <span className="truncate">{status.label}</span>
                  {isCurrentStatus && (
                    <span className="ml-auto text-[10px] text-slate-400">•</span>
                  )}
                </div>
              </button>
            );
          })}
        </>
      )}

      {/* Divider */}
      {canDelete && (canEdit && contextMenuStatuses.length > 0) && (
        <div className="border-t border-slate-200 my-0.5" />
      )}

      {/* Excluir */}
      {canDelete && (
        <button
          onClick={handleDeleteClick}
          className="w-full text-left px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors flex items-center gap-1.5"
        >
          <Trash2 className="w-3 h-3" />
          Excluir
        </button>
      )}
    </div>
  );
}

