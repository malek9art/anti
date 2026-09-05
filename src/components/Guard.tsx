import type { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { ForbiddenState, LoadingState } from './States';

export function Guard({ permission, children }: { permission?: string; children: ReactNode }) {
  const { loading, can } = useAuth();
  if (loading) return <LoadingState />;
  if (permission && !can(permission)) return <ForbiddenState permission={permission} />;
  return <>{children}</>;
}
