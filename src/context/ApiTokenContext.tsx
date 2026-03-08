import { JSX, createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  collection, query, where, onSnapshot, addDoc, updateDoc, doc,
  serverTimestamp, Timestamp
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from './AuthContext';
import type { ApiToken } from '../utils/types';

const ALL_SCOPES = ['read:logs', 'write:logs', 'read:vehicles', 'write:vehicles'] as const;
export type TokenScope = typeof ALL_SCOPES[number];

interface ApiTokenContextValue {
  tokens: ApiToken[];
  loading: boolean;
  createToken: (name: string, scopes: TokenScope[]) => Promise<string>;
  revokeToken: (tokenId: string) => Promise<void>;
}

const ApiTokenContext = createContext<ApiTokenContextValue | null>(null);

async function sha256Hex(input: string): Promise<string> {
  const encoded = new TextEncoder().encode(input);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function generateRawToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  return `flog_${hex}`;
}

export function ApiTokenProvider({ children }: { children: ReactNode }): JSX.Element {
  const { user } = useAuth();
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setTokens([]); setLoading(false); return; }

    setLoading(true);
    const q = query(
      collection(db, 'apiTokens'),
      where('userId', '==', user.uid),
      where('isRevoked', '==', false)
    );
    const unsubscribe = onSnapshot(q, snapshot => {
      const list: ApiToken[] = snapshot.docs
        .map(d => ({ id: d.id, ...d.data() } as ApiToken))
        .sort((a, b) => {
          const ta = (a.createdAt as Timestamp)?.toMillis?.() ?? 0;
          const tb = (b.createdAt as Timestamp)?.toMillis?.() ?? 0;
          return tb - ta;
        });
      setTokens(list);
      setLoading(false);
    }, () => setLoading(false));

    return unsubscribe;
  }, [user]);

  const createToken = async (name: string, scopes: TokenScope[]): Promise<string> => {
    if (!user) throw new Error('Not authenticated');
    const rawToken = generateRawToken();
    const tokenHash = await sha256Hex(rawToken);
    const tokenPrefix = rawToken.slice(0, 9); // "flog_" + 4 chars

    await addDoc(collection(db, 'apiTokens'), {
      userId: user.uid,
      name,
      tokenHash,
      tokenPrefix,
      scopes,
      createdAt: serverTimestamp(),
      lastUsedAt: null,
      isRevoked: false,
      expiresAt: null,
    });

    return rawToken;
  };

  const revokeToken = async (tokenId: string): Promise<void> => {
    await updateDoc(doc(db, 'apiTokens', tokenId), { isRevoked: true });
  };

  return (
    <ApiTokenContext.Provider value={{ tokens, loading, createToken, revokeToken }}>
      {children}
    </ApiTokenContext.Provider>
  );
}

export function useApiTokens(): ApiTokenContextValue {
  const ctx = useContext(ApiTokenContext);
  if (!ctx) throw new Error('useApiTokens must be used within ApiTokenProvider');
  return ctx;
}
