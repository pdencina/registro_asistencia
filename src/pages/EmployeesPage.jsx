import { useState, useEffect, useRef } from 'react';
import { UserPlus, Edit2, Trash2, Camera, X, Search } from 'lucide-react';
import Webcam from 'react-webcam';
import { employeesApi } from '../api';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [search, setSearch] = useState('');
  const [showPhotoCapture, setShowPhotoCapture] = useState(null);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({ rut: '', first_name: '', last_name: '', department: '', position: '' });
  const webcamRef = useRef(null);

  useEffect(() => { loadEmployees(); }, []);

  async function loadEmployees() {
    try {
      const data = await employeesApi.getAll();
      setEmployees(data);
    } catch (err) { console.error(err); }
  }

  function openForm(employee = null) {
    if (employee) {
      setEditingEmployee(employee);
      setFormData({
        rut: employee.rut,
        first_name: employee.first_name,
        last_name: employee.last_name,
        department: employee.department || '',
        position: employee.position || ''
      });
    } else {
      setEditingEmployee(null);
      setFormData({ rut: '', first_name: '', last_name: '', department: '', position: '' });
    }
    setShowForm(true);
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      if (editingEmployee) {
        await employeesApi.update(editingEmployee.id, formData);
      } else {
        await employeesApi.create(formData);
      }
      setShowForm(false);
      loadEmployees();
    } catch (err) { setError(err.message); }
  }

  async function handleDelete(id) {
    if (!confirm('¿Desactivar este empleado?')) return;
    try {
      await employeesApi.delete(id);
      loadEmployees();
    } catch (err) { console.error(err); }
  }

  async function capturePhoto(employeeId) {
    if (!webcamRef.current) return;
    const photo = webcamRef.current.getScreenshot();
    try {
      await employeesApi.update(employeeId, { photo });
      setShowPhotoCapture(null);
      loadEmployees();
    } catch (err) { console.error(err); }
  }

  const filteredEmployees = employees.filter(e => {
    const term = search.toLowerCase();
    return e.first_name.toLowerCase().includes(term) ||
           e.last_name.toLowerCase().includes(term) ||
           e.rut.toLowerCase().includes(term);
  });

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Gestión de Empleados</h2>
        <button onClick={() => openForm()} className="btn-primary flex items-center gap-2">
          <UserPlus className="w-5 h-5" /> Nuevo Empleado
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar empleados..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredEmployees.map(employee => (
          <div key={employee.id} className={`card flex items-start gap-4 ${!employee.active ? 'opacity-50' : ''}`}>
            <div className="relative">
              <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden shrink-0">
                {employee.photo_url ? (
                  <img src={employee.photo_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-xl">
                    {employee.first_name[0]}{employee.last_name[0]}
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowPhotoCapture(employee.id)}
                className="absolute -bottom-1 -right-1 w-7 h-7 bg-primary-600 text-white rounded-full flex items-center justify-center shadow-md hover:bg-primary-700"
              >
                <Camera className="w-4 h-4" />
              </button>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-gray-900 truncate">{employee.first_name} {employee.last_name}</p>
              <p className="text-sm text-gray-500">{employee.rut}</p>
              <p className="text-sm text-gray-400">{employee.department || '—'} · {employee.position || '—'}</p>
              <div className="flex gap-2 mt-2">
                <button onClick={() => openForm(employee)} className="text-primary-600 hover:text-primary-800 p-1">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(employee.id)} className="text-red-600 hover:text-red-800 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            {!employee.active && (
              <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full">Inactivo</span>
            )}
          </div>
        ))}
      </div>

      {/* Modal Formulario */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">{editingEmployee ? 'Editar Empleado' : 'Nuevo Empleado'}</h3>
              <button onClick={() => setShowForm(false)} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            {error && <p className="text-red-600 text-sm bg-red-50 p-3 rounded-xl mb-4">{error}</p>}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">RUT *</label>
                <input value={formData.rut} onChange={e => setFormData({...formData, rut: e.target.value})}
                  required placeholder="12.345.678-9"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
                  <input value={formData.first_name} onChange={e => setFormData({...formData, first_name: e.target.value})}
                    required className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Apellido *</label>
                  <input value={formData.last_name} onChange={e => setFormData({...formData, last_name: e.target.value})}
                    required className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Departamento</label>
                <input value={formData.department} onChange={e => setFormData({...formData, department: e.target.value})}
                  placeholder="Ej: Operaciones, TI"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cargo</label>
                <input value={formData.position} onChange={e => setFormData({...formData, position: e.target.value})}
                  placeholder="Ej: Analista, Supervisor"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none" />
              </div>
              <button type="submit" className="btn-primary w-full">
                {editingEmployee ? 'Guardar Cambios' : 'Crear Empleado'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Modal Captura de Foto */}
      {showPhotoCapture && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold">Capturar Foto</h3>
              <button onClick={() => setShowPhotoCapture(null)} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="rounded-2xl overflow-hidden bg-black mb-4">
              <Webcam ref={webcamRef} audio={false} screenshotFormat="image/jpeg"
                videoConstraints={{ width: 480, height: 480, facingMode: 'user' }}
                className="w-full" mirrored={true} />
            </div>
            <button onClick={() => capturePhoto(showPhotoCapture)} className="btn-primary w-full flex items-center justify-center gap-2">
              <Camera className="w-5 h-5" /> Capturar y Guardar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
