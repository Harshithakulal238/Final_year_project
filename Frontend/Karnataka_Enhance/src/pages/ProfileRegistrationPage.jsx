import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { updateUserProfile } from '../utils/auth';
import { validateProfile } from '../utils/validation';
import ProgressBar from '../components/ProgressBar';
import { districts, karnatakaCities, taluks } from '../data/locations';

const initialForm = {
  name: '',
  age: '',
  gender: '',
  district: '',
  taluk: '',
  city: '',
  pincode: '',
  locationType: '',
  income: '',
  rationCard: '',
  casteCategory: '',
  studentStatus: '',
  qualification: '',
  employmentType: '',
  specialConditions: [],
  minorityCommunity: false,
  farmerWithLand: false,
  girlChildInFamily: false,
  marriageType: '',
  selfEmploymentInterest: false,
  skillTrainingInterest: false,
  higherEducationInterest: false,
  foreignEducationInterest: false,
  aadhaar: null,
  incomeCertificate: null,
  casteCertificate: null,
  rationCardUpload: null,
};

const steps = ['Basic Details', 'Socio-Economic', 'Education', 'Employment & Special'];

function ProfileRegistrationPage({ showToast, setLoading }) {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [warnings, setWarnings] = useState({});


  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const toggleCondition = (condition) => {
    setForm((prev) => {
      const list = prev.specialConditions.includes(condition)
        ? prev.specialConditions.filter((item) => item !== condition)
        : [...prev.specialConditions, condition];
      return { ...prev, specialConditions: list };
    });
  };

  const nextStep = () => {
    const { errors: validationErrors, warnings: validationWarnings } = validateProfile(form, step);
    setErrors(validationErrors);
    setWarnings(validationWarnings);
    if (Object.keys(validationErrors).length > 0) return;
    setStep((prev) => Math.min(prev + 1, steps.length));
  };

  const prevStep = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const { errors: validationErrors, warnings: validationWarnings } = validateProfile(form);
    setErrors(validationErrors);
    setWarnings(validationWarnings);
    if (Object.keys(validationErrors).length > 0) return;
    setLoading(true);
    try {
      await updateUserProfile(form);
      showToast('Profile registered successfully');
      navigate('/dashboard');
    } catch (err) {
      showToast(err.response?.data?.message || err.message || 'Unable to save profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 animate-fade-in">
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl">
        <div className="mb-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <svg className="h-8 w-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <p className="text-sm uppercase tracking-wider text-primary font-semibold">Profile Registration</p>
            </div>
            <h1 className="text-4xl font-bold text-slate-900 mb-2">Complete your profile</h1>
            <p className="text-lg text-slate-600">Fill in your details to unlock personalized government scheme recommendations</p>
          </div>
          <div className="flex items-center justify-center">
            <ProgressBar step={step} total={steps.length} />
          </div>
        </div>

        {/* Step Indicators */}
        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((title, index) => (
            <div key={title} className={`group relative overflow-hidden rounded-2xl border-2 p-4 text-sm transition-all ${
              step === index + 1 
                ? 'border-primary bg-primary/5 shadow-lg shadow-primary/10' 
                : step > index + 1
                  ? 'border-emerald-500 bg-emerald-50'
                  : 'border-slate-200 bg-slate-50 hover:border-slate-300'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all ${
                  step === index + 1 
                    ? 'bg-primary text-white' 
                    : step > index + 1
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-300 text-slate-600 group-hover:bg-slate-400'
                }`}>
                  {step > index + 1 ? (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    index + 1
                  )}
                </div>
                <div>
                  <div className={`font-semibold ${step === index + 1 ? 'text-primary' : step > index + 1 ? 'text-emerald-700' : 'text-slate-700'}`}>
                    Step {index + 1}
                  </div>
                  <div className={`text-xs ${step === index + 1 ? 'text-primary/70' : 'text-slate-500'}`}>
                    {title}
                  </div>
                </div>
              </div>
              {step === index + 1 && (
                <div className="absolute inset-0 bg-gradient-to-r from-primary/5 to-transparent opacity-50"></div>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {step === 1 && (
            <section className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Basic Information</h2>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <FormField label="Full Name" value={form.name} onChange={(value) => updateField('name', value)} error={errors.name} icon="user" />
                <FormField label="Age" type="number" value={form.age} onChange={(value) => updateField('age', value)} error={errors.age} icon="calendar" />
                <SelectField label="Gender" value={form.gender} options={['Male', 'Female', 'Other']} onChange={(value) => updateField('gender', value)} error={errors.gender} icon="users" />
                <SelectField label="District" value={form.district} options={districts} onChange={(value) => updateField('district', value)} error={errors.district} icon="map" />
                <SearchableSelectField label="Taluk" value={form.taluk} options={taluks} onChange={(value) => updateField('taluk', value)} error={errors.taluk} icon="map-pin" />
                <FormField label="Village / City" value={form.city} onChange={(value) => updateField('city', value)} icon="home" />
                <FormField label="Pincode" type="text" value={form.pincode} onChange={(value) => updateField('pincode', value)} icon="hash" />
                <SelectField label="Urban / Rural" value={form.locationType} options={['Urban', 'Rural']} onChange={(value) => updateField('locationType', value)} error={errors.locationType} icon="building" />
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Socio-Economic Details</h2>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <SelectField label="Annual Income" value={form.income} options={['₹0 - ₹1 Lakh', '₹1 - ₹2.5 Lakh', '₹2.5 - ₹5 Lakh', '₹5 - ₹8 Lakh', '₹8 - ₹10 Lakh', '₹10 Lakh and Above']} onChange={(value) => updateField('income', value)} error={errors.income} icon="dollar-sign" />
                <SelectField label="Ration Card" value={form.rationCard} options={['BPL', 'APL', 'None']} onChange={(value) => updateField('rationCard', value)} error={errors.rationCard} icon="credit-card" />
                <SelectField label="Caste Category" value={form.casteCategory} options={['General', 'SC', 'ST', 'OBC', 'Other']} onChange={(value) => updateField('casteCategory', value)} error={errors.casteCategory} icon="users" />
              </div>
              {warnings.rationCard && <WarningBox message={warnings.rationCard} />}
            </section>
          )}

          {step === 3 && (
            <section className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Education Details</h2>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <SelectField label="Student Status" value={form.studentStatus} options={['Yes', 'No']} onChange={(value) => updateField('studentStatus', value)} error={errors.studentStatus} icon="graduation-cap" />
                <SelectField label="Qualification" value={form.qualification} options={['10th Pass (SSC)', '12th Pass (HSC)', 'Diploma', "Bachelor's Degree", "Master's Degree", 'PhD', 'Other']} onChange={(value) => updateField('qualification', value)} error={errors.qualification} icon="book" />
              </div>
            </section>
          )}

          {step === 4 && (
            <section className="space-y-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m8 0V8a2 2 0 01-2 2H8a2 2 0 01-2-2V6m8 0H8m0 0V4" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Employment & Special Conditions</h2>
              </div>
              <div className="grid gap-6 md:grid-cols-2">
                <SelectField label="Employment Type" value={form.employmentType} options={['Unemployed', 'Private', 'Government', 'Self-Employed', 'Agriculture']} onChange={(value) => updateField('employmentType', value)} error={errors.employmentType} icon="briefcase" />
                <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-6">
                  <div className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <h3 className="text-lg font-semibold text-slate-900">Special Conditions</h3>
                  </div>
                  <div className="grid gap-3">
                    {['Pregnant', 'Lactating Mother', 'Widow', 'Disabled', 'Married/Newly Married'].map((option) => (
                      <label key={option} className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm transition-all hover:border-primary hover:shadow-sm cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={form.specialConditions.includes(option)} 
                          onChange={() => toggleCondition(option)}
                          className="h-4 w-4 text-primary border-slate-300 rounded focus:ring-primary"
                        />
                        <span className="group-hover:text-primary transition-colors">{option}</span>
                      </label>
                    ))}
                  </div>
                  {errors.specialConditions && <div className="text-sm text-rose-600 mt-2">{errors.specialConditions}</div>}
                </div>
              </div>
            </section>
          )}

          {/* Navigation Buttons */}
          <div className="flex flex-col gap-4 sm:flex-row sm:justify-between pt-8 border-t border-slate-200">
            <button 
              type="button" 
              onClick={prevStep} 
              disabled={step === 1} 
              className="group flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-6 py-4 text-sm font-semibold text-slate-700 transition-all hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-slate-200 disabled:hover:text-slate-700"
            >
              <svg className="h-4 w-4 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Previous
            </button>
            
            {step < steps.length ? (
              <button 
                type="button" 
                onClick={nextStep} 
                className="group flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-4 text-sm font-semibold text-white transition-all hover:bg-emerald-700 hover:shadow-lg hover:shadow-primary/25"
              >
                Next
                <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <button 
                type="submit" 
                className="group flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-emerald-600 px-8 py-4 text-sm font-semibold text-white transition-all hover:shadow-lg hover:shadow-primary/25"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Complete Profile
              </button>
            )}
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
      case 'hash':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />;
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
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
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

function SelectField({ label, options, value, onChange, error, icon }) {
  const getIcon = (iconName) => {
    switch (iconName) {
      case 'users':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />;
      case 'map':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />;
      case 'map-pin':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" />;
      case 'building':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />;
      case 'dollar-sign':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />;
      case 'credit-card':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />;
      case 'graduation-cap':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z M12 14l9-5-9-5-9 5 9 5z M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />;
      case 'book':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />;
      case 'briefcase':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m8 0V8a2 2 0 01-2 2H8a2 2 0 01-2-2V6m8 0H8m0 0V4" />;
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
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      >
        <option value="">Select {label.toLowerCase()}</option>
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

function SearchableSelectField({ label, options, value, onChange, error, icon }) {
  const listId = `${label.replace(/\s+/g, '-').toLowerCase()}-list`;

  const getIcon = (iconName) => {
    switch (iconName) {
      case 'map-pin':
        return <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z" />;
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
        type="text"
        value={value}
        list={listId}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
        placeholder={`Type or select ${label.toLowerCase()}`}
      />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
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

function CheckboxField({ label, checked, onChange }) {
  return (
    <label className="inline-flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm hover:border-primary">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function FileField({ label, onChange }) {
  return (
    <label className="space-y-2 text-sm text-slate-700">
      <span>{label}</span>
      <input type="file" onChange={(event) => onChange(event.target.files[0] || null)} className="w-full text-sm text-slate-600" />
    </label>
  );
}

function WarningBox({ message }) {
  return <div className="rounded-3xl bg-amber-50 p-4 text-sm text-amber-800">{message}</div>;
}

export default ProfileRegistrationPage;
