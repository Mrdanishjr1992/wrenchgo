import { Colors } from '../ui/theme';

export function getStatusColor(status: string, colors: Colors): string {
  const statusMap: Record<string, keyof Colors> = {
    // Verification statuses
    pending_verification: 'warning',
    active: 'success',
    paused: 'textMuted',
    removed: 'error',
    
    // Job statuses
    pending: 'warning',
    quoted: 'primary',
    accepted: 'primary',
    in_progress: 'primary',
    completed: 'success',
    canceled: 'error',
    cancelled: 'error',
    
    // Payment/Payout statuses
    processing: 'primary',
    failed: 'error',
    refunded: 'secondary',
    
    // Support statuses
    open: 'warning',
    resolved: 'success',
    
    // Trust tiers
    probation: 'warning',
    standard: 'primary',
    trusted: 'success',
  };

  const colorKey = statusMap[status.toLowerCase()];
  if (colorKey && colors[colorKey]) {
    return colors[colorKey] as string;
  }
  return colors.textMuted;
}

export function getCategoryColor(category: string, colors: Colors): string {
  const categoryMap: Record<string, keyof Colors> = {
    payments_refunds: 'error',
    job_issue: 'warning',
    account_login: 'primary',
    bug_app_problem: 'secondary',
    other: 'textMuted',
  };

  const colorKey = categoryMap[category.toLowerCase()];
  if (colorKey && colors[colorKey]) {
    return colors[colorKey] as string;
  }
  return colors.textMuted;
}