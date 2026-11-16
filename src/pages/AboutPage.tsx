import React from 'react';
import { Helmet } from 'react-helmet-async';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const AboutPage: React.FC = () => {
  const { t } = useTranslation();

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


        <div className="mt-8 text-center text-gray-500 dark:text-gray-400 text-sm">
          <p>
            {t('about.loginPrompt')}{' '}
            <Link to="/" className="text-indigo-600 dark:text-indigo-400 hover:underline">{t('about.login')}</Link>
            .
          </p>
        </div>
      </div>
    </>
  );
};

export default AboutPage;
