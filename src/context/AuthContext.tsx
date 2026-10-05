import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { auth } from '../firebase';

export const ALLOWED_MODERATORS = [
  'araizhasan00@gmail.com',
  'thewisdomlounge1@gmail.com',
];

export const ALLOWED_FACILITATORS = ALLOWED_MODERATORS;

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isModerator: boolean;
  isFacilitator: boolean;
  allowedEmails: string[];
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (e: string, p: string) => Promise<void>;
  signUpWithEmail: (e: string, p: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  checkEmailIsModerator: (email: string) => boolean;
  checkEmailIsFacilitator: (email: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const checkEmailIsModerator = (email: string): boolean => {
    if (!email) return false;
    const lower = email.trim().toLowerCase();
    return ALLOWED_MODERATORS.map((e) => e.toLowerCase()).includes(lower);
  };

  const isModerator = !!user?.email && checkEmailIsModerator(user.email);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    await signInWithPopup(auth, provider);
  };

  const signInWithEmail = async (email: string, pass: string) => {
    await signInWithEmailAndPassword(auth, email.trim(), pass);
  };

  const signUpWithEmail = async (email: string, pass: string) => {
    await createUserWithEmailAndPassword(auth, email.trim(), pass);
  };

  const signOutUser = async () => {
    await signOut(auth);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isModerator,
        isFacilitator: isModerator,
        allowedEmails: ALLOWED_MODERATORS,
        signInWithGoogle,
        signInWithEmail,
        signUpWithEmail,
        signOutUser,
        checkEmailIsModerator,
        checkEmailIsFacilitator: checkEmailIsModerator,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
