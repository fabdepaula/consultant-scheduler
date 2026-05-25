import { Request, Response } from 'express';

const EMBED_URL = process.env.POWERBI_CONFERENCIA_EMBED_URL?.trim() || '';

export const getConferenciaApontamentoEmbed = async (
  _req: Request,
  res: Response
): Promise<void> => {
  if (!EMBED_URL) {
    res.status(503).json({
      message: 'Relatório de conferência de apontamento não configurado no servidor.',
    });
    return;
  }

  res.json({
    embedUrl: EMBED_URL,
    title: 'Apontamentos de Horas',
  });
};
