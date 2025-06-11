import { JSX } from 'react';
import NavigationBar from './NavigationBar';
import Footer from './Footer';
import AppRoutes from '../Routes';



function AuthenticatedApp(): JSX.Element {
  return (<>
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <NavigationBar />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <AppRoutes />
      </main>
      <Footer />
    </div>
  </>);
}

export default AuthenticatedApp;