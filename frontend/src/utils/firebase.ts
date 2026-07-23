import { initializeApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  GithubAuthProvider, 
  OAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);

export interface UserSessionProfile {
  uid: string;
  email: string;
  name: string;
  picture: string;
  provider: string;
  idToken: string;
}

type AuthStateCallback = (user: UserSessionProfile | null) => void;

export const authProvider = {
  // Listen to session changes
  onSessionStateChanged(callback: AuthStateCallback) {
    return firebaseOnAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (!fbUser) {
        callback(null);
        return;
      }
      
      try {
        const idToken = await fbUser.getIdToken();
        const provider = fbUser.providerData[0]?.providerId === 'github.com' 
          ? 'GitHub' 
          : fbUser.providerData[0]?.providerId === 'apple.com' 
          ? 'Apple' 
          : fbUser.providerData[0]?.providerId === 'google.com' 
          ? 'Google' 
          : 'Email';

        callback({
          uid: fbUser.uid,
          email: fbUser.email || '',
          name: fbUser.displayName || fbUser.email?.split('@')[0] || '',
          picture: fbUser.photoURL || '',
          provider,
          idToken
        });
      } catch (error) {
        console.error('Error getting user ID token:', error);
        callback(null);
      }
    });
  },

  // Invalidate session
  async logoutSession(): Promise<void> {
    await firebaseSignOut(auth);
  },

  // Refresh token session
  async refreshToken(): Promise<string | null> {
    const currentUser = auth.currentUser;
    if (currentUser) {
      return await currentUser.getIdToken(true);
    }
    return null;
  },

  // Google OAuth flow
  async continueWithGoogle(): Promise<UserSessionProfile> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    try {
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      return {
        uid: result.user.uid,
        email: result.user.email || '',
        name: result.user.displayName || '',
        picture: result.user.photoURL || '',
        provider: 'Google',
        idToken
      };
    } catch (popupError: any) {
      if (popupError.code === 'auth/popup-blocked') {
        console.warn('Google popup blocked, falling back to redirect...');
        await signInWithRedirect(auth, provider);
        return new Promise(() => {});
      }
      throw popupError;
    }
  },

  // GitHub OAuth flow
  async continueWithGithub(): Promise<UserSessionProfile> {
    const provider = new GithubAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      return {
        uid: result.user.uid,
        email: result.user.email || '',
        name: result.user.displayName || '',
        picture: result.user.photoURL || '',
        provider: 'GitHub',
        idToken
      };
    } catch (popupError: any) {
      if (popupError.code === 'auth/popup-blocked') {
        console.warn('GitHub popup blocked, falling back to redirect...');
        await signInWithRedirect(auth, provider);
        return new Promise(() => {});
      }
      throw popupError;
    }
  },

  // Sign In with Apple flow
  async continueWithApple(): Promise<UserSessionProfile> {
    const provider = new OAuthProvider('apple.com');
    try {
      const result = await signInWithPopup(auth, provider);
      const idToken = await result.user.getIdToken();
      return {
        uid: result.user.uid,
        email: result.user.email || '',
        name: result.user.displayName || '',
        picture: result.user.photoURL || '',
        provider: 'Apple',
        idToken
      };
    } catch (popupError: any) {
      if (popupError.code === 'auth/popup-blocked') {
        console.warn('Apple popup blocked, falling back to redirect...');
        await signInWithRedirect(auth, provider);
        return new Promise(() => {});
      }
      throw popupError;
    }
  },

  // Email/Password sign in flow
  async continueWithEmail(email: string, pass: string): Promise<UserSessionProfile> {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    const idToken = await result.user.getIdToken();
    return {
      uid: result.user.uid,
      email: result.user.email || '',
      name: result.user.displayName || email.split('@')[0],
      picture: result.user.photoURL || '',
      provider: 'Email',
      idToken
    };
  },

  // Email/Password register flow
  async registerWithEmail(email: string, pass: string, name: string): Promise<UserSessionProfile> {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    const idToken = await result.user.getIdToken();
    return {
      uid: result.user.uid,
      email: result.user.email || '',
      name,
      picture: '',
      provider: 'Email',
      idToken
    };
  }
};
