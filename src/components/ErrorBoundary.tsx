import { Component, ErrorInfo, ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import { withTranslation, WithTranslation } from 'react-i18next';

interface Props extends WithTranslation {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
      pathname: typeof window !== 'undefined' ? window.location.pathname : 'unknown',
    });
    Sentry.captureException(error, { extra: { componentStack: info.componentStack } });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      const { t } = this.props;
      return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] p-8 text-center">
          <p className="text-2xl mb-2">⚠️</p>
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">
            {t('common.somethingWentWrong')}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {this.state.error?.message ?? t('common.unexpectedError')}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
          >
            {t('common.tryAgain')}
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default withTranslation()(ErrorBoundary);
