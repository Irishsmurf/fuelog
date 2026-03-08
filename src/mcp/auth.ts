import { getAdminDb } from './firebase-admin.js';

export interface TokenIdentity {
  userId: string;
  scopes: string[];
  tokenId: string;
}

function hexHash(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashToken(rawToken: string): Promise<string> {
  const encoded = new TextEncoder().encode(rawToken);
  const buffer = await crypto.subtle.digest('SHA-256', encoded);
  return hexHash(buffer);
}

export async function validateToken(rawToken: string): Promise<TokenIdentity | null> {
  try {
    const tokenHash = await hashToken(rawToken);
    const db = getAdminDb();

    const snapshot = await db
      .collection('apiTokens')
      .where('tokenHash', '==', tokenHash)
      .where('isRevoked', '==', false)
      .limit(1)
      .get();

    if (snapshot.empty) return null;

    const doc = snapshot.docs[0];
    const data = doc.data();

    // Check expiry if set
    if (data.expiresAt && data.expiresAt.toDate() < new Date()) return null;

    // Update lastUsedAt asynchronously (don't await — don't block the request)
    doc.ref.update({ lastUsedAt: new Date() }).catch(() => {});

    return { userId: data.userId, scopes: data.scopes ?? [], tokenId: doc.id };
  } catch {
    return null;
  }
}

export function hasScope(identity: TokenIdentity, scope: string): boolean {
  return identity.scopes.includes(scope);
}
