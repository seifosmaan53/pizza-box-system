import api from '@/lib/axios';

export async function getUsers(params?: Record<string, unknown>) {
  const { data } = await api.get('/users', { params });
  return data;
}

export async function getUser(id: string) {
  const { data } = await api.get(`/users/${id}`);
  return data;
}

export async function createUser(body: {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  password: string;
}) {
  const { data } = await api.post('/users', body);
  return data;
}

export async function updateUser(id: string, body: { firstName?: string; lastName?: string; role?: string }) {
  const { data } = await api.put(`/users/${id}`, body);
  return data;
}

export async function deactivateUser(id: string) {
  const { data } = await api.patch(`/users/${id}/deactivate`);
  return data;
}

export async function reactivateUser(id: string) {
  const { data } = await api.patch(`/users/${id}/reactivate`);
  return data;
}

export async function deleteUser(id: string) {
  const { data } = await api.delete(`/users/${id}`);
  return data;
}
