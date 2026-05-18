import React from 'react';
import { Badge } from './Badge';
import { STATUS_BADGE_COLORS } from '@/utils/constants';
import { getStatusLabel } from '@/utils/formatters';
import type { InvoiceStatus } from '@/types';

interface StatusBadgeProps {
  status: InvoiceStatus;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  return (
    <Badge color={STATUS_BADGE_COLORS[status] ?? 'gray'} size={size} dot>
      {getStatusLabel(status)}
    </Badge>
  );
}

export default StatusBadge;
