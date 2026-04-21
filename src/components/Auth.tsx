import React from 'react';
import { signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { LogIn, LogOut, User as UserIcon } from 'lucide-react';

interface AuthProps {
  user: any;
  loading: boolean;
}

export const Auth: React.FC<AuthProps> = ({ user, loading }) => {
  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.code === 'auth/unauthorized-domain') {
        alert('This domain is not authorized in Firebase. Please add the current URL to "Authorized Domains" in your Firebase Console (Authentication > Settings).');
      } else {
        alert('Login failed: ' + error.message);
      }
    }
  };

  const handleLogout = () => signOut(auth);

  if (loading) return <div className="animate-pulse h-10 w-24 bg-zinc-200 rounded-lg"></div>;

  return (
    <div>
      {user ? (
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-700">
            <UserIcon size={18} />
            <span>{user.email}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      ) : (
        <button
          onClick={handleLogin}
          className="flex items-center gap-2 px-6 py-2.5 text-sm font-medium text-white bg-zinc-900 rounded-lg hover:bg-zinc-800 transition-colors shadow-sm"
        >
          <LogIn size={18} />
          Sign in with Google
        </button>
      )}
    </div>
  );
};
