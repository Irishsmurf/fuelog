import { JSX, useState } from 'react';
import { Key, Plus, Trash2, Copy, CheckCircle2, AlertCircle, Eye, EyeOff, X } from 'lucide-react';
import { useApiTokens, type TokenScope } from '../context/ApiTokenContext';
import type { ApiToken } from '../utils/types';
import { Timestamp } from 'firebase/firestore';
import { useTranslation, Trans } from 'react-i18next';

const ALL_SCOPES: TokenScope[] = ['read:logs', 'write:logs', 'read:vehicles', 'write:vehicles'];

interface TokenRevealModalProps {
  rawToken: string;
  onClose: () => void;
}

function TokenRevealModal({ rawToken, onClose }: TokenRevealModalProps): JSX.Element {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const mcpConfig = JSON.stringify({
    mcpServers: {
      fuelog: {
        url: `${window.location.origin}/api/mcp`,
        headers: { Authorization: `Bearer ${rawToken}` },
      },
    },
  }, null, 2);

  const [configCopied, setConfigCopied] = useState(false);

  const copyToken = () => {
    navigator.clipboard.writeText(rawToken).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  const copyConfig = () => {
    navigator.clipboard.writeText(mcpConfig).then(() => { setConfigCopied(true); setTimeout(() => setConfigCopied(false), 2000); });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-white dark:bg-gray-800 rounded-3xl shadow-2xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{t('apiTokens.reveal.title')}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
              {t('apiTokens.reveal.warning')}
            </p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5">{t('apiTokens.reveal.tokenLabel')}</label>
          <div className="flex items-center gap-2">
            <div className="flex-1 font-mono text-sm bg-gray-100 dark:bg-gray-700 rounded-xl px-3 py-2.5 break-all select-all text-gray-900 dark:text-gray-100">
              {showToken ? rawToken : '•'.repeat(Math.min(rawToken.length, 40))}
            </div>
            <button onClick={() => setShowToken(!showToken)} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
              {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
            <button
              onClick={copyToken}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors"
            >
              {copied ? <CheckCircle2 size={16} /> : <Copy size={16} />}
              {copied ? t('apiTokens.reveal.copied') : t('apiTokens.reveal.copy')}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1.5">{t('apiTokens.reveal.configLabel')}</label>
          <div className="relative">
            <pre className="font-mono text-xs bg-gray-100 dark:bg-gray-700 rounded-xl p-3 overflow-x-auto text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-all">{mcpConfig}</pre>
            <button
              onClick={copyConfig}
              className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 text-xs font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-500 transition-colors"
            >
              {configCopied ? <CheckCircle2 size={12} /> : <Copy size={12} />}
              {configCopied ? t('apiTokens.reveal.copied') : t('apiTokens.reveal.copy')}
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            <Trans i18nKey="apiTokens.reveal.configDesc">
              Add this to your <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">claude_desktop_config.json</code> under <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">mcpServers</code>.
            </Trans>
          </p>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition-colors"
        >
          {t('apiTokens.reveal.done')}
        </button>
      </div>
    </div>
  );
}

interface TokenRowProps {
  token: ApiToken;
  onRevoke: (id: string) => void;
}

function TokenRow({ token, onRevoke }: TokenRowProps): JSX.Element {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);

  const formatDate = (ts: Timestamp | null | undefined): string => {
    if (!ts) return t('apiTokens.row.never');
    const date = ts.toDate?.();
    if (!date) return t('apiTokens.row.never');
    return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{token.name}</span>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded font-mono">{token.tokenPrefix}…</code>
          <span>·</span>
          <span>{t('apiTokens.row.createdAt', { date: formatDate(token.createdAt) })}</span>
          <span>·</span>
          <span>{t('apiTokens.row.lastUsedAt', { date: formatDate(token.lastUsedAt) })}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-1">
          {token.scopes.map(scope => (
            <span key={scope} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">
              {t(`apiTokens.scopes.${scope}`)}
            </span>
          ))}
        </div>
      </div>
      <div className="shrink-0">
        {confirming ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-600 dark:text-red-400 font-medium">{t('apiTokens.row.revokeConfirm')}</span>
            <button
              onClick={() => { onRevoke(token.id); setConfirming(false); }}
              className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold transition-colors"
            >
              {t('apiTokens.row.revokeYes')}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="px-3 py-1.5 rounded-xl border border-gray-300 dark:border-gray-600 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {t('apiTokens.row.cancel')}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs font-medium transition-colors"
          >
            <Trash2 size={13} />
            {t('apiTokens.row.revoke')}
          </button>
        )}
      </div>
    </div>
  );
}

export default function ApiTokenManager(): JSX.Element {
  const { t } = useTranslation();
  const { tokens, loading, createToken, revokeToken } = useApiTokens();
  const [showForm, setShowForm] = useState(false);
  const [tokenName, setTokenName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<Set<TokenScope>>(new Set(['read:logs', 'read:vehicles']));
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealToken, setRevealToken] = useState<string | null>(null);

  const toggleScope = (scope: TokenScope) => {
    setSelectedScopes(prev => {
      const next = new Set(prev);
      next.has(scope) ? next.delete(scope) : next.add(scope);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!tokenName.trim()) { setError(t('apiTokens.errors.enterName')); return; }
    if (selectedScopes.size === 0) { setError(t('apiTokens.errors.selectScope')); return; }
    setCreating(true); setError(null);
    try {
      const raw = await createToken(tokenName.trim(), [...selectedScopes]);
      setRevealToken(raw);
      setTokenName('');
      setSelectedScopes(new Set(['read:logs', 'read:vehicles']));
      setShowForm(false);
    } catch (err: any) {
      if (err?.code === 'permission-denied') {
        setError(t('apiTokens.errors.permissionDenied'));
      } else {
        setError(t('apiTokens.errors.failedCreate'));
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      {revealToken && <TokenRevealModal rawToken={revealToken} onClose={() => setRevealToken(null)} />}

      <div className="rounded-3xl shadow-xl border border-gray-200/80 dark:border-gray-700/80 bg-white dark:bg-gray-800 overflow-hidden">
        <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-indigo-50 dark:bg-indigo-900/30">
              <Key size={20} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900 dark:text-gray-100">{t('apiTokens.title')}</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('apiTokens.subtitle')}</p>
            </div>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition-colors shrink-0"
            >
              <Plus size={16} />
              {t('apiTokens.newToken')}
            </button>
          )}
        </div>

        <div className="p-6 space-y-5">
          {showForm && (
            <div className="rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 p-4 space-y-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">{t('apiTokens.createToken')}</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">{t('apiTokens.tokenName')}</label>
                <input
                  type="text"
                  value={tokenName}
                  onChange={e => setTokenName(e.target.value)}
                  placeholder={t('apiTokens.tokenNamePlaceholder')}
                  className="w-full px-3 py-2 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('apiTokens.permissions')}</label>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_SCOPES.map((scope: TokenScope) => (
                    <label key={scope} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedScopes.has(scope)}
                        onChange={() => toggleScope(scope)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{t(`apiTokens.scopes.${scope}`)}</span>
                    </label>
                  ))}
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle size={14} />
                  {error}
                </div>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-semibold transition-colors"
                >
                  {creating ? t('apiTokens.generating') : t('apiTokens.generate')}
                </button>
                <button
                  onClick={() => { setShowForm(false); setError(null); }}
                  className="px-4 py-2 rounded-2xl border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  {t('apiTokens.cancel')}
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-6 text-gray-400 dark:text-gray-500 text-sm">{t('apiTokens.loadingTokens')}</div>
          ) : tokens.length === 0 && !showForm ? (
            <div className="text-center py-8 space-y-3">
              <Key size={36} className="mx-auto text-gray-300 dark:text-gray-600" />
              <p className="font-medium text-gray-500 dark:text-gray-400">{t('apiTokens.noTokens')}</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 max-w-xs mx-auto">
                {t('apiTokens.noTokensSubtext')}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {tokens.map(token => (
                <TokenRow key={token.id} token={token} onRevoke={revokeToken} />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
