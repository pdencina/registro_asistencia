import { useState, useEffect } from 'react';
import { Loader } from 'lucide-react';
import CheckInPage from '../pages/CheckInPage';
import DeviceActivationPage from '../pages/DeviceActivationPage';
import { devicesApi } from '../api';
import { getDeviceId } from '../utils/deviceId';

export default function KioskLayout() {
  const [time, setTime] = useState(new Date());
  const [deviceStatus, setDeviceStatus] = useState('checking'); // checking | authorized | unauthorized

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    checkDevice();
  }, []);

  async function checkDevice() {
    try {
      const deviceId = getDeviceId();
      const result = await devicesApi.check(deviceId);
      setDeviceStatus(result.authorized ? 'authorized' : 'unauthorized');
    } catch (err) {
      // If API fails (table doesn't exist yet), allow access temporarily
      console.error('Device check failed:', err);
      setDeviceStatus('unauthorized');
    }
  }

  // Loading state
  if (deviceStatus === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader className="w-10 h-10 text-primary-500 animate-spin" />
      </div>
    );
  }

  // Not authorized
  if (deviceStatus === 'unauthorized') {
    return <DeviceActivationPage onActivated={() => setDeviceStatus('authorized')} />;
  }

  // Authorized — show kiosk
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Header ARM GLOBAL */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo-armglobal.svg" alt="ARM Global" className="h-8" />
          <div className="border-l border-gray-200 pl-3">
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

      {/* Contenido */}
      <main className="flex-1 overflow-auto">
        <CheckInPage />
      </main>
    </div>
  );
}
