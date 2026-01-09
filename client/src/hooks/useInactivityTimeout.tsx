import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import InactivityWarning from '../components/Security/InactivityWarning';

// Configurações (em milissegundos)
const INACTIVITY_TIMEOUT = 30 * 60 * 1000; // 30 minutos
const WARNING_TIME = 5 * 60 * 1000; // Aviso 5 minutos antes (aos 25 minutos)
const WARNING_DURATION = 5 * 60 * 1000; // 5 minutos para o usuário responder

export const useInactivityTimeout = () => {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [lastActivity, setLastActivity] = useState(Date.now());
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const warningTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const { logout } = useAuthStore();

  const resetTimer = useCallback(() => {
    // Limpar timers existentes
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
      warningTimeoutRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    // Esconder aviso se estiver visível
    setShowWarning(false);
    setSecondsRemaining(0);

    // Atualizar última atividade
    setLastActivity(Date.now());
  }, []);

  const handleContinue = useCallback(() => {
    resetTimer();
  }, [resetTimer]);

  const handleLogout = useCallback(async () => {
    await logout();
    window.location.href = '/login';
  }, [logout]);

  useEffect(() => {
    const checkInactivity = () => {
      const timeSinceActivity = Date.now() - lastActivity;
      const timeUntilWarning = INACTIVITY_TIMEOUT - WARNING_TIME;
      const timeUntilLogout = INACTIVITY_TIMEOUT;

      // Se passou o tempo de aviso mas ainda não mostrou
      if (timeSinceActivity >= timeUntilWarning && timeSinceActivity < timeUntilLogout && !showWarning) {
        setShowWarning(true);
        
        // Calcular tempo restante até logout
        const timeRemaining = timeUntilLogout - timeSinceActivity;
        let remaining = Math.floor(timeRemaining / 1000); // converter para segundos
        setSecondsRemaining(remaining);
        
        // Iniciar countdown
        countdownRef.current = setInterval(() => {
          remaining -= 1;
          setSecondsRemaining(Math.max(0, remaining));
          
          if (remaining <= 0) {
            if (countdownRef.current) {
              clearInterval(countdownRef.current);
              countdownRef.current = null;
            }
            handleLogout();
          }
        }, 1000);

        // Timeout para logout se não responder
        warningTimeoutRef.current = setTimeout(() => {
          handleLogout();
        }, timeRemaining);
      }
      // Se passou o tempo total de inatividade e não está mostrando aviso
      else if (timeSinceActivity >= timeUntilLogout && !showWarning) {
        handleLogout();
      }
    };

    // Verificar a cada 10 segundos para ser mais responsivo
    timeoutRef.current = setInterval(checkInactivity, 10 * 1000);

    // Verificar imediatamente também
    checkInactivity();

    return () => {
      if (timeoutRef.current) {
        clearInterval(timeoutRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [lastActivity, showWarning, handleLogout]);

  useEffect(() => {
    // Eventos que indicam atividade do usuário
    const events = [
      'mousedown',
      'mousemove',
      'keypress',
      'scroll',
      'touchstart',
      'click',
    ];

    // Throttle para evitar muitas chamadas
    let throttleTimer: NodeJS.Timeout | null = null;
    const throttledReset = () => {
      if (throttleTimer) return;
      throttleTimer = setTimeout(() => {
        resetTimer();
        throttleTimer = null;
      }, 1000); // Resetar no máximo a cada 1 segundo
    };

    events.forEach((event) => {
      document.addEventListener(event, throttledReset, { passive: true });
    });

    // Também resetar quando a janela ganha foco
    window.addEventListener('focus', resetTimer);

    return () => {
      events.forEach((event) => {
        document.removeEventListener(event, throttledReset);
      });
      window.removeEventListener('focus', resetTimer);
      if (throttleTimer) {
        clearTimeout(throttleTimer);
      }
    };
  }, [resetTimer]);

  const InactivityWarningComponent = showWarning ? (
    <InactivityWarning
      secondsRemaining={secondsRemaining}
      onContinue={handleContinue}
      onLogout={handleLogout}
    />
  ) : null;

  return { InactivityWarningComponent };
};

