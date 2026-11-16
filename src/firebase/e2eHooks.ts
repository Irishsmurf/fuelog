// Test-only helpers, loaded exclusively in emulator builds (see config.ts).
// Google sign-in can't be automated, so E2E tests sign in with an
// email/password account on the Auth emulator and seed data through the
// app's own (rules-checked) Firestore client.
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, type Auth } from 'firebase/auth';
import { addDoc, collection, type Firestore } from 'firebase/firestore';

export interface FuelogE2EHooks {
  signIn(email: string): Promise<string>;
  addVehicle(name: string): Promise<string>;
}

declare global {
  interface Window { __fuelogE2E?: FuelogE2EHooks }
}

export function installE2EHooks(auth: Auth, db: Firestore): void {
  const password = 'e2e-password-123';
  window.__fuelogE2E = {
    async signIn(email) {
      try {
        return (await signInWithEmailAndPassword(auth, email, password)).user.uid;
      } catch {
        return (await createUserWithEmailAndPassword(auth, email, password)).user.uid;
      }
    },
    async addVehicle(name) {
      const uid = auth.currentUser?.uid;
      if (!uid) throw new Error('Sign in first');
      const ref = await addDoc(collection(db, 'vehicles'), {
        userId: uid, name, make: 'Test', model: 'Car', year: '2020',
        fuelType: 'Petrol', isDefault: true, isArchived: false,
      });
      return ref.id;
    },
  };
}
