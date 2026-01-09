import dotenv from 'dotenv';

dotenv.config();

// Configurações do sistema que podem ser definidas via variáveis de ambiente
export const systemConfig = {
  // Intervalo de polling automático da agenda (em milissegundos)
  // Configurável via variável de ambiente AGENDA_POLLING_INTERVAL
  // Padrão: 30 segundos (30000ms)
  agendaPollingInterval: Number(process.env.AGENDA_POLLING_INTERVAL) || 30000,
  
  // Validação: mínimo 5 segundos, máximo 5 minutos
  getPollingInterval(): number {
    const interval = this.agendaPollingInterval;
    if (interval < 5000) return 5000; // Mínimo 5 segundos
    if (interval > 300000) return 300000; // Máximo 5 minutos
    return interval;
  }
};

// Exportar configurações públicas (não sensíveis)
export const publicSystemConfig = {
  pollingInterval: systemConfig.getPollingInterval(),
};

