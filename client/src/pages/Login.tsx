import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { login, error, clearError } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    clearError();

    try {
      const result = await login(email, password);
      // Se precisa trocar senha, redireciona para tela de troca
      if (result?.mustChangePassword) {
        navigate('/trocar-senha');
      } else {
      navigate('/');
      }
    } catch {
      // Error is handled by the store
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 to-blue-50">
      <div className="relative w-full max-w-md">
        {/* Logo and title */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-ngr-primary rounded-2xl shadow-xl mb-4">
            <span className="text-white font-bold text-xl">NGR</span>
          </div>
          <h1 className="text-3xl font-bold text-ngr-primary mb-2">
            NGR GLOBAL
          </h1>
          <p className="text-slate-500">
            Agenda de Consultores
          </p>
        </div>

        {/* Login form */}
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg p-4 text-red-600">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none z-10" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: '2.75rem' }}
                  placeholder="seu@ngrglobal.com.br"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Senha
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 pointer-events-none z-10" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field"
                  style={{ paddingLeft: '2.75rem', paddingRight: '2.75rem' }}
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 z-20"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full btn-primary py-3 font-semibold flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          {/* Mostrar credenciais de teste apenas em desenvolvimento */}
          {import.meta.env.DEV && (
            <div className="mt-6 pt-6 border-t border-slate-200">
              <p className="text-center text-sm text-slate-500">
                Credenciais de teste:
              </p>
              <div className="mt-2 text-center text-xs text-slate-400 space-y-1">
                <p><span className="text-slate-600">Admin:</span> admin@ngrglobal.com.br / Ngr@123</p>
                <p><span className="text-slate-600">Consultor:</span> [email]@ngrglobal.com.br / Ngr@123</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} NGR Global. Todos os direitos reservados.
        </div>
      </div>
    </div>
  );
}
