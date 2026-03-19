import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useRemoteConfig } from '../context/RemoteConfigContext';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../context/AuthContext';

const AboutPage: React.FC = () => {
  const { getBoolean } = useRemoteConfig();
  const { t } = useTranslation();
  const { user } = useAuth();

  return (
    <>
      <Helmet>
        <title>{t('about.title')}</title>
        <meta name="description" content={t('about.description')} />
      </Helmet>
      <div className="container mx-auto py-8 dark:bg-gray-900 dark:text-gray-100">
        <h1 className="text-3xl font-bold text-center mb-4 dark:text-white">{t('about.title')}</h1>
        <p className="text-lg mb-4 dark:text-gray-300">{t('about.description')}</p>
        <h2 className="text-2xl font-semibold mb-2 dark:text-gray-200">{t('about.featuresTitle')}</h2>
        <ul className="list-disc list-inside dark:text-gray-300">
          <li>{t('about.features.track')}</li>
          <li>{t('about.features.history')}</li>
          <li>{t('about.features.import')}</li>
          <li>{t('about.features.quickLog')}</li>
        </ul>

        {getBoolean("exampleFeatureFlagEnabled") && (
          <div className="mt-6 p-4 border border-blue-300 dark:border-blue-700 rounded-md bg-blue-50 dark:bg-blue-900">
            <h3 className="text-xl font-semibold text-blue-700 dark:text-blue-300 mb-2">🚀 New Feature Showcase!</h3>
            <p className="text-blue-600 dark:text-blue-200">
              This section is displayed because the 'exampleFeatureFlagEnabled' is currently active in Remote Config!
            </p>
          </div>
        )}

        <div className="mt-8 text-center text-gray-500 dark:text-gray-400 text-sm">
          <p>
            {user ? (
              <Link to="/" className="text-indigo-600 dark:text-indigo-400 hover:underline">
                Go to Dashboard
              </Link>
            ) : (
              <>
                {t('about.loginPrompt')}{' '}
                <Link to="/" className="text-indigo-600 dark:text-indigo-400 hover:underline">{t('about.login')}</Link>
                .
              </>
            )}
          </p>
        </div>
      </div>
    </>
  );
};

export default AboutPage;
