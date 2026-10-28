import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  User,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App safely
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

export const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

const provider = new GoogleAuthProvider();
for (const scope of SCOPES) {
  provider.addScope(scope);
}
provider.setCustomParameters({
  prompt: 'select_account',
  access_type: 'offline',
});

let isSigningIn = false;
let cachedAccessToken: string | null =
  typeof window !== 'undefined' ? localStorage.getItem('gcal_access_token') : null;

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (!cachedAccessToken && typeof window !== 'undefined') {
        cachedAccessToken = localStorage.getItem('gcal_access_token');
      }
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (typeof window !== 'undefined') {
        localStorage.removeItem('gcal_access_token');
      }
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User; accessToken: string } | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Googleカレンダーのアクセストークン取得に失敗しました');
    }

    cachedAccessToken = credential.accessToken;
    if (typeof window !== 'undefined') {
      localStorage.setItem('gcal_access_token', cachedAccessToken);
    }
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Google Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  if (!cachedAccessToken && typeof window !== 'undefined') {
    cachedAccessToken = localStorage.getItem('gcal_access_token');
  }
  return cachedAccessToken;
};

export const clearAccessToken = () => {
  cachedAccessToken = null;
  if (typeof window !== 'undefined') {
    localStorage.removeItem('gcal_access_token');
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (e) {
    console.warn('Sign out warning:', e);
  }
  clearAccessToken();
};
