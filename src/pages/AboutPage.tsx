import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { getBoolean } from '../firebase/remoteConfigService'; // Import the getter

const AboutPage: React.FC = () => (
  <>
    <Helmet>
      <title>About Fuel Tracker</title>
      <meta name="description" content="Learn more about Fuel Tracker, a web app for tracking fuel consumption and costs." />
    </Helmet>
    <div className="container mx-auto py-8 dark:bg-gray-900 dark:text-gray-100">
      <h1 className="text-3xl font-bold text-center mb-4 dark:text-white">About Fuel Tracker</h1>
      <p className="text-lg mb-4 dark:text-gray-300">Fuel Tracker is a web app that helps you track your fuel consumption and costs.</p>
      <h2 className="text-2xl font-semibold mb-2 dark:text-gray-200">Features</h2>
      <ul className="list-disc list-inside dark:text-gray-300">
        <li>Track fuel consumption and costs</li>
        <li>View history of fuel logs</li>
        <li>Import fuel logs from a CSV file</li>
        <li>Quickly log fuel purchases</li>
      </ul>

      {/* Example Feature Flag Usage */}
      {getBoolean("exampleFeatureFlagEnabled") && (
        <div className="mt-6 p-4 border border-blue-300 dark:border-blue-700 rounded-md bg-blue-50 dark:bg-blue-900">
          <h3 className="text-xl font-semibold text-blue-700 dark:text-blue-300 mb-2">🚀 New Feature Showcase!</h3>
          <p className="text-blue-600 dark:text-blue-200">
            This section is displayed because the 'exampleFeatureFlagEnabled' is currently active in Remote Config!
            You can toggle this in the Firebase console to see it appear or disappear after the app fetches the latest config.
          </p>
        </div>
      )}

      <div className="mt-8 text-center text-gray-500 dark:text-gray-400 text-sm">
        <p>
          To access more features, please{' '}
          <Link to="/" className="text-indigo-600 dark:text-indigo-400 hover:underline">log in</Link>
          .
        </p>
      </div>
    </div>
  </>
);

export default AboutPage;