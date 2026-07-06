import { useState, useEffect, useRef, useCallback } from 'react';
import Webcam from 'react-webcam';
import { Camera, LogIn, LogOut, CheckCircle, XCircle, Search } from 'lucide-react';
import { employeesApi, attendanceApi } from '../api';

export default function CheckInPage() {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeStatus, setEmployeeStatus] = useState(null);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const webcamRef = useRef(null);

  useEffect(() => {
    loadEmployees();
  }, []);

  async function loadEmployees() {
    try {
      const data = await employeesApi.getAll({ active: '1' });
      setEmployees(data);
    } catch (err) {
      console.error(err);
    }
  }

  async function selectEmployee(employee) {
    setSelectedEmployee(employee);
    setMessage(null);
    try {
      const status = await attendanceApi.getEmployeeStatus(employee.id);
      setEmployeeStatus(status);
      setShowCamera(true);
    } catch (err) {
      console.error(err);
    }
  }

  const captureAndRegister = useCallback(async () => {
    if (!webcamRef.current || !selectedEmployee || !employeeStatus) return;

    setLoading(true);
    try {
      const photo_snapshot = webcamRef.current.getScreenshot();

      await attendanceApi.register({
        employee_id: selectedEmployee.id,
        type: employeeStatus.next_action,
        photo_snapshot,
      });

      setMessage({
        type: 'success',
        text: `${employeeStatus.next_action === 'entry' ? 'Entrada' : 'Salida'} registrada para ${selectedEmployee.first_name} ${selectedEmployee.last_name}`,
        time: new Date().toLocaleTimeString('es-CL'),
      });

      setTimeout(() => {
        setSelectedEmployee(null);
        setEmployeeStatus(null);
        setShowCamera(false);
        setMessage(null);
        setSearch('');
      }, 3000);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, [selectedEmployee, employeeStatus]);

  const filteredEmployees = employees.filter(e => {
    const term = search.toLowerCase();
    return (
      e.first_name.toLowerCase().includes(term) ||
      e.last_name.toLowerCase().includes(term) ||
      e.rut.toLowerCase().includes(term)
    );
  });

  const videoConstraints = {
    width: 640,
    height: 480,
    facingMode: 'user',
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {message && (
        <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 ${
          message.type === 'success'
            ? 'bg-emerald-50 border-2 border-emerald-200'
            : 'bg-red-50 border-2 border-red-200'
        }`}>
          {message.type === 'success' ? (
            <CheckCircle className="w-8 h-8 text-emerald-600 shrink-0" />
          ) : (
            <XCircle className="w-8 h-8 text-red-600 shrink-0" />
          )}
          <div>
            <p className={`font-semibold text-lg ${
              message.type === 'success' ? 'text-emerald-800' : 'text-red-800'
            }`}>{message.text}</p>
            {message.time && <p className="text-sm text-gray-500">Hora: {message.time}</p>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel izquierdo - Selección de empleado */}
        <div className="card">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Seleccionar Empleado</h2>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por nombre o RUT..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-lg
                         focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {filteredEmployees.map(employee => (
              <button
                key={employee.id}
                onClick={() => selectEmployee(employee)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                  selectedEmployee?.id === employee.id
                    ? 'bg-primary-50 border-2 border-primary-300'
                    : 'hover:bg-gray-50 border-2 border-transparent'
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden shrink-0">
                  {employee.photo_url ? (
                    <img src={employee.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold">
                      {employee.first_name[0]}{employee.last_name[0]}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {employee.first_name} {employee.last_name}
                  </p>
                  <p className="text-sm text-gray-500">{employee.rut}</p>
                </div>
                {employee.department && (
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-lg">
                    {employee.department}
                  </span>
                )}
              </button>
            ))}
            {filteredEmployees.length === 0 && (
              <p className="text-center text-gray-400 py-8">No se encontraron empleados</p>
            )}
          </div>
        </div>

        {/* Panel derecho - Cámara y registro */}
        <div className="card flex flex-col">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Registro Visual</h2>

          {showCamera && selectedEmployee ? (
            <>
              <div className="flex items-center gap-3 mb-4 p-3 bg-gray-50 rounded-xl">
                <div className="w-14 h-14 rounded-full bg-gray-200 overflow-hidden shrink-0">
                  {selectedEmployee.photo_url ? (
                    <img src={selectedEmployee.photo_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400 font-bold text-lg">
                      {selectedEmployee.first_name[0]}{selectedEmployee.last_name[0]}
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-bold text-gray-900">
                    {selectedEmployee.first_name} {selectedEmployee.last_name}
                  </p>
                  <p className="text-sm text-gray-500">{selectedEmployee.department || 'Sin departamento'}</p>
                </div>
                {employeeStatus && (
                  <span className={`ml-auto text-sm font-semibold px-3 py-1 rounded-full ${
                    employeeStatus.status === 'present'
                      ? 'bg-emerald-100 text-emerald-700'
                      : employeeStatus.status === 'exited'
                      ? 'bg-orange-100 text-orange-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {employeeStatus.status === 'present' ? 'En oficina' :
                     employeeStatus.status === 'exited' ? 'Salió' : 'No ha ingresado'}
                  </span>
                )}
              </div>

              <div className="relative rounded-2xl overflow-hidden bg-black mb-4 aspect-[4/3]">
                <Webcam
                  ref={webcamRef}
                  audio={false}
                  screenshotFormat="image/jpeg"
                  videoConstraints={videoConstraints}
                  className="w-full h-full object-cover"
                  mirrored={true}
                />
                <div className="absolute inset-0 border-4 border-white/30 rounded-2xl pointer-events-none" />
                <div className="absolute top-3 left-3 bg-red-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                  EN VIVO
                </div>
              </div>

              {employeeStatus && (
                <button
                  onClick={captureAndRegister}
                  disabled={loading}
                  className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 
                    transition-all active:scale-95 disabled:opacity-50 ${
                    employeeStatus.next_action === 'entry'
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-200'
                      : 'bg-orange-600 hover:bg-orange-700 text-white shadow-lg shadow-orange-200'
                  }`}
                >
                  {employeeStatus.next_action === 'entry' ? (
                    <><LogIn className="w-6 h-6" />{loading ? 'Registrando...' : 'Registrar ENTRADA'}</>
                  ) : (
                    <><LogOut className="w-6 h-6" />{loading ? 'Registrando...' : 'Registrar SALIDA'}</>
                  )}
                </button>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-12">
              <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Camera className="w-12 h-12 text-gray-300" />
              </div>
              <p className="text-gray-400 text-lg">Selecciona un empleado para iniciar el registro</p>
              <p className="text-gray-300 text-sm mt-2">La cámara se activará automáticamente</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
