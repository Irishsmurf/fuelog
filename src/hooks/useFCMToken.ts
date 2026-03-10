// src/hooks/useFCMToken.ts
import { useState, useEffect, useCallback } from 'react';
import { collection, doc, getDocs, query, setDoc, deleteDoc, where, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { requestNotificationPermission, onForegroundMessage } from '../firebase/messagingService';
import { useAuth } from '../context/AuthContext';

export interface FCMTokenState {
    /** Whether the user has enabled push notifications */
    isEnabled: boolean;
    /** Whether a permission/token request is in progress */
    isLoading: boolean;
    /** Enable notifications: request permission and persist FCM token */
    enable: () => Promise<void>;
    /** Disable notifications: delete stored FCM token */
    disable: () => Promise<void>;
}

export function useFCMToken(): FCMTokenState {
    const { user } = useAuth();
    const [isEnabled, setIsEnabled] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Check on mount whether the user already has a stored token
    useEffect(() => {
        if (!user) { setIsEnabled(false); return; }
        const q = query(collection(db, 'fcmTokens'), where('userId', '==', user.uid));
        getDocs(q).then(snap => setIsEnabled(!snap.empty)).catch(() => setIsEnabled(false));
    }, [user]);

    // Register a foreground message handler to show in-app toasts
    useEffect(() => {
        let unsubscribe: (() => void) | undefined;
        onForegroundMessage((payload) => {
            const { title, body } = payload.notification ?? {};
            console.log('Foreground FCM message:', title, body);
            // Foreground notifications can be handled by a toast library if desired.
        }).then(fn => { unsubscribe = fn; });
        return () => unsubscribe?.();
    }, []);

    const enable = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const token = await requestNotificationPermission();
            if (!token) return;

            // Store token in Firestore — document ID is the token itself for easy upsert
            await setDoc(doc(db, 'fcmTokens', token), {
                userId: user.uid,
                token,
                platform: 'web',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
            });
            setIsEnabled(true);
        } catch (err) {
            console.error('Failed to enable notifications:', err);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    const disable = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);
        try {
            const q = query(collection(db, 'fcmTokens'), where('userId', '==', user.uid));
            const snap = await getDocs(q);
            await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
            setIsEnabled(false);
        } catch (err) {
            console.error('Failed to disable notifications:', err);
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    return { isEnabled, isLoading, enable, disable };
}
