import { useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import schemes from '../data/schemes';

function SchemeDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const scheme = useMemo(() => schemes.find((item) => item.id === id), [id]);

  if (!scheme) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-10 animate-fade-in">
        <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-2xl">
          <div className="mb-6">
            <svg className="h-16 w-16 text-slate-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.29-.98-5.5-2.5m.5-4C6.5 9 9 7 12 7s5.5 2 5.5 4.5M12 12v3m0 0l-2-2m2 2l2-2" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Scheme not found</h1>
          <p className="text-slate-600 mb-6">Please return to the dashboard and select a valid recommendation card.</p>
          <button 
            onClick={() => navigate('/dashboard')} 
            className="group flex items-center justify-center gap-2 w-full rounded-2xl bg-primary px-6 py-4 text-white font-semibold transition-all hover:bg-emerald-700 hover:shadow-lg hover:shadow-primary/25"
          >
            <svg className="h-5 w-5 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const getMatchColor = (score) => {
    if (score >= 80) return { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: 'text-emerald-600' };
    if (score >= 60) return { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: 'text-amber-600' };
    return { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-700', icon: 'text-slate-600' };
  };

  const matchStyle = getMatchColor(scheme.matchScore);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 animate-fade-in">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-4">
                <svg className="h-8 w-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm uppercase tracking-wider text-primary font-semibold">Scheme Details</p>
              </div>
              <h1 className="text-4xl font-bold text-slate-900 mb-3">{scheme.name}</h1>
              <p className="text-lg text-slate-600 leading-relaxed">{scheme.description}</p>
            </div>
            <div className={`rounded-2xl border-2 ${matchStyle.bg} ${matchStyle.text} p-6 text-center min-w-[200px]`}>
              <div className={`inline-flex h-12 w-12 items-center justify-center rounded-full ${matchStyle.bg} mb-3`}>
                <svg className={`h-6 w-6 ${matchStyle.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="text-3xl font-bold mb-1">{scheme.matchScore}%</div>
              <div className="text-sm font-medium">Match Score</div>
            </div>
          </div>
        </div>

        {/* Info Cards Grid */}
        <div className="mb-8 grid gap-6 md:grid-cols-2">
          <InfoCard 
            label="Category" 
            value={scheme.category} 
            icon={
              <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            }
          />
          <InfoCard 
            label="Eligibility Summary" 
            value={scheme.eligibilitySummary}
            icon={
              <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <InfoCard 
            label="Why Eligible" 
            value={scheme.whyEligible}
            icon={
              <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
          />
          <InfoCard 
            label="Official Link" 
            value={
              <a 
                href={scheme.officialLink} 
                target="_blank" 
                rel="noreferrer" 
                className="group inline-flex items-center gap-2 text-primary hover:text-emerald-700 font-semibold transition-colors"
              >
                Visit official website
                <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            }
            icon={
              <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
            }
          />
        </div>

        {/* Content Sections */}
        <div className="space-y-8">
          <Section 
            title="Full Description" 
            content={scheme.fullDescription}
            icon={
              <svg className="h-6 w-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
          />
          <Section 
            title="Benefits" 
            content={scheme.benefits}
            icon={
              <svg className="h-6 w-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
              </svg>
            }
          />
          
          {/* Required Documents */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <div className="flex items-center gap-3 mb-4">
              <svg className="h-6 w-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-xl font-bold text-slate-900">Required Documents</h3>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {scheme.requiredDocuments.map((item, index) => (
                <div key={index} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-primary hover:shadow-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                    <svg className="h-4 w-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="text-sm text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-end">
          <button 
            onClick={() => navigate('/dashboard')} 
            className="group flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-6 py-4 text-sm font-semibold text-slate-700 transition-all hover:border-primary hover:text-primary hover:shadow-md"
          >
            <svg className="h-5 w-5 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Dashboard
          </button>
          <a 
            href={scheme.officialLink} 
            target="_blank" 
            rel="noreferrer" 
            className="group flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-emerald-600 px-8 py-4 text-sm font-semibold text-white transition-all hover:shadow-lg hover:shadow-primary/25"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Apply Now
          </a>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value, icon }) {
  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:border-primary hover:shadow-lg hover:shadow-primary/10">
      <div className="flex items-center gap-3 mb-3">
        {icon}
        <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">{label}</p>
      </div>
      <div className="text-slate-800 leading-relaxed">{value}</div>
    </div>
  );
}

function Section({ title, content, icon }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
      <div className="flex items-center gap-3 mb-4">
        {icon}
        <h3 className="text-2xl font-bold text-slate-900">{title}</h3>
      </div>
      <p className="text-slate-600 leading-relaxed text-lg">{content}</p>
    </div>
  );
}

export default SchemeDetailPage;
