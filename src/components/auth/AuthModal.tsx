import React, { useState } from 'react';
import { Crown, X, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-[#18120E] border border-[#3C230B] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-[#3C230B]/80 flex items-center justify-between bg-gradient-to-r from-[#241710] to-[#1A130E]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#D4AF37]/15 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37]">
              <Crown className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-editorial text-base font-bold text-[#FFFCF5]">
                {user ? 'Account Settings' : 'Sign In'}
              </h3>
              <p className="text-[11px] text-[#A8988B]">
                {requiredForFacilitator
                  ? 'Facilitator privileges require a moderator account'
                  : 'Sign in to access hosting & facilitator features'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[#8E7E73] hover:text-[#FFFCF5] rounded-lg hover:bg-[#2B1706] transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 text-[#FFFCF5]">
          {/* Current Auth Status Notice */}
          {user ? (
            <div className="p-4 rounded-xl bg-[#241710] border border-[#3C230B] space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#D4AF37]/20 border border-[#D4AF37]/40 flex items-center justify-center text-[#D4AF37] font-bold text-xs">
                    {user.email?.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#FFFCF5] truncate max-w-[200px]">
                      {user.email}
                    </div>
                    <div className="text-[10px] text-[#8E7E73]">Authenticated Account</div>
                  </div>
                </div>
                {isFacilitator ? (
                  <span className="px-2.5 py-1 text-[10px] font-bold bg-[#D4AF37]/20 text-[#D4AF37] border border-[#D4AF37]/40 rounded-full flex items-center gap-1">
                    <Crown className="w-3 h-3" /> Facilitator
                  </span>
                ) : (
                  <span className="px-2.5 py-1 text-[10px] font-medium bg-[#2B1706] text-[#A8988B] border border-[#3C230B] rounded-full">
                    Seeker Account
                  </span>
                )}
              </div>

              {!isFacilitator && (
                <div className="p-2.5 rounded-lg bg-[#2B1706]/80 border border-[#3C230B] text-[#E0C2A6] text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-[#D4AF37] shrink-0 mt-0.5" />
                  <span>
                    Signed in as <strong>{user.email}</strong>. Facilitator privileges are active on designated moderator accounts.
                  </span>
                </div>
              )}

              <button
                onClick={signOutUser}
                className="w-full py-2 bg-[#2B1706] hover:bg-[#3C230B] border border-[#3C230B] text-[#E0C2A6] rounded-xl text-xs font-semibold transition"
              >
                Sign Out / Switch Account
              </button>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3 bg-red-950/80 border border-red-800 text-red-300 text-xs rounded-xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Google Sign In */}
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full py-2.5 px-4 bg-[#241710] hover:bg-[#2B1706] border border-[#3C230B] hover:border-[#D4AF37]/40 text-[#FFFCF5] rounded-xl text-xs font-semibold transition flex items-center justify-center gap-2.5 shadow-xs"
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
                  <div className="w-full border-t border-[#3C230B]" />
                </div>
                <span className="relative px-2 bg-[#18120E] text-[10px] text-[#8E7E73] font-mono uppercase">
                  or email sign in
                </span>
              </div>

              {/* Email Form */}
              <form onSubmit={handleEmailSubmit} className="space-y-3">
                <div>
                  <label className="block text-[11px] text-[#A8988B] font-medium mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full bg-[#201611] border border-[#3C230B] rounded-xl px-3.5 py-2 text-xs text-[#FFFCF5] placeholder-[#8E7E73] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#A8988B] font-medium mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#201611] border border-[#3C230B] rounded-xl px-3.5 py-2 text-xs text-[#FFFCF5] placeholder-[#8E7E73] focus:outline-none focus:border-[#D4AF37]"
                  />
                </div>

                <div className="pt-1 flex items-center justify-between gap-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 bg-[#3C230B] hover:bg-[#2B1706] border border-[#D4AF37]/30 text-[#FFFCF5] text-xs font-semibold rounded-xl transition"
                  >
                    {mode === 'signin' ? 'Sign In' : 'Create Account'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
                    className="text-xs text-[#D4AF37] hover:underline px-2"
                  >
                    {mode === 'signin' ? 'Register' : 'Sign In'}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#3C230B]/80 bg-[#140F0C] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-[#2B1706] text-[#E0C2A6] text-xs rounded-xl hover:bg-[#3C230B] transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
