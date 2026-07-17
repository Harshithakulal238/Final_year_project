import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { isBookmarked, toggleBookmark } from '../utils/bookmarks';

function SchemeCard({ scheme, showToast }) {
  const [bookmarked, setBookmarked] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    setBookmarked(isBookmarked(scheme.id));
  }, [scheme.id]);

  const handleBookmarkToggle = () => {
    const newState = toggleBookmark(scheme.id);
    setBookmarked(newState);
    if (showToast) {
      showToast(
        newState ? 'Scheme bookmarked successfully!' : 'Bookmark removed',
        'success'
      );
    }
  };

  const getMatchColor = (score) => {
    if (score >= 80) return 'text-emerald-600 bg-emerald-50';
    if (score >= 60) return 'text-amber-600 bg-amber-50';
    return 'text-slate-600 bg-slate-50';
  };

  return (
    <article 
      className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl hover:shadow-primary/10"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background gradient on hover */}
      <div className={`absolute inset-0 bg-gradient-to-br from-primary/5 to-emerald-50 opacity-0 transition-opacity duration-300 ${isHovered ? 'opacity-100' : ''}`}></div>

      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                {scheme.category}
              </span>
              <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getMatchColor(scheme.matchScore)}`}>
                {scheme.matchScore}% Match
              </span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 group-hover:text-primary transition-colors">
              {scheme.name}
            </h3>
          </div>
          <button 
            onClick={handleBookmarkToggle} 
            className={`rounded-full border-2 p-3 transition-all duration-200 ${
              bookmarked 
                ? 'border-amber-400 bg-amber-50 text-amber-600 shadow-md' 
                : 'border-slate-300 text-slate-400 hover:border-primary hover:text-primary hover:shadow-md'
            }`}
          >
            <svg className="h-5 w-5" fill={bookmarked ? 'currentColor' : 'none'} stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
        </div>

        <p className="text-slate-600 mb-4 leading-relaxed">{scheme.description}</p>

        <div className="space-y-3 mb-6">
          <div className="flex items-start gap-2">
            <svg className="h-5 w-5 text-emerald-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <span className="font-semibold text-slate-900">Benefits: </span>
              <span className="text-slate-600">{scheme.benefits}</span>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <svg className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <span className="font-semibold text-slate-900">Why eligible: </span>
              <span className="text-slate-600">{scheme.whyEligible}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link 
            to={`/scheme/${scheme.id}`} 
            className="group/btn flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-primary hover:shadow-lg hover:shadow-primary/25"
          >
            <svg className="h-4 w-4 transition-transform group-hover/btn:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            Learn More
          </Link>
          <button className="group/btn flex items-center gap-2 rounded-full border-2 border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 transition-all hover:border-primary hover:text-primary hover:shadow-md">
            <svg className="h-4 w-4 transition-transform group-hover/btn:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Apply
          </button>
        </div>
      </div>

      {/* Decorative element */}
      <div className="absolute top-4 right-4 h-20 w-20 rounded-full bg-gradient-to-br from-primary/10 to-emerald-100/50 opacity-0 transition-opacity duration-300 group-hover:opacity-100"></div>
    </article>
  );
}

export default SchemeCard;
