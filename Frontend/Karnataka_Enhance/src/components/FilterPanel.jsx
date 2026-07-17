function FilterPanel({ filters, setFilters, query, setQuery }) {
  const categoryOptions = ['Health', 'Nutrition', 'Education', 'Agriculture', 'Women Empowerment'];
  const yesNo = ['yes', 'no'];

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="space-y-6">
        <div>
          <label className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Search
          </label>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search schemes..."
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Category
          </div>
          <div className="grid gap-2">
            {categoryOptions.map((category) => (
              <button
                key={category}
                onClick={() => updateFilter('category', category)}
                className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition-all ${
                  filters.category === category 
                    ? 'bg-primary text-white shadow-md' 
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:shadow-sm'
                }`}
              >
                <div className={`h-2 w-2 rounded-full transition-colors ${
                  filters.category === category ? 'bg-white' : 'bg-slate-400 group-hover:bg-slate-600'
                }`}></div>
                {category}
              </button>
            ))}
            <button
              onClick={() => updateFilter('category', '')}
              className="flex items-center gap-3 rounded-2xl bg-slate-100 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-200"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Clear category
            </button>
          </div>
        </div>
        <div className="grid gap-3">
          <FilterGroup label="Gender" value={filters.gender} onChange={(value) => updateFilter('gender', value)} options={['Male', 'Female', 'Other']} />
          <FilterGroup label="Income" value={filters.income} onChange={(value) => updateFilter('income', value)} options={['₹0 - ₹1 Lakh', '₹1 - ₹2.5 Lakh', '₹2.5 - ₹5 Lakh', '₹5 - ₹8 Lakh', '₹8 - ₹10 Lakh', '₹10 Lakh and Above']} />
          <FilterGroup label="Occupation" value={filters.occupation} onChange={(value) => updateFilter('occupation', value)} options={['Student', 'Farmer', 'Unemployed', 'Private', 'Government']} />
          <FilterGroup label="Special" value={filters.special} onChange={(value) => updateFilter('special', value)} options={['Widow', 'Disabled', 'Pregnant', 'Lactating']} />
        </div>
      </div>
    </aside>
  );
}

function FilterGroup({ label, options, value, onChange }) {
  const getIcon = (label) => {
    switch (label.toLowerCase()) {
      case 'gender':
        return (
          <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      case 'income':
        return (
          <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
          </svg>
        );
      case 'occupation':
        return (
          <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m8 0V8a2 2 0 01-2 2H8a2 2 0 01-2-2V6m8 0H8m0 0V4" />
          </svg>
        );
      case 'special':
        return (
          <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
        {getIcon(label)}
        {label}
      </div>
      <div className="grid gap-2">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition-all ${
              value === option 
                ? 'bg-primary text-white shadow-md' 
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 hover:shadow-sm'
            }`}
          >
            <div className={`h-2 w-2 rounded-full transition-colors ${
              value === option ? 'bg-white' : 'bg-slate-400 group-hover:bg-slate-600'
            }`}></div>
            {option}
          </button>
        ))}
        <button 
          onClick={() => onChange('')} 
          className="flex items-center gap-3 rounded-2xl bg-slate-100 px-4 py-3 text-left text-sm text-slate-700 hover:bg-slate-200"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Clear {label.toLowerCase()}
        </button>
      </div>
    </div>
  );
}

export default FilterPanel;
