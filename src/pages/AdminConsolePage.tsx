import { JSX, useState, useEffect, FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { ShieldAlert, Send, Loader2 } from 'lucide-react';

interface SendTestNotificationResponse {
  sentCount: number;
  failedCount: number;
}

function AdminConsolePage(): JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [accessState, setAccessState] = useState<'checking' | 'denied' | 'granted'>('checking');

  const [targetUid, setTargetUid] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [dataJson, setDataJson] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!user) return;
    const checkAccess = httpsCallable<unknown, { isDeveloper: boolean }>(functions, 'checkDeveloperAccess');
    checkAccess()
      .then(res => setAccessState(res.data.isDeveloper ? 'granted' : 'denied'))
      .catch(() => setAccessState('denied'));
  }, [user]);

  useEffect(() => {
    if (user) setTargetUid(user.uid);
  }, [user]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setResult(null);

    let data: Record<string, string> | undefined;
    if (dataJson.trim()) {
      try {
        data = JSON.parse(dataJson);
      } catch {
        setResult({ type: 'error', text: t('admin.invalidJson') });
        return;
      }
    }

    setIsSending(true);
    try {
      const sendTestNotification = httpsCallable<
        { targetUid: string; title: string; body: string; data?: Record<string, string> },
        SendTestNotificationResponse
      >(functions, 'sendTestNotification');
      const res = await sendTestNotification({ targetUid, title, body, data });
      setResult({
        type: 'success',
        text: t('admin.sendSuccess', {
          sentCount: res.data.sentCount,
          failedSuffix: res.data.failedCount > 0 ? t('admin.sendFailedSuffix', { failedCount: res.data.failedCount }) : '',
        }),
      });
    } catch (err) {
      setResult({ type: 'error', text: err instanceof Error ? err.message : t('admin.sendError') });
    } finally {
      setIsSending(false);
    }
  };

  if (accessState === 'checking') {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  if (accessState === 'denied') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] text-center space-y-3">
        <ShieldAlert className="w-10 h-10 text-red-500" />
        <p className="text-gray-600 dark:text-gray-400">{t('admin.accessDenied')}</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">{t('admin.title')}</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">{t('admin.subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white dark:bg-gray-800 shadow-xl rounded-3xl p-6 sm:p-8 border border-gray-100 dark:border-gray-700/50">
        <div>
          <label className="block text-sm font-bold mb-1" htmlFor="targetUid">{t('admin.fields.targetUid')}</label>
          <input
            id="targetUid"
            type="text"
            value={targetUid}
            onChange={e => setTargetUid(e.target.value)}
            required
            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-brand-primary/20 transition-all font-bold text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-bold mb-1" htmlFor="title">{t('admin.fields.title')}</label>
          <input
            id="title"
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            required
            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-brand-primary/20 transition-all font-bold text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-bold mb-1" htmlFor="body">{t('admin.fields.body')}</label>
          <textarea
            id="body"
            value={body}
            onChange={e => setBody(e.target.value)}
            required
            rows={3}
            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-brand-primary/20 transition-all font-bold text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-bold mb-1" htmlFor="dataJson">{t('admin.fields.dataJson')}</label>
          <textarea
            id="dataJson"
            value={dataJson}
            onChange={e => setDataJson(e.target.value)}
            rows={2}
            placeholder='{"key": "value"}'
            className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-900 border-none rounded-xl focus:ring-2 focus:ring-brand-primary/20 transition-all font-mono text-sm text-gray-900 dark:text-white"
          />
        </div>

        <button
          type="submit"
          disabled={isSending}
          className="brand-button-primary flex items-center justify-center gap-2 w-full"
        >
          {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {t('admin.sendButton')}
        </button>

        {result && (
          <p className={result.type === 'success' ? 'text-green-600 dark:text-green-400 text-sm' : 'text-red-600 dark:text-red-400 text-sm'}>
            {result.text}
          </p>
        )}
      </form>
    </div>
  );
}

export default AdminConsolePage;
