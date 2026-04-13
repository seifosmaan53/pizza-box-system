import { useState, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { User, Lock, Save } from 'lucide-react';
import { authApi } from '@/api/auth';
import { useAuthStore } from '@/store/auth';
import PageHeader from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { formatDateTime } from '@/utils/formatters';

export default function Profile() {
  const { user, setUser } = useAuthStore();
  const [profileForm, setProfileForm] = useState({
    firstName: user?.firstName ?? '',
    lastName: user?.lastName ?? '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (user) {
      setProfileForm({ firstName: user.firstName, lastName: user.lastName });
    }
  }, [user]);

  const profileMutation = useMutation({
    mutationFn: () => authApi.updateProfile(profileForm),
    onSuccess: (updated) => {
      setUser({ ...user!, firstName: updated.firstName, lastName: updated.lastName });
      toast.success('Profile updated');
    },
    onError: (e: { message?: string }) => toast.error(e.message || 'Failed to update profile'),
  });

  const passwordMutation = useMutation({
    mutationFn: () => authApi.changePassword(passwordForm.currentPassword, passwordForm.newPassword),
    onSuccess: () => {
      toast.success('Password changed successfully');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    },
    onError: (e: { message?: string }) => toast.error(e.message || 'Failed to change password'),
  });

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (!/[A-Z]/.test(passwordForm.newPassword)) {
      toast.error('Password must contain at least one uppercase letter');
      return;
    }
    if (!/[0-9]/.test(passwordForm.newPassword)) {
      toast.error('Password must contain at least one number');
      return;
    }
    passwordMutation.mutate();
  };

  const roleColor: Record<string, 'red' | 'blue' | 'gray'> = {
    ADMIN: 'red',
    MANAGER: 'blue',
    VIEWER: 'gray',
  };

  return (
    <div>
      <PageHeader title="My Profile" breadcrumbs={[{ label: 'Profile' }]} />

      <div className="max-w-2xl space-y-6">
        {/* Account Info */}
        <Card header={
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-gray-500" />
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Account Information</h2>
          </div>
        }>
          <div className="space-y-4">
            <div className="flex items-center gap-4 pb-4 border-b border-gray-100 dark:border-gray-800">
              <div className="h-14 w-14 rounded-full bg-red-600 flex items-center justify-center text-white text-xl font-bold shrink-0">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">{user?.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge color={roleColor[user?.role ?? 'VIEWER'] ?? 'gray'}>{user?.role}</Badge>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="First Name"
                value={profileForm.firstName}
                onChange={(e) => setProfileForm((f) => ({ ...f, firstName: e.target.value }))}
              />
              <Input
                label="Last Name"
                value={profileForm.lastName}
                onChange={(e) => setProfileForm((f) => ({ ...f, lastName: e.target.value }))}
              />
            </div>

            <div className="flex justify-end">
              <Button
                size="sm"
                loading={profileMutation.isPending}
                onClick={() => profileMutation.mutate()}
                disabled={
                  profileForm.firstName === user?.firstName &&
                  profileForm.lastName === user?.lastName
                }
              >
                <Save className="h-3.5 w-3.5 mr-1.5" />
                Save Changes
              </Button>
            </div>
          </div>
        </Card>

        {/* Change Password */}
        <Card header={
          <div className="flex items-center gap-2">
            <Lock className="h-4 w-4 text-gray-500" />
            <h2 className="font-semibold text-gray-900 dark:text-gray-100">Change Password</h2>
          </div>
        }>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <Input
              label="Current Password"
              type="password"
              value={passwordForm.currentPassword}
              onChange={(e) => setPasswordForm((f) => ({ ...f, currentPassword: e.target.value }))}
              required
            />
            <Input
              label="New Password"
              type="password"
              value={passwordForm.newPassword}
              onChange={(e) => setPasswordForm((f) => ({ ...f, newPassword: e.target.value }))}
              required
              helperText="Min 8 characters, 1 uppercase letter, 1 number"
            />
            <Input
              label="Confirm New Password"
              type="password"
              value={passwordForm.confirmPassword}
              onChange={(e) => setPasswordForm((f) => ({ ...f, confirmPassword: e.target.value }))}
              required
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                loading={passwordMutation.isPending}
                disabled={!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword}
              >
                <Lock className="h-3.5 w-3.5 mr-1.5" />
                Change Password
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
