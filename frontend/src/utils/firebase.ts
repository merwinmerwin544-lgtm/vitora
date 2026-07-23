import { initializeApp, getApps } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  GithubAuthProvider, 
  OAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import type { User as FirebaseUser } from 'firebase/auth';

// Vite environment bindings
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const isConfigured = !!firebaseConfig.projectId && firebaseConfig.projectId !== 'undefined';

let app;
let auth: any;

if (isConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    auth = getAuth(app);
  } catch (error) {
    console.error('Firebase Auth initialization error. Defaulting to sandbox mock mode.', error);
    auth = null;
  }
}

// Custom structure for standardized OAuth profile details
export interface UserSessionProfile {
  uid: string;
  email: string;
  name: string;
  picture: string;
  provider: string;
  idToken: string;
}

// Simple in-memory mock auth state listener
type AuthStateCallback = (user: UserSessionProfile | null) => void;
const mockCallbacks = new Set<AuthStateCallback>();
let currentMockUser: UserSessionProfile | null = null;

// Initialize mock state from localStorage
const storedUser = localStorage.getItem('vitora_auth_profile');
if (storedUser) {
  try {
    currentMockUser = JSON.parse(storedUser);
  } catch {
    // Clean corrupt payload
    localStorage.removeItem('vitora_auth_profile');
  }
}

export const authProvider = {
  // Check if real Firebase instance is active
  isFirebaseActive(): boolean {
    return isConfigured && auth !== null;
  },

  // Listen to session changes
  onSessionStateChanged(callback: AuthStateCallback) {
    if (this.isFirebaseActive()) {
      return firebaseOnAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
        if (!fbUser) {
          callback(null);
          return;
        }
        
        try {
          const idToken = await fbUser.getIdToken();
          // Extract provider details
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
        } catch {
          callback(null);
        }
      });
    } else {
      mockCallbacks.add(callback);
      // Trigger initial call with current value
      callback(currentMockUser);
      return () => {
        mockCallbacks.delete(callback);
      };
    }
  },

  // Sign out session
  async logoutSession(): Promise<void> {
    if (this.isFirebaseActive()) {
      await firebaseSignOut(auth);
    } else {
      currentMockUser = null;
      localStorage.removeItem('vitora_auth_profile');
      mockCallbacks.forEach((cb) => cb(null));
    }
  },

  // Google OAuth flow
  async continueWithGoogle(): Promise<UserSessionProfile> {
    if (this.isFirebaseActive()) {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
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
    } else {
      // Simulate Google picker popup delay
      await new Promise((res) => setTimeout(res, 1200));
      const mockUser: UserSessionProfile = {
        uid: 'mock_firebase_uid_fleming',
        email: 'clinician@vitora.ai',
        name: 'Dr. Alexander Fleming',
        picture: 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?q=80&w=150',
        provider: 'Google',
        idToken: `mock_token_google_${Date.now()}`
      };
      
      currentMockUser = mockUser;
      localStorage.setItem('vitora_auth_profile', JSON.stringify(mockUser));
      mockCallbacks.forEach((cb) => cb(mockUser));
      return mockUser;
    }
  },

  // GitHub OAuth flow
  async continueWithGithub(): Promise<UserSessionProfile> {
    if (this.isFirebaseActive()) {
      const provider = new GithubAuthProvider();
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
    } else {
      await new Promise((res) => setTimeout(res, 1200));
      const mockUser: UserSessionProfile = {
        uid: 'mock_firebase_uid_github',
        email: 'github_worker@vitora.ai',
        name: 'GitHub Clinician',
        picture: 'https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=150',
        provider: 'GitHub',
        idToken: `mock_token_github_${Date.now()}`
      };
      
      currentMockUser = mockUser;
      localStorage.setItem('vitora_auth_profile', JSON.stringify(mockUser));
      mockCallbacks.forEach((cb) => cb(mockUser));
      return mockUser;
    }
  },

  // Sign In with Apple flow
  async continueWithApple(): Promise<UserSessionProfile> {
    if (this.isFirebaseActive()) {
      const provider = new OAuthProvider('apple.com');
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
    } else {
      await new Promise((res) => setTimeout(res, 1200));
      const mockUser: UserSessionProfile = {
        uid: 'mock_firebase_uid_apple',
        email: 'apple_practitioner@vitora.ai',
        name: 'Apple Clinician',
        picture: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=150',
        provider: 'Apple',
        idToken: `mock_token_apple_${Date.now()}`
      };

      currentMockUser = mockUser;
      localStorage.setItem('vitora_auth_profile', JSON.stringify(mockUser));
      mockCallbacks.forEach((cb) => cb(mockUser));
      return mockUser;
    }
  },

  // Email/Password sign in flow
  async continueWithEmail(email: string, pass: string): Promise<UserSessionProfile> {
    if (this.isFirebaseActive()) {
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
    } else {
      await new Promise((res) => setTimeout(res, 800));
      
      // Allow custom email inputs, defaulting credentials if match
      const mockUser: UserSessionProfile = {
        uid: `mock_uid_email_${email.replace(/[^a-zA-Z0-9]/g, '')}`,
        email,
        name: email.split('@')[0],
        picture: '',
        provider: 'Email',
        idToken: `mock_token_email_${Date.now()}`
      };

      currentMockUser = mockUser;
      localStorage.setItem('vitora_auth_profile', JSON.stringify(mockUser));
      mockCallbacks.forEach((cb) => cb(mockUser));
      return mockUser;
    }
  },

  // Email/Password register flow
  async registerWithEmail(email: string, pass: string, name: string): Promise<UserSessionProfile> {
    if (this.isFirebaseActive()) {
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
    } else {
      await new Promise((res) => setTimeout(res, 800));
      const mockUser: UserSessionProfile = {
        uid: `mock_uid_email_${email.replace(/[^a-zA-Z0-9]/g, '')}`,
        email,
        name,
        picture: '',
        provider: 'Email',
        idToken: `mock_token_email_${Date.now()}`
      };

      currentMockUser = mockUser;
      localStorage.setItem('vitora_auth_profile', JSON.stringify(mockUser));
      mockCallbacks.forEach((cb) => cb(mockUser));
      return mockUser;
    }
  }
};
