import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/utils/cn';

export interface Breadcrumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  breadcrumbs?: Breadcrumb[];
  actions?: React.ReactNode;
  description?: string;
  className?: string;
}

export function PageHeader({ title, breadcrumbs, actions, description, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-6', className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 mb-2">
          <Link to="/" className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
            <Home className="h-3.5 w-3.5" />
          </Link>
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={i}>
              <ChevronRight className="h-3 w-3" />
              {crumb.href && i < breadcrumbs.length - 1 ? (
                <Link
                  to={crumb.href}
                  className="hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                >
                  {crumb.label}
                </Link>
              ) : (
                <span className={i === breadcrumbs.length - 1 ? 'text-gray-700 dark:text-gray-300 font-medium' : ''}>
                  {crumb.label}
                </span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

export default PageHeader;
