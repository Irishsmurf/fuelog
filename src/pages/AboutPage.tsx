  import React from 'react';
import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';

const AboutPage: React.FC = () => (
  <>
    <Helmet>
      <title>About Fuel Tracker</title>
      <meta name="description" content="Learn more about Fuel Tracker, a web app for tracking fuel consumption and costs." />
    </Helmet>
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold text-center mb-4">About Fuel Tracker</h1>
      <p className="text-lg mb-4">Fuel Tracker is a web app that helps you track your fuel consumption and costs.</p>
      <h2 className="text-2xl font-semibold mb-2">Features</h2>
      <ul className="list-disc list-inside">
        <li>Track fuel consumption and costs</li>
        <li>View history of fuel logs</li>
        <li>Import fuel logs from a CSV file</li>
        <li>Quickly log fuel purchases</li>
      </ul>
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