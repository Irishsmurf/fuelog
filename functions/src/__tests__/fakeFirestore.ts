// A small in-memory stand-in for the Admin Firestore API surface used by
// onLogWrite and the derivedLogFields migration: docs, equality queries
// with select(), transactions and batches. Counts writes so tests can assert
// that nothing was written.
import { FieldValue, type Firestore } from 'firebase-admin/firestore';

type Data = Record<string, unknown>;

export function fakeFirestore(initial: Record<string, Data> = {}) {
    const store = new Map<string, Data>(Object.entries(initial));
    const stats = { updates: 0, sets: 0, creates: 0, batchCommits: 0, queries: 0 };

    const isDelete = (v: unknown) => v instanceof FieldValue && v.isEqual(FieldValue.delete());
    const applyUpdate = (path: string, data: Data) => {
        if (!store.has(path)) throw new Error(`No document to update: ${path}`);
        const next = { ...store.get(path) };
        for (const [k, v] of Object.entries(data)) {
            if (isDelete(v)) delete next[k];
            else next[k] = v;
        }
        store.set(path, next);
        stats.updates++;
    };
    const snap = (path: string) => ({
        id: path.split('/')[1],
        exists: store.has(path),
        data: () => (store.has(path) ? { ...store.get(path) } : undefined),
    });

    const docRef = (c: string, id: string) => {
        const path = `${c}/${id}`;
        return {
            path,
            id,
            get: async () => snap(path),
            set: async (data: Data) => { store.set(path, data); stats.sets++; },
            update: async (data: Data) => applyUpdate(path, data),
            create: async (data: Data) => {
                if (store.has(path)) throw Object.assign(new Error('ALREADY_EXISTS'), { code: 6 });
                store.set(path, data);
                stats.creates++;
            },
        };
    };

    const query = (c: string, filters: [string, unknown][] = [], fields?: string[]) => ({
        where: (field: string, _op: '==', value: unknown) => query(c, [...filters, [field, value]], fields),
        select: (...f: string[]) => query(c, filters, f),
        get: async () => {
            stats.queries++;
            const docs = [...store.entries()]
                .filter(([p]) => p.startsWith(`${c}/`) && p.split('/').length === 2)
                .filter(([, d]) => filters.every(([f, v]) => d[f] === v))
                .map(([p, d]) => ({
                    id: p.split('/')[1],
                    data: () => (fields ? Object.fromEntries(Object.entries(d).filter(([k]) => fields.includes(k))) : { ...d }),
                }));
            return { docs, size: docs.length };
        },
    });

    const db = {
        collection: (c: string) => ({ doc: (id: string) => docRef(c, id), ...query(c) }),
        runTransaction: async <T>(fn: (tx: unknown) => Promise<T>) => {
            const writes: (() => void)[] = [];
            const result = await fn({
                get: async (r: { path: string }) => snap(r.path),
                update: (r: { path: string }, data: Data) => { writes.push(() => applyUpdate(r.path, data)); },
                set: (r: { path: string }, data: Data) => { writes.push(() => { store.set(r.path, data); stats.sets++; }); },
            });
            writes.forEach((w) => w());
            return result;
        },
        batch: () => {
            const writes: (() => void)[] = [];
            return {
                update: (r: { path: string }, data: Data) => { writes.push(() => applyUpdate(r.path, data)); },
                commit: async () => { writes.forEach((w) => w()); stats.batchCommits++; },
                size: () => writes.length,
            };
        },
    };
    return { db: db as unknown as Firestore, store, stats };
}

export const ts = (ms: number) => ({ toMillis: () => ms });
export const DAY = 86_400_000;
