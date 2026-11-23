import { useState } from 'react';
import AuthPage from './components/AuthPage';
import StudentDashboard from './components/StudentDashboard';
import AdminDashboard from './components/AdminDashboard';

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) : null;
  });

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
  };

  if (!user) return <AuthPage onLogin={setUser} />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <nav className="border-b border-slate-800 bg-slate-900/70 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg text-indigo-400">Joineazy</span>
          <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
            {user.role}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-300">{user.name}</span>
          <button
            onClick={handleLogout}
            className="text-sm bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg cursor-pointer"
          >
            Logout
          </button>
        </div>
      </nav>

      {user.role === 'ADMIN' ? <AdminDashboard /> : <StudentDashboard user={user} />}
    </div>
  );
}