import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import KioskLayout from './layouts/KioskLayout';
import AdminLayout from './layouts/AdminLayout';
import AdminLoginPage from './pages/AdminLoginPage';

function App() {
  return (
    <Router>
      <Routes>
        {/* Vista pública: solo registro facial */}
        <Route path="/" element={<KioskLayout />} />

        {/* Admin: protegido con PIN */}
        <Route path="/admin/*" element={<ProtectedAdmin />} />
      </Routes>
    </Router>
  );
}

function ProtectedAdmin() {
  const [authenticated, setAuthenticated] = useState(
    sessionStorage.getItem('admin_auth') === 'true'
  );

  if (!authenticated) {
    return <AdminLoginPage onLogin={() => setAuthenticated(true)} />;
  }

  return <AdminLayout />;
}

export default App;
