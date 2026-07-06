import { useState, useEffect } from 'react';
import { Clock, LogIn, LogOut, Filter } from 'lucide-react';
import { attendanceApi } from '../api';

export default function AttendancePage() {
  const [records, setRecords] = useState([]);
  const [view, setView] = useState('today');
  const [filters, setFilters] = useState({
    start_date: new Date().toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    type: '',
  });

  useEffect(() => { loadRecords(); }, [view, filters]);

  async function loadRecords() {
    try {
      if (view === 'today') {
        const data = await attendanceApi.getToday();
        setRecords(data);
      } else {
        const params = {};
        if (filters.start_date) params.start_date = filters.start_date;
        if (filters.end_date) params.end_date = filters.end_date;
        if (filters.type) params.type = filters.type;
        const data = await attendanceApi.getHistory(params);
        setRecords(data);
      }
    } catch (err) { console.error(err); }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Registros de Asistencia</h2>
        <div className="flex gap-2">
          <button onClick={() => setView('today')}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${view === 'today' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Hoy
          </button>
          <button onClick={() => setView('history')}
            className={`px-4 py-2 rounded-xl font-medium transition-all ${view === 'history' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            Historial
          </button>
        </div>
      </div>

      {view === 'history' && (
        <div className="card mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-5 h-5 text-gray-400" />
            <span className="font-medium text-gray-700">Filtros</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-500 mb-1">Desde</label>
              <input type="date" value={filters.start_date}
                onChange={(e) => setFilters(f => ({ ...f, start_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl" />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Hasta</label>
              <input type="date" value={filters.end_date}
                onChange={(e) => setFilters(f => ({ ...f, end_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl" />
            </div>
            <div>
              <label className="block text-sm text-gray-500 mb-1">Tipo</label>
              <select value={filters.type}
                onChange={(e) => setFilters(f => ({ ...f, type: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl">
                <option value="">Todos</option>
                <option value="entry">Entradas</option>
                <option value="exit">Salidas</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Empleado</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Tipo</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Fecha/Hora</th>
                <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">Área</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {records.map(record => (
                <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-200 overflow-hidden shrink-0">
                        {record.photo_url ? (
                          <img src={record.photo_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-sm">
                            {record.first_name?.[0]}{record.last_name?.[0]}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{record.first_name} {record.last_name}</p>
                        <p className="text-xs text-gray-400">{record.rut}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${
                      record.type === 'entry' ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'
                    }`}>
                      {record.type === 'entry' ? <><LogIn className="w-4 h-4" /> Entrada</> : <><LogOut className="w-4 h-4" /> Salida</>}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock className="w-4 h-4 text-gray-400" />
                      <span>{new Date(record.timestamp).toLocaleString('es-CL')}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-500">{record.department || '—'}</td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr><td colSpan="4" className="text-center py-12 text-gray-400">No hay registros para mostrar</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
