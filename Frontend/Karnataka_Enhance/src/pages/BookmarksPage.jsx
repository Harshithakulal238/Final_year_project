import { useMemo } from 'react';
import schemes from '../data/schemes';
import SchemeCard from '../components/SchemeCard';
import { getBookmarkedSchemes } from '../utils/bookmarks';

function BookmarksPage({ showToast }) {
  const bookmarkedSchemes = useMemo(() => {
    const bookmarkedIds = getBookmarkedSchemes();
    return schemes.filter(scheme => bookmarkedIds.includes(scheme.id));
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 animate-fade-in">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <svg className="h-8 w-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
            <p className="text-sm uppercase tracking-wider text-primary font-semibold">Bookmarks</p>
          </div>
          <h1 className="text-4xl font-bold text-slate-900">Saved scheme cards</h1>
          <p className="mt-2 text-lg text-slate-500">Your bookmarked schemes are available for review and quick action.</p>
        </div>
        {bookmarkedSchemes.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-gradient-to-br from-slate-50 to-slate-100 p-16 text-center">
            <div className="mb-4">
              <svg className="h-16 w-16 text-slate-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-slate-600 mb-2">No bookmarks yet</h3>
            <p className="text-slate-500">Browse the dashboard to save schemes you want to track.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {bookmarkedSchemes.map((scheme) => (
              <SchemeCard key={scheme.id} scheme={scheme} showToast={showToast} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default BookmarksPage;
