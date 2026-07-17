import { useMemo, useState } from 'react';
import schemes from '../data/schemes';
import SchemeCard from '../components/SchemeCard';
import Sidebar from '../components/Sidebar';
import FilterPanel from '../components/FilterPanel';
import { getStoredUser } from '../utils/auth';

function DashboardPage({ showToast }) {
  const user = useMemo(() => getStoredUser(), []);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ category: '', gender: '', income: '', occupation: '', special: '' });

  const filteredSchemes = schemes.filter((scheme) => {
    const matchesQuery = query ? scheme.name.toLowerCase().includes(query.toLowerCase()) || scheme.description.toLowerCase().includes(query.toLowerCase()) : true;
    const matchesCategory = filters.category ? scheme.category === filters.category : true;
    const matchesSpecial = filters.special ? scheme.tags.includes(filters.special.toLowerCase()) : true;
    return matchesQuery && matchesCategory && matchesSpecial;
  });

  const topRecommended = filteredSchemes.filter((scheme) => scheme.matchScore >= 80);
  const eligibleSchemes = filteredSchemes.filter((scheme) => scheme.matchScore >= 60 && scheme.matchScore < 80);

  return (
    <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 lg:grid-cols-[280px_1fr]">
      <Sidebar />
      <div className="space-y-8">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-primary">Dashboard</p>
              <h1 className="mt-2 text-3xl font-semibold text-slate-900">Your recommended schemes</h1>
              <p className="text-sm text-slate-500">Ready for you, {user?.name || 'applicant'}. Use search and filters to refine suggested programmes.</p>
            </div>
            <div className="rounded-3xl bg-slate-100 px-5 py-4 text-sm text-slate-700">
              Matched schemes: {filteredSchemes.length}
            </div>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-2">
            <DashboardStat 
              label="Top Recommended" 
              value={topRecommended.length} 
              color="emerald"
              icon={
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              }
            />
            <DashboardStat 
              label="Eligible" 
              value={eligibleSchemes.length} 
              color="amber"
              icon={
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              }
            />
          </div>
        </section>
        <section className="grid gap-6 xl:grid-cols-[320px_1fr]">
          <FilterPanel filters={filters} setFilters={setFilters} query={query} setQuery={setQuery} />
          <div className="space-y-8">
            <SchemeSection title="Top Recommended Schemes" schemes={topRecommended} showToast={showToast} />
            <SchemeSection title="Eligible Schemes" schemes={eligibleSchemes} showToast={showToast} />
          </div>
        </section>
      </div>
    </div>
  );
}

function DashboardStat({ label, value, icon, color = 'primary' }) {
  const colorClasses = {
    primary: 'bg-primary/10 text-primary',
    emerald: 'bg-emerald-100 text-emerald-600',
    amber: 'bg-amber-100 text-amber-600',
    slate: 'bg-slate-100 text-slate-600'
  };

  return (
    <div className="group relative overflow-hidden rounded-3xl bg-white p-6 shadow-sm border border-slate-200 transition-all hover:shadow-lg hover:-translate-y-1">
      <div className={`absolute top-4 right-4 rounded-full p-3 ${colorClasses[color]} opacity-20 group-hover:opacity-30 transition-opacity`}></div>
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-2">
          <div className={`rounded-full p-2 ${colorClasses[color]}`}>
            {icon}
          </div>
          <div className="text-sm font-semibold uppercase tracking-wider text-slate-500">{label}</div>
        </div>
        <div className="text-4xl font-bold text-slate-900">{value}</div>
      </div>
    </div>
  );
}

function SchemeSection({ title, schemes, emptyMessage }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
      {schemes.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-slate-500">
          {emptyMessage || 'No schemes found for this section. Adjust filters or search terms.'}
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {schemes.map((scheme) => (
            <SchemeCard key={scheme.id} scheme={scheme} />
          ))}
        </div>
      )}
    </div>
  );
}

export default DashboardPage;
