import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { login } from '../utils/auth';

function SignInPage({ showToast }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required.');
      return;
    }

    setLoading(true);
    try {
      const user = await login(username, password);
      showToast('Signed in successfully');
      if (user.hasProfile) {
        navigate('/dashboard');
      } else {
        navigate('/profile');
      }
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Unable to sign in. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-10 animate-fade-in">
      <div className="w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl lg:flex">
        <div className="hidden w-1/2 bg-gradient-to-br from-primary via-emerald-600 to-slate-900 p-12 text-white lg:block relative overflow-hidden">
          <div className="relative z-10 space-y-8">
            <div className="flex items-center gap-3">
              <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <p className="text-sm uppercase tracking-wider text-emerald-200 font-semibold">Government scheme portal</p>
            </div>
            <h2 className="text-4xl font-bold leading-tight">Sign in to access recommendations</h2>
            <p className="max-w-md text-lg leading-relaxed text-slate-200">Use your login details to view personalized scheme cards, filter eligibility, and manage your profile.</p>
            <div className="grid gap-4 pt-8">
              <div className="flex items-center gap-3 text-slate-300">
                <div className="h-2 w-2 rounded-full bg-emerald-400"></div>
                <span>Personalized recommendations</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <div className="h-2 w-2 rounded-full bg-emerald-400"></div>
                <span>Secure profile management</span>
              </div>
              <div className="flex items-center gap-3 text-slate-300">
                <div className="h-2 w-2 rounded-full bg-emerald-400"></div>
                <span>Easy application tracking</span>
              </div>
            </div>
          </div>
          {/* Decorative elements */}
          <div className="absolute top-8 right-8 h-32 w-32 rounded-full bg-emerald-400/10 animate-pulse"></div>
          <div className="absolute bottom-8 left-8 h-24 w-24 rounded-full bg-cyan-400/10 animate-bounce"></div>
        </div>
        <div className="w-full p-12 lg:w-1/2">
          <div className="space-y-6">
            <div>
              <h1 className="text-4xl font-bold text-slate-900">Welcome back</h1>
              <p className="mt-2 text-lg text-slate-500">Enter your credentials to continue</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Username
                </label>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Enter your username"
                />
              </div>
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  Password
                </label>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Enter your password"
                />
              </div>
              {error && (
                <div className="flex items-center gap-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 border border-rose-200">
                  <svg className="h-5 w-5 text-rose-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}
              <button 
                disabled={loading} 
                className="group relative w-full overflow-hidden rounded-2xl bg-primary px-6 py-4 text-sm font-semibold text-white transition-all hover:bg-emerald-700 hover:shadow-lg hover:shadow-primary/25 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      Signing in...
                    </>
                  ) : (
                    <>
                      <svg className="h-4 w-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      Sign In
                    </>
                  )}
                </span>
              </button>
              <div className="flex items-center justify-between text-sm">
                <Link to="#" className="text-slate-500 hover:text-primary transition-colors">Forgot password?</Link>
                <Link to="/register" className="font-semibold text-primary hover:text-emerald-700 transition-colors flex items-center gap-1">
                  Create account
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SignInPage;
