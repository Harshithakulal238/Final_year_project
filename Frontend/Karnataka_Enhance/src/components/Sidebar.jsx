import { Link, useLocation } from 'react-router-dom';

const links = [
  { 
    label: 'Top Recommendations', 
    path: '/dashboard',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
      </svg>
    )
  },
  { 
    label: 'Eligible Schemes', 
    path: '/dashboard',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  },
  { 
    label: 'Not Eligible', 
    path: '/dashboard',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    )
  },
  { 
    label: 'Profile', 
    path: '/profile/edit',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    )
  },
  { 
    label: 'Bookmarks', 
    path: '/bookmarks',
    icon: (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
      </svg>
    )
  },
];

function Sidebar() {
  const location = useLocation();

  return (
    <aside className="hidden w-72 shrink-0 space-y-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:block">
      <div className="text-sm font-bold uppercase tracking-wider text-slate-500">Navigation</div>
      <div className="space-y-2">
        {links.map((link) => (
          <Link
            key={link.label}
            to={link.path}
            className={`group flex items-center gap-4 rounded-2xl px-4 py-4 text-sm transition-all ${
              location.pathname === link.path 
                ? 'bg-primary text-white shadow-lg shadow-primary/25' 
                : 'text-slate-700 hover:bg-slate-100 hover:shadow-md'
            }`}
          >
            <div className={`transition-colors ${location.pathname === link.path ? 'text-white' : 'text-slate-500 group-hover:text-primary'}`}>
              {link.icon}
            </div>
            <span className="font-medium">{link.label}</span>
            {location.pathname === link.path && (
              <div className="ml-auto h-2 w-2 rounded-full bg-white"></div>
            )}
          </Link>
        ))}
      </div>
      <div className="rounded-3xl bg-gradient-to-br from-primary/10 to-emerald-50 p-5 text-sm text-slate-600 border border-primary/20">
        <div className="flex items-center gap-3 mb-3">
          <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-semibold text-slate-900">Pro Tip</span>
        </div>
        <p>Use filters and search to narrow schemes based on gender, occupation, and income for better recommendations.</p>
      </div>
    </aside>
  );
}

export default Sidebar;
