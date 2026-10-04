import React, { useState } from 'react';
import { Crown, X, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { LoungeArcLogo } from '../common/LoungeArcLogo';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  requiredForFacilitator?: boolean;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  requiredForFacilitator = false,
}) => {
  const {
    user,
    isFacilitator,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOutUser,
  } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Google');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'signin') {
        await signInWithEmail(email, password);
      } else {
        await signUpWithEmail(email, password);
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Authentication error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 select-none">
      <div className="w-full max-w-md bg-[#FFFCF5] border border-[#E6DFD5] rounded-md overflow-hidden flex flex-col text-[#1C1917]">
        {/* Header */}
        <div className="p-4 border-b border-[#E6DFD5] flex items-center justify-between bg-[#F5F2EB]">
          <div className="flex items-center gap-2.5">
            <LoungeArcLogo size="xs" />
            <div>
              <h2 className="text-sm font-semibold text-[#1C1917]">
                {user ? 'Account Settings' : 'Sign In'}
              </h2>
              <p className="text-[11px] text-[#8E7E73]">
                {requiredForFacilitator
                  ? 'Facilitator privileges require a moderator account'
                  : 'Sign in to access hosting features'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#8E7E73] hover:text-[#1C1917] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          {/* Current Auth Status Notice */}
          {user ? (
            <div className="p-3.5 rounded-sm bg-[#F5F2EB] border border-[#E6DFD5] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-[#3C230B] text-[#FFFCF5] font-medium text-xs flex items-center justify-center shrink-0">
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-semibold text-[#1C1917] truncate max-w-[180px]">
                      {user.email}
                    </div>
                    <div className="text-[10px] text-[#8E7E73]">Authenticated</div>
                  </div>
                </div>
                {isFacilitator ? (
                  <span className="px-2 py-0.5 text-[10px] font-medium bg-[#EFECE4] text-[#3C230B] border border-[#D9D0C3] rounded-sm flex items-center gap-1">
                    <Crown className="w-3 h-3 text-[#D4AF37]" /> Facilitator
                  </span>
                ) : (
                  <span className="px-2 py-0.5 text-[10px] font-medium bg-[#EFECE4] text-[#8E7E73] border border-[#D9D0C3] rounded-sm">
                    Seeker Account
                  </span>
                )}
              </div>

              {!isFacilitator && (
                <div className="p-2 rounded-sm bg-[#EFECE4] border border-[#D9D0C3] text-[#3C230B] text-[11px] flex items-start gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-[#D4AF37] shrink-0 mt-0.5" />
                  <span>
                    Signed in as <strong>{user.email}</strong>. Facilitator role active on moderator accounts.
                  </span>
                </div>
              )}

              <button
                onClick={signOutUser}
                className="w-full py-1.5 bg-[#FFFCF5] hover:bg-[#EFECE4] border border-[#D9D0C3] text-[#3C230B] rounded-sm text-xs font-medium transition-colors"
              >
                Sign Out / Switch Account
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Google Sign In */}
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-2 px-3 bg-[#FFFCF5] hover:bg-[#F5F2EB] border border-[#D9D0C3] text-[#1C1917] rounded-sm text-xs font-medium transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.8 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.2 9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.3s.2-1.6.4-2.3L1.9 7.3C.7 9.2 0 10.5 0 12s.7 2.8 1.9 4.7l3.7-1.9z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2.2-6.4-5.2L1.9 16C3.7 19.7 7.5 23 12 23z"
                  />
                </svg>
                <span>Sign in with Google</span>
              </button>

              <div className="relative text-center my-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#E6DFD5]" />
                </div>
                <span className="relative px-2 bg-[#FFFCF5] text-[10px] text-[#8E7E73] uppercase tracking-wider">
                  or email sign in
                </span>
              </div>

              {/* Email Form */}
              <form onSubmit={handleEmailSubmit} className="space-y-3">
                <div>
                  <label className="block text-[11px] text-[#68594E] font-medium mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-[#FFFCF5] border border-[#D9D0C3] rounded-sm px-3 py-1.5 text-xs text-[#1C1917] focus:outline-none focus:border-[#3C230B]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#68594E] font-medium mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#FFFCF5] border border-[#D9D0C3] rounded-sm px-3 py-1.5 text-xs text-[#1C1917] focus:outline-none focus:border-[#3C230B]"
                  />
                </div>

                <div className="pt-1 flex items-center justify-between gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-1.5 bg-[#3C230B] hover:bg-[#2B1706] text-[#FFFCF5] text-xs font-medium rounded-sm transition-colors"
                  >
                    {mode === 'signin' ? 'Sign In' : 'Create Account'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                    className="text-xs text-[#3C230B] hover:underline px-2 font-medium"
                  >
                    {mode === 'signin' ? 'Register' : 'Sign In'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#E6DFD5] bg-[#F5F2EB] flex justify-end">
          <button
            onClick={onClose}
            className="px-3.5 py-1 bg-[#EFECE4] text-[#3C230B] border border-[#D9D0C3] text-xs rounded-sm hover:bg-[#E6DFD5] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
