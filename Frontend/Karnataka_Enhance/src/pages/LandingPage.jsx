import { Link } from 'react-router-dom';

function LandingPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-primary px-4 py-12 text-white">
      <div className="w-full max-w-6xl animate-fade-in">
        <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <span className="inline-flex animate-pulse rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-900 shadow-lg">
                <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                </svg>
                Government scheme intelligence
              </span>
              <h1 className="text-5xl font-bold leading-tight md:text-6xl lg:text-7xl">
                Karnataka Government{' '}
                <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  Scheme
                </span>{' '}
                Recommendation System
              </h1>
            </div>
            <p className="max-w-xl text-xl text-slate-100 leading-relaxed">
              Find personalized government schemes based on your profile. Connect to the right benefits with guided support and easy onboarding.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link to="/signin" className="group relative overflow-hidden rounded-full bg-white px-8 py-4 text-lg font-semibold text-slate-900 transition-all hover:shadow-2xl hover:shadow-white/25">
                <span className="relative z-10">Sign In</span>
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-cyan-400 opacity-0 transition-opacity group-hover:opacity-100"></div>
              </Link>
              <Link to="/register" className="group rounded-full border-2 border-white/40 bg-transparent px-8 py-4 text-lg font-semibold text-white transition-all hover:border-white hover:bg-white/10 hover:shadow-lg">
                <span className="flex items-center gap-2">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Register
                </span>
              </Link>
            </div>
          </div>
          <div className="relative">
            <div className="rounded-3xl bg-slate-950/80 p-8 shadow-2xl backdrop-blur-xl border border-white/10">
              <div className="grid gap-6">
                <div className="group rounded-3xl bg-gradient-to-br from-slate-900/90 to-slate-800/90 p-6 shadow-lg transition-all hover:shadow-xl hover:scale-105">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="rounded-full bg-emerald-500/20 p-2">
                      <svg className="h-6 w-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-white">Why this portal?</h2>
                  </div>
                  <ul className="space-y-3 text-slate-300">
                    <li className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-400"></div>
                      Personalized scheme matching
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-400"></div>
                      Secure profile-based recommendations
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-400"></div>
                      Easy registration with OTP validation
                    </li>
                  </ul>
                </div>
                <div className="group rounded-3xl bg-gradient-to-br from-slate-900/90 to-slate-800/90 p-6 shadow-lg transition-all hover:shadow-xl hover:scale-105">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="rounded-full bg-cyan-500/20 p-2">
                      <svg className="h-6 w-6 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h2 className="text-xl font-semibold text-white">Features</h2>
                  </div>
                  <ul className="space-y-3 text-slate-300">
                    <li className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-cyan-400"></div>
                      Search and filter schemes by eligibility
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-cyan-400"></div>
                      Track bookmarks and application details
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-cyan-400"></div>
                      Update profile for better recommendations
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            {/* Floating elements for visual interest */}
            <div className="absolute -top-4 -right-4 h-8 w-8 animate-bounce rounded-full bg-emerald-400/20"></div>
            <div className="absolute -bottom-6 -left-6 h-12 w-12 animate-pulse rounded-full bg-cyan-400/20"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;
