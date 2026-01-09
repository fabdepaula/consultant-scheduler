import { Clock, AlertTriangle } from 'lucide-react';

interface Props {
  secondsRemaining: number;
  onContinue: () => void;
  onLogout: () => void;
}

export default function InactivityWarning({ secondsRemaining, onContinue, onLogout }: Props) {
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-yellow-600" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-slate-800">
              Sessão Inativa
            </h3>
            <p className="text-sm text-slate-600">
              Você será desconectado por inatividade
            </p>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-slate-400" />
            <span className="text-2xl font-bold text-slate-800">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </span>
          </div>
          <p className="text-center text-sm text-slate-600">
            Sua sessão será encerrada automaticamente em breve
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onLogout}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors"
          >
            Sair Agora
          </button>
          <button
            onClick={onContinue}
            className="flex-1 px-4 py-2 bg-ngr-primary text-white rounded-lg hover:bg-ngr-secondary transition-colors font-medium"
          >
            Continuar
          </button>
        </div>
      </div>
    </div>
  );
}

