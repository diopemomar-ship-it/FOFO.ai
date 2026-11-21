import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { AppTheme, UserSubscription } from './types';

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export interface FirestoreUserProfileDoc {
  uid: string;
  name: string;
  email: string;
  plan: 'free' | 'pro' | 'business';
  creditsRemaining: number;
  maxCredits: number;
  renewalDate?: string;
  theme?: AppTheme;
  installedApp?: boolean;
  paymentProvider?: 'visa' | 'stripe' | 'paypal';
  billingCycle?: 'monthly' | 'annual';
  cardLast4?: string;
}

export async function syncUserProfileWithFirestore(
  uid: string,
  fallbackProfile: {
    name: string;
    email: string;
    theme?: AppTheme;
    installedApp?: boolean;
  }
): Promise<Partial<UserSubscription> | null> {
  if (!auth.currentUser || auth.currentUser.uid !== uid || !auth.currentUser.emailVerified) {
    return null;
  }

  const userDocPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  let snap;
  try {
    snap = await getDoc(userRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userDocPath);
  }

  if (!snap.exists()) {
    const safeName = (fallbackProfile.name || 'Créateur FOFO').trim().slice(0, 80) || 'Créateur FOFO';
    const safeEmail = (fallbackProfile.email || auth.currentUser.email || '').trim().slice(0, 160);
    if (!safeEmail) return null;

    const newDocPayload: Record<string, unknown> = {
      uid,
      name: safeName,
      email: safeEmail,
      plan: 'free',
      creditsRemaining: 3,
      maxCredits: 3,
      renewalDate: '1er du mois prochain',
      theme: fallbackProfile.theme || 'system',
      installedApp: Boolean(fallbackProfile.installedApp),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    try {
      await setDoc(userRef, newDocPayload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, userDocPath);
    }

    return {
      uid,
      name: safeName,
      email: safeEmail,
      plan: 'free',
      creditsRemaining: 3,
      maxCredits: 3,
      renewalDate: '1er du mois prochain',
      theme: fallbackProfile.theme || 'system',
      installedApp: Boolean(fallbackProfile.installedApp),
    };
  }

  const data = snap.data() as FirestoreUserProfileDoc;
  return {
    uid: data.uid,
    name: data.name || fallbackProfile.name,
    email: data.email || fallbackProfile.email,
    plan: data.plan || 'free',
    creditsRemaining: typeof data.creditsRemaining === 'number' ? data.creditsRemaining : 3,
    maxCredits: typeof data.maxCredits === 'number' ? data.maxCredits : 3,
    renewalDate: data.renewalDate || '1er du mois prochain',
    theme: data.theme || fallbackProfile.theme,
    installedApp: Boolean(data.installedApp),
    paymentProvider: data.paymentProvider,
    billingCycle: data.billingCycle,
    cardLast4: data.cardLast4,
  };
}

export async function updateUserPreferencesInFirestore(
  uid: string,
  updates: {
    name?: string;
    theme?: AppTheme;
    installedApp?: boolean;
    creditsRemaining?: number;
  }
): Promise<void> {
  if (!auth.currentUser || auth.currentUser.uid !== uid || !auth.currentUser.emailVerified) {
    return;
  }

  const userDocPath = `users/${uid}`;
  const userRef = doc(db, 'users', uid);

  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };

  if (typeof updates.name === 'string' && updates.name.trim()) {
    payload.name = updates.name.trim().slice(0, 80);
  }
  if (updates.theme) {
    payload.theme = updates.theme;
  }
  if (typeof updates.installedApp === 'boolean') {
    payload.installedApp = updates.installedApp;
  }
  if (typeof updates.creditsRemaining === 'number' && updates.creditsRemaining >= 0) {
    payload.creditsRemaining = Math.floor(updates.creditsRemaining);
  }

  try {
    await updateDoc(userRef, payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userDocPath);
  }
}
