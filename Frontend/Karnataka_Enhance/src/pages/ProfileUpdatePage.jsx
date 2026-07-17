import { useEffect, useState } from 'react';
import { getStoredUser, updateUserProfile } from '../utils/auth';
import { useNavigate } from 'react-router-dom';
import { validateProfile } from '../utils/validation';
import { districts, taluks } from '../data/locations';

function ProfileUpdatePage({ showToast }) {
  const navigate = useNavigate();
  const storedUser = getStoredUser();
  const [form, setForm] = useState(storedUser?.profile || {});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!storedUser) {
      navigate('/signin');
    }
  }, [storedUser]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const { errors: validationErrors } = validateProfile(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;
    setLoading(true);
    try {
      await updateUserProfile(form);
      showToast('Profile updated successfully');
      navigate('/profile/edit');
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Unable to update profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 animate-fade-in">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <svg className="h-8 w-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <p className="text-sm uppercase tracking-wider text-primary font-semibold">Profile Update</p>
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-2">Update Your Details</h1>
          <p className="text-lg text-slate-600">Edit your profile and recalculate recommendations whenever your situation changes.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Personal Information Section */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <div className="flex items-center gap-3 mb-6">
              <svg className="h-6 w-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <h2 className="text-xl font-bold text-slate-900">Personal Information</h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <FormField 
                label="Full Name" 
                value={form.name || ''} 
                onChange={(value) => handleChange('name', value)} 
                error={errors.name}
                icon="user"
              />
              <FormField 
                label="Age" 
                type="number" 
                value={form.age || ''} 
                onChange={(value) => handleChange('age', value)} 
                error={errors.age}
                icon="calendar"
              />
              <SelectField 
                label="Gender" 
                value={form.gender || ''} 
                options={['Male', 'Female', 'Other']} 
                onChange={(value) => handleChange('gender', value)} 
                error={errors.gender}
                icon="users"
              />
            </div>
          </div>

          {/* Location Information Section */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <div className="flex items-center gap-3 mb-6">
              <svg className="h-6 w-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <h2 className="text-xl font-bold text-slate-900">Location Information</h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <SelectField 
                label="District" 
                value={form.district || ''} 
                options={districts} 
                onChange={(value) => handleChange('district', value)} 
                error={errors.district}
                icon="map"
              />
              <SelectField 
                label="Taluk" 
                value={form.taluk || ''} 
                options={taluks} 
                onChange={(value) => handleChange('taluk', value)} 
                error={errors.taluk}
                icon="map-pin"
              />
              <FormField 
                label="Pincode" 
                type="text" 
                value={form.pincode || ''} 
                onChange={(value) => handleChange('pincode', value)}
                icon="home"
              />
            </div>
          </div>

          {/* Socio-Economic Information Section */}
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <div className="flex items-center gap-3 mb-6">
              <svg className="h-6 w-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              <h2 className="text-xl font-bold text-slate-900">Socio-Economic Information</h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              <SelectField 
                label="Annual Income" 
                value={form.income || ''} 
                options={['₹0 - ₹1 Lakh', '₹1 - ₹2.5 Lakh', '₹2.5 - ₹5 Lakh', '₹5 - ₹8 Lakh', '₹8 - ₹10 Lakh', '₹10 Lakh and Above']} 
                onChange={(value) => handleChange('income', value)} 
                error={errors.income}
                icon="dollar-sign"
              />
              <SelectField 
                label="Ration Card" 
                value={form.rationCard || ''} 
                options={['BPL', 'APL', 'None']} 
                onChange={(value) => handleChange('rationCard', value)} 
                error={errors.rationCard}
                icon="credit-card"
              />
              <SelectField 
                label="Caste Category" 
                value={form.casteCategory || ''} 
                options={['General', 'SC', 'ST', 'OBC', 'Other']} 
                onChange={(value) => handleChange('casteCategory', value)} 
                error={errors.casteCategory}
                icon="users"
              />
              <SelectField 
                label="Qualification" 
                value={form.qualification || ''} 
                options={['10th Pass (SSC)', '12th Pass (HSC)', 'Diploma', "Bachelor's Degree", "Master's Degree", 'PhD', 'Other']} 
                onChange={(value) => handleChange('qualification', value)} 
                error={errors.qualification}
                icon="graduation-cap"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end pt-6 border-t border-slate-200">
            <button 
              type="submit" 
              disabled={loading} 
              className="group flex items-center gap-3 rounded-2xl bg-gradient-to-r from-primary to-emerald-600 px-8 py-4 text-white font-semibold transition-all hover:shadow-lg hover:shadow-primary/25 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {loading ? (
                <>
                  <svg className="h-5 w-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="h-5 w-5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Save Profile
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormField({ label, type = 'text', value, onChange, error, icon }) {
  const getIcon = (iconName) => {
    switch (iconName) {
      case 'user':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />;
      case 'calendar':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />;
      case 'home':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />;
      default:
        return null;
    }
  };

  return (
    <label className="space-y-2 text-sm text-slate-700">
      <span className="flex items-center gap-2">
        {icon && (
          <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {getIcon(icon)}
          </svg>
        )}
        {label}
      </span>
      <input
        value={value}
        type={type}
        onChange={(event) => onChange(event.target.value)}
        placeholder={`Enter your ${label.toLowerCase()}`}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
      {error && (
        <div className="flex items-center gap-2 text-sm text-rose-600">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}
    </label>
  );
}

function SelectField({ label, value, options, onChange, error, icon }) {
  const getIcon = (iconName) => {
    switch (iconName) {
      case 'users':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />;
      case 'map':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />;
      case 'map-pin':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" />;
      case 'dollar-sign':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />;
      case 'credit-card':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />;
      case 'graduation-cap':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />;
      default:
        return null;
    }
  };

  return (
    <label className="space-y-2 text-sm text-slate-700">
      <span className="flex items-center gap-2">
        {icon && (
          <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {getIcon(icon)}
          </svg>
        )}
        {label}
      </span>
      <select 
        value={value} 
        onChange={(event) => onChange(event.target.value)} 
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      >
        <option value="">{value ? `Current: ${value}` : `Select your ${label.toLowerCase()}`}</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
      {error && (
        <div className="flex items-center gap-2 text-sm text-rose-600">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}
    </label>
  );
}

export default ProfileUpdatePage;
