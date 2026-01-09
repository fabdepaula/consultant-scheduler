import cron from 'node-cron';
import SessionLog from '../models/SessionLog.js';

export const initSessionLogCleanup = () => {
  // Executar a cada hora
  cron.schedule('0 * * * *', async () => {
    try {
      const thirtyTwoHoursAgo = new Date(Date.now() - 32 * 60 * 60 * 1000);
      
      const result = await SessionLog.deleteMany({
        loginAt: { $lt: thirtyTwoHoursAgo },
      });

      if (result.deletedCount > 0) {
        console.log(`[SessionLog] Limpeza: ${result.deletedCount} logs removidos`);
      }
    } catch (error) {
      console.error('[SessionLog] Erro na limpeza:', error);
    }
  });

  console.log('[SessionLog] Job de limpeza iniciado (executa a cada hora)');
};

