/**
 * Toast hook - Wrapper around sonner for compatibility with shadcn/ui toast API
 */

import { toast as sonnerToast } from 'sonner';

export interface ToastProps {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

const toast = ({ title, description, variant }: ToastProps) => {
  if (variant === 'destructive') {
    sonnerToast.error(title || 'Error', {
      description,
    });
  } else {
    sonnerToast.success(title || 'Success', {
      description,
    });
  }
};

// Consumers use `toast` as an effect/callback dependency. Returning the same
// object and function on every render prevents those effects from restarting
// just because the compatibility wrapper rendered again.
const toastApi = { toast };

export function useToast() {
  return toastApi;
}
