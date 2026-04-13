import { Link } from 'react-router-dom';
import { CheckCircle, Circle, Store, Package, FileText, ArrowRight } from 'lucide-react';

interface Step {
  label: string;
  description: string;
  done: boolean;
  href: string;
  icon: React.ReactNode;
}

interface Props {
  storeCount: number;
  inventoryCount: number;
  invoiceCount: number;
}

export function OnboardingChecklist({ storeCount, inventoryCount, invoiceCount }: Props) {
  const steps: Step[] = [
    {
      label: 'Create your first store',
      description: 'Add a store location to start managing inventory',
      done: storeCount > 0,
      href: '/stores',
      icon: <Store className="h-4 w-4" />,
    },
    {
      label: 'Add inventory items',
      description: 'Stock your store with box types and products',
      done: inventoryCount > 0,
      href: '/inventory/warehouse',
      icon: <Package className="h-4 w-4" />,
    },
    {
      label: 'Create your first invoice',
      description: 'Generate and send an invoice to a store',
      done: invoiceCount > 0,
      href: '/invoices/create',
      icon: <FileText className="h-4 w-4" />,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;

  // Hide once all steps are done
  if (completedCount === steps.length) return null;

  return (
    <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 border border-red-200 dark:border-red-800/50 rounded-2xl p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">Getting Started</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Complete these steps to set up your business
          </p>
        </div>
        <div className="text-sm font-medium text-red-600 dark:text-red-400">
          {completedCount}/{steps.length}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1.5 bg-red-100 dark:bg-red-900/30 rounded-full mb-4">
        <div
          className="h-full bg-red-500 rounded-full transition-all duration-500"
          style={{ width: `${(completedCount / steps.length) * 100}%` }}
        />
      </div>

      <div className="space-y-2">
        {steps.map((step) => (
          <Link
            key={step.label}
            to={step.done ? '#' : step.href}
            className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
              step.done
                ? 'bg-white/50 dark:bg-gray-800/30 opacity-60'
                : 'bg-white dark:bg-gray-800 hover:bg-white/80 dark:hover:bg-gray-700/50 shadow-sm'
            }`}
          >
            <div className={`shrink-0 ${step.done ? 'text-green-500' : 'text-gray-400'}`}>
              {step.done ? <CheckCircle className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${step.done ? 'line-through text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                {step.label}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{step.description}</p>
            </div>
            {!step.done && (
              <ArrowRight className="h-4 w-4 text-gray-400 shrink-0" />
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
