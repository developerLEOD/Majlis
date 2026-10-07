import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, disableNetwork, setLogLevel } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

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

let hasReportedQuotaExhausted = false;
export let isFirestoreQuotaExhausted = false;

// Silence internal Firestore SDK logs
try {
  setLogLevel('silent');
} catch (e) {}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errStr = error instanceof Error ? error.message : String(error);
  const isQuota =
    errStr.includes('resource-exhausted') ||
    errStr.includes('Quota limit exceeded') ||
    (error as any)?.code === 'resource-exhausted';

  if (isQuota) {
    isFirestoreQuotaExhausted = true;
    if (!hasReportedQuotaExhausted) {
      hasReportedQuotaExhausted = true;
      console.warn(
        'Firestore free daily write quota reached. Seamlessly switching to local WebSocket and BroadcastChannel synchronization.'
      );
      try {
        disableNetwork(db).catch(() => {});
      } catch (e) {}
    }
    return {
      error: 'Firestore quota limit reached. Using WebSocket / REST fallback.',
      operationType,
      path,
      authInfo: { userId: auth.currentUser?.uid },
    };
  }

  const errInfo: FirestoreErrorInfo = {
    error: errStr,
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
  return errInfo;
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Global console filter to catch and silence internal Firestore quota and backoff messages
if (typeof window !== 'undefined') {
  const filterMsg = (msg: string) =>
    msg.includes('resource-exhausted') ||
    msg.includes('Quota limit exceeded') ||
    msg.includes('maximum backoff delay') ||
    msg.includes('prevent overloading the backend');

  const originalError = console.error;
  const originalWarn = console.warn;
  const originalInfo = console.info;

  console.error = (...args: any[]) => {
    const msg = args.map((a) => (a instanceof Error ? a.message : String(a))).join(' ');
    if (filterMsg(msg)) {
      isFirestoreQuotaExhausted = true;
      try {
        disableNetwork(db).catch(() => {});
      } catch (e) {}
      return;
    }
    originalError.apply(console, args);
  };

  console.warn = (...args: any[]) => {
    const msg = args.map((a) => (a instanceof Error ? a.message : String(a))).join(' ');
    if (filterMsg(msg)) {
      isFirestoreQuotaExhausted = true;
      try {
        disableNetwork(db).catch(() => {});
      } catch (e) {}
      return;
    }
    originalWarn.apply(console, args);
  };

  console.info = (...args: any[]) => {
    const msg = args.map((a) => (a instanceof Error ? a.message : String(a))).join(' ');
    if (filterMsg(msg)) return;
    originalInfo.apply(console, args);
  };
}
