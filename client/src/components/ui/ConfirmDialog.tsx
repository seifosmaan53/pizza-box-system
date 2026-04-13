import React from 'react';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { Button } from './Button';

interface ConfirmDialogProps {
  isOpen?: boolean;
  onClose?: () => void;
  onCancel?: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  isLoading?: boolean;
  children?: React.ReactNode;
}

export function ConfirmDialog({
  isOpen = true,
  onClose,
  onCancel,
  onConfirm,
  title = 'Are you sure?',
  description = 'This action cannot be undone.',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  danger = false,
  isLoading = false,
  children,
}: ConfirmDialogProps) {
  const handleClose = onClose || onCancel || (() => {});
  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button
            variant={danger ? 'primary' : 'primary'}
            onClick={onConfirm}
            loading={isLoading}
            className={danger ? 'bg-red-600 hover:bg-red-700' : undefined}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="flex flex-col items-center text-center gap-4">
        <div
          className={`p-3 rounded-full ${
            danger
              ? 'bg-red-100 dark:bg-red-900/30'
              : 'bg-yellow-100 dark:bg-yellow-900/30'
          }`}
        >
          {danger ? (
            <Trash2 className="h-6 w-6 text-red-600 dark:text-red-400" />
          ) : (
            <AlertTriangle className="h-6 w-6 text-yellow-600 dark:text-yellow-400" />
          )}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">{title}</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
        </div>
        {children}
      </div>
    </Modal>
  );
}

export default ConfirmDialog;
