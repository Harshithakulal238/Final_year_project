import { useMemo, useState } from 'react';
import AppRoutes from './routes/AppRoutes';
import Navbar from './components/Navbar';
import Toast from './components/Toast';
import { getStoredUser } from './utils/auth';

function App() {
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);
  const user = useMemo(() => getStoredUser(), []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3600);
  };

  return (
    <div className="min-h-screen bg-surface text-slate-900">
      <Navbar user={user} showToast={showToast} />
      <main className="px-4 py-6 lg:px-10">
        <AppRoutes showToast={showToast} setLoading={setLoading} />
      </main>
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
          <div className="rounded-3xl bg-white p-8 shadow-2xl">
            <div className="flex flex-col items-center gap-6">
              <div className="relative">
                <div className="h-16 w-16 animate-spin rounded-full border-4 border-primary/20 border-t-primary"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <svg className="h-6 w-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <div className="text-center">
                <div className="text-lg font-semibold text-slate-900">Loading...</div>
                <div className="text-sm text-slate-500">Please wait while we fetch your data</div>
              </div>
            </div>
          </div>
        </div>
      )}
      {toast && <Toast message={toast.message} type={toast.type} />}
    </div>
  );
}

export default App;
