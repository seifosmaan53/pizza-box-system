import type { Blocker } from 'react-router-dom';

interface Props {
  blocker: Blocker;
}

export function UnsavedChangesDialog({ blocker }: Props) {
  if (blocker.state !== 'blocked') return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-sm w-full mx-4 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Unsaved Changes
        </h3>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          You have unsaved changes that will be lost if you leave this page. Are you sure you want to continue?
        </p>
        <div className="mt-5 flex gap-3 justify-end">
          <button
            onClick={() => blocker.reset?.()}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Stay on Page
          </button>
          <button
            onClick={() => blocker.proceed?.()}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
          >
            Leave Page
          </button>
        </div>
      </div>
    </div>
  );
}
