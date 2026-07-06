import { useState } from 'react';
import { Shield, Eye, EyeOff, Monitor } from 'lucide-react';
import { devicesApi } from '../api';
import { getDeviceId } from '../utils/deviceId';

export default function DeviceActivationPage({ onActivated }) {
  const [pin, setPin] = useState('');
  const [name, setName] = useState('Tótem Principal');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPin, setShowPin] = useState(false);

  async function handleActivate(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const deviceId = getDeviceId();
      await devicesApi.authorize(deviceId, pin, name);
      onActivated();
    } catch (err) {
      setError(err.message || 'PIN incorrecto');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 p-8 w-full max-w-sm text-center">
        <div className="w-20 h-20 bg-amber-50 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <Shield className="w-10 h-10 text-amber-600" />
        </div>

        <h2 className="text-xl font-bold text-gray-900 mb-2">Activar Dispositivo</h2>
        <p className="text-sm text-gray-500 mb-6">
          Este dispositivo no está autorizado para registrar asistencia. Ingresa el PIN de administrador para activarlo.
        </p>

        {error && (
          <p className="text-red-600 text-sm bg-red-50 p-3 rounded-xl mb-4">{error}</p>
        )}

        <form onSubmit={handleActivate} className="space-y-4 text-left">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Monitor className="w-4 h-4 inline mr-1" />
              Nombre del dispositivo
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ej: Tótem Recepción"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">PIN Administrador</label>
            <div className="relative">
              <input
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••"
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-center text-xl tracking-widest focus:ring-2 focus:ring-primary-500 outline-none"
                inputMode="numeric"
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary w-full"
            disabled={pin.length < 4 || loading}
          >
            {loading ? 'Verificando...' : 'Activar Dispositivo'}
          </button>
        </form>

        <p className="text-xs text-gray-400 mt-6">
          Contacta al administrador si no tienes el PIN de activación.
        </p>
      </div>
    </div>
  );
}
