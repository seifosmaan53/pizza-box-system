import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Store,
  Package,
  Warehouse,
  Box,
  Layers,
  FileText,
  BarChart2,
  Settings,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Pizza,
  X,
  Building2,
  ShoppingBag,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useUIStore } from '@/store/ui';
import { useAuthStore } from '@/store/auth';
import { Tooltip } from '@/components/ui/Tooltip';

type MinRole = 'VIEWER' | 'MANAGER' | 'ADMIN';

interface NavItem {
  label: string;
  href?: string;
  icon: React.ReactNode;
  minRole?: MinRole;
  children?: NavItem[];
}

const ROLE_LEVEL: Record<string, number> = { VIEWER: 0, MANAGER: 1, ADMIN: 2 };

function hasAccess(userRole: string, minRole?: MinRole): boolean {
  return (ROLE_LEVEL[userRole] ?? 0) >= (ROLE_LEVEL[minRole ?? 'VIEWER'] ?? 0);
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: <LayoutDashboard className="h-4 w-4" /> },
  { label: 'Stores', href: '/stores', icon: <Store className="h-4 w-4" /> },
  {
    label: 'Inventory',
    icon: <Package className="h-4 w-4" />,
    children: [
      { label: 'Warehouse View', href: '/inventory/warehouse', icon: <Warehouse className="h-4 w-4" /> },
      { label: 'Store View', href: '/inventory/stores', icon: <Building2 className="h-4 w-4" /> },
      { label: 'Products', href: '/inventory/products', icon: <ShoppingBag className="h-4 w-4" /> },
      { label: 'Box Types', href: '/inventory/box-types', icon: <Box className="h-4 w-4" />, minRole: 'MANAGER' },
      { label: 'Box Sizes', href: '/inventory/box-sizes', icon: <Layers className="h-4 w-4" />, minRole: 'MANAGER' },
    ],
  },
  { label: 'Invoices', href: '/invoices', icon: <FileText className="h-4 w-4" /> },
  { label: 'Analytics', href: '/analytics', icon: <BarChart2 className="h-4 w-4" /> },
  { label: 'Settings', href: '/settings', icon: <Settings className="h-4 w-4" />, minRole: 'ADMIN' },
];

interface SidebarLinkProps {
  item: NavItem;
  collapsed: boolean;
  depth?: number;
}

function SidebarLink({ item, collapsed, depth = 0 }: SidebarLinkProps) {
  const location = useLocation();
  const [expanded, setExpanded] = useState(() => {
    if (!item.children) return false;
    return item.children.some((c) => c.href && location.pathname.startsWith(c.href));
  });

  if (item.children) {
    const isActive = item.children.some((c) => c.href && location.pathname.startsWith(c.href));
    if (collapsed) {
      return (
        <div>
          {item.children.map((child) => (
            <SidebarLink key={child.href} item={child} collapsed={collapsed} depth={depth + 1} />
          ))}
        </div>
      );
    }
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          className={cn(
            'sidebar-link w-full justify-between',
            isActive && !expanded && 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          )}
        >
          <span className="flex items-center gap-3">
            {item.icon}
            <span>{item.label}</span>
          </span>
          <ChevronDown
            className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')}
          />
        </button>
        {expanded && (
          <div className="ml-4 mt-0.5 space-y-0.5 border-l border-gray-200 dark:border-gray-700 pl-3">
            {item.children.map((child) => (
              <SidebarLink key={child.href} item={child} collapsed={false} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  const linkContent = (
    <NavLink
      to={item.href!}
      end={item.href === '/'}
      className={({ isActive }) =>
        cn(
          'sidebar-link',
          isActive && 'active',
          collapsed && 'justify-center px-2'
        )
      }
    >
      {item.icon}
      {!collapsed && <span>{item.label}</span>}
    </NavLink>
  );

  if (collapsed) {
    return (
      <Tooltip content={item.label} position="right">
        {linkContent}
      </Tooltip>
    );
  }

  return linkContent;
}

interface SidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const userRole = useAuthStore((s) => s.user?.role ?? 'VIEWER');

  // Filter nav items by user role
  const filteredNav = navItems
    .filter((item) => hasAccess(userRole, item.minRole))
    .map((item) => {
      if (!item.children) return item;
      const filteredChildren = item.children.filter((child) => hasAccess(userRole, child.minRole));
      return filteredChildren.length > 0 ? { ...item, children: filteredChildren } : null;
    })
    .filter(Boolean) as NavItem[];

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onMobileClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full z-50 flex flex-col bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 transition-all duration-300',
          // Desktop
          'lg:static lg:z-auto',
          sidebarCollapsed ? 'lg:w-[60px]' : 'lg:w-60',
          // Mobile
          mobileOpen ? 'w-60 translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            'flex items-center h-16 border-b border-gray-200 dark:border-gray-700 px-4 shrink-0',
            sidebarCollapsed ? 'justify-center' : 'gap-3'
          )}
        >
          <div className="bg-red-600 p-1.5 rounded-lg shrink-0">
            <Pizza className="h-5 w-5 text-white" />
          </div>
          {!sidebarCollapsed && (
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-gray-900 dark:text-gray-100 leading-tight">
                Pizza Box
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-tight">Manager</p>
            </div>
          )}
          {/* Mobile close */}
          <button
            onClick={onMobileClose}
            className="ml-auto lg:hidden p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {filteredNav.map((item) => (
            <SidebarLink
              key={item.label}
              item={item}
              collapsed={sidebarCollapsed}
            />
          ))}
        </nav>

        {/* Version + Collapse toggle — desktop only */}
        <div className="hidden lg:block p-2 border-t border-gray-200 dark:border-gray-700">
          {!sidebarCollapsed && (
            <p className="text-[10px] text-gray-400 dark:text-gray-600 text-center mb-1">v1.0.0</p>
          )}
          <button
            onClick={toggleSidebar}
            className={cn(
              'sidebar-link w-full',
              sidebarCollapsed && 'justify-center px-2'
            )}
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <>
                <ChevronLeft className="h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
