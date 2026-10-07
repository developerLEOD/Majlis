import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
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
  console.warn('Firestore notice: ', JSON.stringify(errInfo));
  return errInfo;
}

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Validate connection safely without throwing quota errors
async function testConnection() {
  if (isFirestoreQuotaExhausted) return;
  try {
    await getDocFromServer(doc(db, 'rooms', 'test-connection'));
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, 'rooms/test-connection');
  }
}

if (typeof window !== 'undefined') {
  testConnection();
}
