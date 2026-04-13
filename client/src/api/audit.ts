import api from '@/lib/axios';

export async function getAuditLog(params?: {
  userId?: string;
  entityType?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}) {
  const { data } = await api.get('/audit-log', { params });
  return data;
}

export async function getEntityAuditLog(entityType: string, entityId: string) {
  const { data } = await api.get(`/audit-log/${entityType}/${entityId}`);
  return data;
}
