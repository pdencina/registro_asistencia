import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { Camera, Users, ClipboardList, BarChart3 } from 'lucide-react';
import { useState, useEffect } from 'react';
import CheckInPage from './pages/CheckInPage';
import EmployeesPage from './pages/EmployeesPage';
import AttendancePage from './pages/AttendancePage';
import DashboardPage from './pages/DashboardPage';

function App() {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Router>
      <div className="min-h-screen flex flex-col">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
              <Camera className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Control de Asistencia</h1>
              <p className="text-xs text-gray-500">Registro Visual · iPad</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-700">
              {time.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
            <p className="text-2xl font-bold text-primary-600">
              {time.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto">
          <Routes>
            <Route path="/" element={<CheckInPage />} />
            <Route path="/employees" element={<EmployeesPage />} />
            <Route path="/attendance" element={<AttendancePage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
          </Routes>
        </main>

        {/* Bottom Navigation - Optimizado para iPad */}
        <nav className="bg-white border-t border-gray-200 px-4 py-2">
          <div className="flex justify-around max-w-2xl mx-auto">
            <NavItem to="/" icon={<Camera className="w-6 h-6" />} label="Registrar" />
            <NavItem to="/employees" icon={<Users className="w-6 h-6" />} label="Empleados" />
            <NavItem to="/attendance" icon={<ClipboardList className="w-6 h-6" />} label="Asistencia" />
            <NavItem to="/dashboard" icon={<BarChart3 className="w-6 h-6" />} label="Dashboard" />
          </div>
        </nav>
      </div>
    </Router>
  );
}

function NavItem({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-all ${
          isActive
            ? 'text-primary-600 bg-primary-50'
            : 'text-gray-400 hover:text-gray-600'
        }`
      }
    >
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </NavLink>
  );
}

export default App;
