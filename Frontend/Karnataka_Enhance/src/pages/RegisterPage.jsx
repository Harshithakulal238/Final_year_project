import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { markOtpVerified, clearRegistration, registerUser } from '../utils/auth';
import { mockRequest } from '../utils/api';

const DUMMY_OTP = '123456';

function RegisterPage({ showToast }) {
  const [step, setStep] = useState(1);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { clearRegistration(); }, []);

  const goToStep = (newStep) => {
    if (step === 2 && newStep !== 2) {
      setOtp('');
      setInfo('');
    }
    if (newStep === 1) {
      setInfo('');
    }
    setError('');
    setStep(newStep);
  };

  const sendOtp = async (event) => {
    event.preventDefault();
    setError('');
    if (!/^[6-9]\d{9}$/.test(phoneNumber)) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }
    setLoading(true);
    await mockRequest({ otpSent: true });
    setLoading(false);
    setInfo('OTP has been sent to your mobile number. Use 123456 for verification.');
    setOtp('');
    goToStep(2);
  };

  const verifyOtp = async (event) => {
    event.preventDefault();
    setError('');
    if (!otp.trim()) {
      setError('Please enter the OTP');
      return;
    }
    setLoading(true);
    await mockRequest({ verified: true });
    setLoading(false);
    if (otp === DUMMY_OTP) {
      markOtpVerified();
      setOtp('');
      showToast('OTP verified successfully');
      goToStep(3);
    } else {
      setError('Invalid OTP. Please try again.');
    }
  };

  const register = async (event) => {
    event.preventDefault();
    setError('');
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await registerUser(phoneNumber, username, password);
      showToast('Registration successful! Please sign in.');
      navigate('/signin');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const getStepIcon = (stepNumber) => {
    const isCompleted = step > stepNumber;
    const isCurrent = step === stepNumber;
    
    return (
      <div className={`flex h-10 w-10 items-center justify-center rounded-full border-2 transition-all ${
        isCompleted 
          ? 'border-emerald-500 bg-emerald-500 text-white' 
          : isCurrent 
            ? 'border-primary bg-primary text-white' 
            : 'border-slate-300 bg-white text-slate-400'
      }`}>
        {isCompleted ? (
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          stepNumber
        )}
      </div>
    );
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-12 animate-fade-in">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl">
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-3">
              <svg className="h-8 w-8 text-primary" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <p className="text-sm uppercase tracking-wider text-primary font-semibold">Create Account</p>
            </div>
            <h1 className="text-3xl font-bold text-slate-900">Join Karnataka Scheme Portal</h1>
            <p className="text-slate-500">Complete your registration in 3 simple steps</p>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col items-center space-y-2">
              {getStepIcon(1)}
              <span className="text-xs font-medium text-slate-600">Phone</span>
            </div>
            <div className={`flex-1 h-0.5 mx-4 ${step > 1 ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
            <div className="flex flex-col items-center space-y-2">
              {getStepIcon(2)}
              <span className="text-xs font-medium text-slate-600">Verify</span>
            </div>
            <div className={`flex-1 h-0.5 mx-4 ${step > 2 ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
            <div className="flex flex-col items-center space-y-2">
              {getStepIcon(3)}
              <span className="text-xs font-medium text-slate-600">Account</span>
            </div>
          </div>

          {/* Step Description */}
          <div className="rounded-2xl bg-gradient-to-r from-primary/5 to-emerald-50 p-6 border border-primary/10">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="font-semibold text-slate-900 mb-1">
                  {step === 1 ? 'Enter Phone Number' : step === 2 ? 'Verify OTP' : 'Create Account'}
                </h3>
                <p className="text-sm text-slate-600">
                  {step === 1 
                    ? 'Enter your mobile number to receive a verification code' 
                    : step === 2 
                      ? 'Enter the 6-digit OTP sent to your phone (use 123456)' 
                      : 'Set your username and password to complete registration'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={step === 1 ? sendOtp : step === 2 ? verifyOtp : register} className="space-y-6">
            {step === 1 ? (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Mobile Number
                </label>
                <input
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Enter 10-digit mobile number"
                  maxLength={10}
                />
              </div>
            ) : step === 2 ? (
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  OTP Code
                </label>
                <input
                  value={otp}
                  onChange={(event) => setOtp(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 text-center text-lg font-mono tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                />
                <p className="text-xs text-slate-500 text-center">Enter the 6-digit code sent to your phone</p>
              </div>
            ) : (
              <div className="space-y-4">
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
                    placeholder="Choose a username"
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
                    placeholder="Create a secure password"
                  />
                  <p className="text-xs text-slate-500">Must be at least 6 characters long</p>
                </div>
              </div>
            )}

            {/* Error/Success Messages */}
            {error && (
              <div className="flex items-center gap-3 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 border border-rose-200">
                <svg className="h-5 w-5 text-rose-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}
            {info && (
              <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700 border border-emerald-200">
                <svg className="h-5 w-5 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {info}
              </div>
            )}

            {/* Action Buttons */}
            <div className="space-y-3">
              <button 
                type="submit" 
                disabled={loading} 
                className="group relative w-full overflow-hidden rounded-2xl bg-primary px-6 py-4 text-sm font-semibold text-white transition-all hover:bg-emerald-700 hover:shadow-lg hover:shadow-primary/25 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  {loading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      {step === 1 ? 'Send OTP' : step === 2 ? 'Verify OTP' : 'Create Account'}
                      <svg className="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </span>
              </button>
              
              {step > 1 && (
                <button 
                  type="button" 
                  onClick={() => goToStep(step - 1)} 
                  className="w-full rounded-2xl border-2 border-slate-200 bg-white px-6 py-4 text-sm font-semibold text-slate-700 transition-all hover:border-primary hover:text-primary hover:shadow-md"
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    {step === 2 ? 'Change Phone Number' : 'Back'}
                  </span>
                </button>
              )}
            </div>
          </form>

          {/* Footer */}
          <div className="text-center">
            <p className="text-sm text-slate-500">
              Already have an account?{' '}
              <a href="/signin" className="font-semibold text-primary hover:text-emerald-700 transition-colors">
                Sign in here
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default RegisterPage;
