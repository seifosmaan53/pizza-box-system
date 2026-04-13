import { Link } from 'react-router-dom';
import { Pizza, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
      <div className="bg-red-100 dark:bg-red-900/30 p-4 rounded-full mb-6">
        <Pizza className="h-12 w-12 text-red-600 dark:text-red-400" />
      </div>
      <h1 className="text-5xl font-bold text-gray-900 dark:text-white">404</h1>
      <p className="mt-3 text-lg text-gray-500 dark:text-gray-400">
        Page not found
      </p>
      <p className="mt-1 text-sm text-gray-400 dark:text-gray-500 max-w-md">
        The page you're looking for doesn't exist or has been moved.
      </p>
      <Link
        to="/"
        className="mt-8 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>
    </div>
  );
}
