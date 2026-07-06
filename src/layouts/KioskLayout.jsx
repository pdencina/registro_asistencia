import { useState, useEffect } from 'react';
import CheckInPage from '../pages/CheckInPage';

export default function KioskLayout() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header con branding ARM GLOBAL */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-700 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-sm">AG</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">ARM GLOBAL</h1>
            <p className="text-xs text-gray-500">Sistema de Registro de Asistencia</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-gray-700">
            {time.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
          <p className="text-3xl font-bold text-primary-600">
            {time.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="flex-1 overflow-auto">
        <CheckInPage />
      </main>
    </div>
  );
}
