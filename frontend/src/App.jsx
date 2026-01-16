import { BrowserRouter as Router, Routes, Route, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Scan, Upload, Printer, LayoutDashboard, Settings, LogOut } from 'lucide-react';
import ScanPage from './pages/ScanPage';
import UploadPage from './pages/UploadPage';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';
import LoginPage from './pages/LoginPage';

// Private Route Wrapper
const PrivateRoute = ({ children }) => {
  const session = sessionStorage.getItem('auth_session');
  return session ? children : <Navigate to="/login" replace />;
};

// Layout wrapper for protected pages
const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    sessionStorage.removeItem('auth_session');
    navigate('/login');
  };

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div style={{
            background: 'linear-gradient(135deg, #635bff 0%, #a259ff 100%)',
            padding: '6px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Printer size={20} color="white" />
          </div>
          <h2 style={{ fontSize: '16px', margin: 0 }}>Brady Station</h2>
        </div>

        <nav className="sidebar-nav">
          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            padding: '8px 12px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Apps
          </div>

          <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Scan size={18} />
            <span>Scan & Print</span>
          </NavLink>
          <NavLink to="/upload" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Upload size={18} />
            <span>Upload PDF</span>
          </NavLink>

          <div style={{
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            padding: '24px 12px 8px',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}>
            Management
          </div>

          <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </NavLink>

          <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Settings size={18} />
            <span>Settings</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <button
            onClick={handleLogout}
            className="nav-link"
            style={{
              width: '100%',
              marginBottom: '12px',
              color: 'var(--error)',
              justifyContent: 'flex-start',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <LogOut size={18} />
            <span>Sign Out</span>
          </button>

          <div style={{ padding: '12px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%' }}></div>
              <span>System Online • v2.3</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {children}
      </main>
    </div>
  );
};

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        {/* Protected Routes */}
        <Route path="/" element={
          <PrivateRoute>
            <Layout><ScanPage /></Layout>
          </PrivateRoute>
        } />
        <Route path="/upload" element={
          <PrivateRoute>
            <Layout><UploadPage /></Layout>
          </PrivateRoute>
        } />
        <Route path="/dashboard" element={
          <PrivateRoute>
            <Layout><DashboardPage /></Layout>
          </PrivateRoute>
        } />
        <Route path="/settings" element={
          <PrivateRoute>
            <Layout><SettingsPage /></Layout>
          </PrivateRoute>
        } />
      </Routes>
    </Router>
  );
}

export default App;
