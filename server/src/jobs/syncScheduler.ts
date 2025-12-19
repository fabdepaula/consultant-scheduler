import cron, { ScheduledTask } from 'node-cron';
import { DataSyncConfig } from '../models/index.js';
import { executeDataSync } from '../services/dataSyncService.js';

const tasks: Record<string, ScheduledTask> = {};

const presetToCron = (preset: any): string | null => {
  if (!preset) return null;
  if (preset.type === 'daily') {
    const [hour = '0', minute = '0'] = (preset.timeOfDay || '00:00').split(':');
    return `${minute} ${hour} * * *`;
  }
  if (preset.type === 'weekly') {
    const [hour = '0', minute = '0'] = (preset.timeOfDay || '00:00').split(':');
    const day = preset.dayOfWeek ?? 0; // domingo
    return `${minute} ${hour} * * ${day}`;
  }
  if (preset.type === 'interval') {
    const interval = Math.max(1, Math.min(Number(preset.intervalMinutes) || 15, 60));
    return `*/${interval} * * * *`; // a cada N minutos
  }
  return null;
};

const scheduleConfig = (configId: string, cronExpression: string) => {
  if (!cron.validate(cronExpression)) {
    console.warn(`[DataSync] Cron inválido para ${configId}: ${cronExpression}`);
    return;
  }

  // Cancela se já existir
  if (tasks[configId]) {
    tasks[configId].stop();
    delete tasks[configId];
  }

  tasks[configId] = cron.schedule(cronExpression, async () => {
    try {
      await executeDataSync(configId);
    } catch (err) {
      console.error(`[DataSync] Erro ao executar agendado ${configId}:`, err);
    }
  });
};

export const rescheduleAllConfigs = async () => {
  // Cancela tarefas anteriores
  Object.values(tasks).forEach((task) => task.stop());
  Object.keys(tasks).forEach((key) => delete tasks[key]);

  const configs = await DataSyncConfig.find({ active: true });
  configs.forEach((config) => {
    if (!config.schedule || config.schedule.mode === 'none') return;

    let cronExpression: string | null = null;
    if (config.schedule.mode === 'cron') {
      cronExpression = config.schedule.cronExpression || null;
    } else if (config.schedule.mode === 'preset') {
      cronExpression = presetToCron(config.schedule.preset);
    }

    if (cronExpression) {
      scheduleConfig(config.id, cronExpression);
    }
  });
};

// Inicializa ao subir o servidor
export const initSyncScheduler = async () => {
  try {
    await rescheduleAllConfigs();
    console.log('[DataSync] Scheduler iniciado');
  } catch (err) {
    console.error('[DataSync] Erro ao iniciar scheduler', err);
  }
};

