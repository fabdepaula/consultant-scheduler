import { useEffect, useState } from 'react';
import { reportsAPI } from '../services/api';
import { BarChart3, AlertCircle, Loader2 } from 'lucide-react';

export default function ConferenciaApontamento() {
  const [embedUrl, setEmbedUrl] = useState<string | null>(null);
  const [title, setTitle] = useState('Conferência de Apontamento');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError('');
        const response = await reportsAPI.getConferenciaApontamentoEmbed();
        setEmbedUrl(response.data.embedUrl);
        if (response.data.title) {
          setTitle(response.data.title);
        }
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ||
          'Não foi possível carregar o relatório.';
        setError(message);
        setEmbedUrl(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-ngr-primary flex items-center gap-2">
          <BarChart3 className="w-7 h-7" />
          {title}
        </h1>
        <p className="text-slate-600 text-sm mt-1">
          Relatório Power BI — conferência de apontamentos de horas
        </p>
      </div>

      {loading && (
        <div className="flex-1 flex items-center justify-center bg-white rounded-xl border border-slate-200">
          <div className="flex flex-col items-center gap-3 text-slate-600">
            <Loader2 className="w-10 h-10 animate-spin text-ngr-secondary" />
            <span>Carregando relatório...</span>
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="flex-1 flex items-center justify-center bg-white rounded-xl border border-red-200 p-8">
          <div className="flex flex-col items-center gap-3 text-center max-w-md">
            <AlertCircle className="w-12 h-12 text-red-500" />
            <p className="text-red-700 font-medium">{error}</p>
            <p className="text-slate-500 text-sm">
              Verifique se a variável POWERBI_CONFERENCIA_EMBED_URL está definida no
              servidor ou contate o administrador.
            </p>
          </div>
        </div>
      )}

      {!loading && !error && embedUrl && (
        <div className="flex-1 min-h-0 bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <iframe
            title={title}
            src={embedUrl}
            className="w-full h-full min-h-[calc(100vh-12rem)] border-0"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}
