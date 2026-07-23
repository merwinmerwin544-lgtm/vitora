import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Mail, Lock, User, ShieldAlert, ChevronRight, Loader2 } from 'lucide-react';

const Login: React.FC = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  
  // Loading indicators for each provider button
  const [authLoading, setAuthLoading] = useState<'GOOGLE' | 'GITHUB' | 'APPLE' | 'EMAIL' | null>(null);

  const { loginWithProvider, registerWithEmail } = useAuth();
  const navigate = useNavigate();

  const handleOAuthLogin = async (provider: 'GOOGLE' | 'GITHUB' | 'APPLE') => {
    setError(null);
    setAuthLoading(provider);
    try {
      await loginWithProvider(provider);
      navigate('/');
    } catch (err: any) {
      console.error(err);
      // Silently return if user closed the OAuth window
      if (
        err.code === 'auth/popup-closed-by-user' || 
        err.message?.includes('popup closed') || 
        err.message?.includes('cancelled by user')
      ) {
        console.log('OAuth popup closed by user. Returning to login page.');
        return;
      }
      setError(`${provider.charAt(0) + provider.slice(1).toLowerCase()} authentication failed. Please try again.`);
    } finally {
      setAuthLoading(null);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Step 1: Validate Email Format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email.trim() || !emailRegex.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    // Step 2: Validate Password Length
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setAuthLoading('EMAIL');

    try {
      if (isRegister) {
        if (!name.trim()) throw new Error('Full Name is required');
        await registerWithEmail(email, password, name);
      } else {
        await loginWithProvider('EMAIL', email, password);
      }
      navigate('/');
    } catch (err: any) {
      console.error(err);
      
      // User-friendly error message mapping
      let friendlyError = 'Email authentication failed. Please verify credentials.';
      if (err.response) {
        const backendError = err.response.data?.error || '';
        if (backendError.includes('expired') || backendError.includes('Invalid') || backendError.includes('unverified')) {
          friendlyError = 'Invalid, expired, or unverified authorization token.';
        } else {
          friendlyError = backendError;
        }
      } else if (err.request) {
        friendlyError = 'Network error occurred. Please check your network and retry.';
      } else {
        friendlyError = err.message || friendlyError;
      }
      setError(friendlyError);
    } finally {
      setAuthLoading(null);
    }
  };

  // SVG Brand Logos
  const GoogleLogo = () => (
    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
    </svg>
  );

  const GithubLogo = () => (
    <svg className="w-4 h-4 mr-2 fill-current" viewBox="0 0 24 24">
      <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/>
    </svg>
  );

  const AppleLogo = () => (
    <svg className="w-4 h-4 mr-2 fill-current" viewBox="0 0 24 24">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.21.67-2.93 1.49-.62.69-1.16 1.84-1.01 2.96 1.12.09 2.27-.58 2.95-1.39z"/>
    </svg>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden bg-[#F5FFF7]">
      {/* Decorative Blur Spheres */}
      <div className="absolute top-10 left-10 w-80 h-80 bg-vitora-primary/5 rounded-full blur-[100px]" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-vitora-secondary/5 rounded-full blur-[100px]" />

      <motion.div
        initial={{ opacity: 0, y: 35 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className="w-full max-w-sm glass-panel p-8 rounded-[32px] shadow-2xl relative z-10 border-white/60 text-center"
      >
        {/* Logo and branding */}
        <div className="flex flex-col items-center mb-8">
          <motion.div
            animate={{ scale: [1, 1.04, 1] }}
            transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut' }}
            className="w-14 h-14 bg-gradient-to-tr from-vitora-primary to-vitora-secondary rounded-2xl flex items-center justify-center shadow-md border border-white/30"
          >
            <Activity className="w-7 h-7 text-white" />
          </motion.div>
          <h1 className="mt-4 text-2xl font-black tracking-widest text-vitora-text">
            VITORA
          </h1>
          <p className="text-4xs font-bold uppercase tracking-wider text-vitora-text/40 mt-1">
            Clinician Authentication Desk
          </p>
        </div>

        {/* Dynamic Exception Error Callout */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-700 text-xs rounded-2xl flex items-start gap-2.5 overflow-hidden text-left"
            >
              <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span className="font-semibold text-3xs leading-relaxed">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* OAuth Deck */}
        <div className="space-y-3">
          
          {/* Continue with Google */}
          <button
            onClick={() => handleOAuthLogin('GOOGLE')}
            disabled={authLoading !== null}
            className="w-full py-3 rounded-2xl font-black text-3xs uppercase tracking-widest bg-white/40 border border-white/50 hover:bg-white/60 transition-colors flex items-center justify-center relative text-vitora-text"
          >
            {authLoading === 'GOOGLE' ? (
              <Loader2 className="w-4 h-4 animate-spin text-vitora-primary" />
            ) : (
              <>
                <GoogleLogo /> Continue with Google
              </>
            )}
          </button>

          {/* Continue with GitHub */}
          <button
            onClick={() => handleOAuthLogin('GITHUB')}
            disabled={authLoading !== null}
            className="w-full py-3 rounded-2xl font-black text-3xs uppercase tracking-widest bg-white/40 border border-white/50 hover:bg-white/60 transition-colors flex items-center justify-center relative text-vitora-text"
          >
            {authLoading === 'GITHUB' ? (
              <Loader2 className="w-4 h-4 animate-spin text-vitora-primary" />
            ) : (
              <>
                <GithubLogo /> Continue with GitHub
              </>
            )}
          </button>

          {/* Continue with Apple */}
          <button
            onClick={() => handleOAuthLogin('APPLE')}
            disabled={authLoading !== null}
            className="w-full py-3 rounded-2xl font-black text-3xs uppercase tracking-widest bg-white/40 border border-white/50 hover:bg-white/60 transition-colors flex items-center justify-center relative text-vitora-text"
          >
            {authLoading === 'APPLE' ? (
              <Loader2 className="w-4 h-4 animate-spin text-vitora-primary" />
            ) : (
              <>
                <AppleLogo /> Continue with Apple
              </>
            )}
          </button>

          {/* Continue with Email Selector */}
          {!showEmailForm && (
            <button
              onClick={() => setShowEmailForm(true)}
              className="w-full py-3 rounded-2xl font-black text-3xs uppercase tracking-widest bg-vitora-primary/10 border border-vitora-primary/20 hover:bg-vitora-primary/15 transition-colors flex items-center justify-center relative text-vitora-primary"
            >
              <Mail className="w-3.5 h-3.5 mr-2" /> Continue with Email
            </button>
          )}

        </div>

        {/* Expandable Email/Password form */}
        <AnimatePresence>
          {showEmailForm && (
            <motion.div
              initial={{ opacity: 0, height: 0, marginTop: 0 }}
              animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
              exit={{ opacity: 0, height: 0, marginTop: 0 }}
              transition={{ type: 'spring', stiffness: 100, damping: 15 }}
              className="overflow-hidden text-left border-t border-vitora-text/5 pt-4 space-y-4"
            >
              <h3 className="text-4xs font-black text-vitora-text/50 uppercase tracking-widest">
                {isRegister ? 'Clinician Signup' : 'Clinician Signin'}
              </h3>

              <form onSubmit={handleEmailSubmit} className="space-y-3">
                {isRegister && (
                  <div>
                    <label className="text-4xs font-bold text-vitora-text/75 mb-1.5 block uppercase">Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-vitora-text/35" />
                      <input
                        type="text"
                        required
                        placeholder="Dr. Alexander Fleming"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-xs rounded-xl glass-input text-vitora-text font-medium"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-4xs font-bold text-vitora-text/75 mb-1.5 block uppercase">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-vitora-text/35" />
                    <input
                      type="email"
                      required
                      placeholder="clinician@vitora.ai"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl glass-input text-vitora-text font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-4xs font-bold text-vitora-text/75 mb-1.5 block uppercase">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-vitora-text/35" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 text-xs rounded-xl glass-input text-vitora-text font-medium"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authLoading !== null}
                  className="w-full py-3 rounded-xl font-black text-3xs uppercase tracking-widest glass-button shadow-md flex items-center justify-center gap-1.5 mt-4"
                >
                  {authLoading === 'EMAIL' ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
                  ) : (
                    <>
                      {isRegister ? 'Create Account' : 'Authenticate Session'} <ChevronRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </form>

              <div className="flex justify-between items-center text-4xs font-extrabold uppercase mt-4">
                <button
                  onClick={() => setIsRegister(!isRegister)}
                  className="text-vitora-primary hover:text-vitora-secondary transition-colors"
                >
                  {isRegister ? 'Sign In Instead' : 'Register Profile'}
                </button>
                <button
                  onClick={() => setShowEmailForm(false)}
                  className="text-vitora-text/45 hover:text-vitora-text/60"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  );
};

export default Login;
