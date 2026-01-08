// Invite System for Ring-Based Launch
// Mechanics first, then customers. Never invert.

import { supabase } from './supabase';

export interface HubHealth {
  hubId: string;
  hubName: string;
  activeRadiusMiles: number;
  maxRadiusMiles: number;
  inviteOnly: boolean;
  currentRing: number;
  // 7-day metrics
  avgResponse7d: number | null;
  avgCompletion7d: number | null;
  jobs7d: number;
  completed7d: number;
  avgMechanics7d: number | null;
  utilization7d: number | null;
  complaints7d: number;
  noShows7d: number;
  // Waitlist
  ring0Waiting: number;
  ring1Waiting: number;
  ring2Waiting: number;
  ring3Waiting: number;
  // Health
  responseHealth: 'GREEN' | 'YELLOW' | 'RED';
  completionHealth: 'GREEN' | 'YELLOW' | 'RED';
}

export interface ExpansionCheck {
  canExpand: boolean;
  currentRing: number;
  nextRing: number;
  blockers: string[];
  metrics: {
    avgResponseMinutes: number | null;
    avgCompletionRate: number | null;
    avgActiveMechanics: number | null;
    totalComplaints: number | null;
    totalNoShows: number | null;
  };
}

export interface InviteResult {
  invitedCount: number;
  batchId: string;
}

// Get hub health dashboard
export async function getHubHealth(hubId?: string): Promise<HubHealth[]> {
  let query = supabase.from('hub_health_dashboard').select('*');
  if (hubId) {
    query = query.eq('hub_id', hubId);
  }
  
  const { data, error } = await query;
  if (error || !data) return [];
  
  return data.map((h: any) => ({
    hubId: h.hub_id,
    hubName: h.hub_name,
    activeRadiusMiles: h.active_radius_miles,
    maxRadiusMiles: h.max_radius_miles,
    inviteOnly: h.invite_only,
    currentRing: h.current_ring,
    avgResponse7d: h.avg_response_7d,
    avgCompletion7d: h.avg_completion_7d,
    jobs7d: h.jobs_7d || 0,
    completed7d: h.completed_7d || 0,
    avgMechanics7d: h.avg_mechanics_7d,
    utilization7d: h.utilization_7d,
    complaints7d: h.complaints_7d || 0,
    noShows7d: h.no_shows_7d || 0,
    ring0Waiting: h.ring_0_waiting || 0,
    ring1Waiting: h.ring_1_waiting || 0,
    ring2Waiting: h.ring_2_waiting || 0,
    ring3Waiting: h.ring_3_waiting || 0,
    responseHealth: h.response_health || 'GREEN',
    completionHealth: h.completion_health || 'GREEN',
  }));
}

// Check if hub can expand to next ring
export async function checkCanExpand(hubId: string): Promise<ExpansionCheck> {
  const { data, error } = await supabase
    .rpc('can_expand_ring', { p_hub_id: hubId })
    .single();
  
  if (error || !data) {
    return {
      canExpand: false,
      currentRing: 0,
      nextRing: 0,
      blockers: ['Failed to check expansion status'],
      metrics: {
        avgResponseMinutes: null,
        avgCompletionRate: null,
        avgActiveMechanics: null,
        totalComplaints: null,
        totalNoShows: null,
      },
    };
  }
  
  const d = data as any;
  return {
    canExpand: d.can_expand,
    currentRing: d.current_ring,
    nextRing: d.next_ring,
    blockers: d.blockers || [],
    metrics: {
      avgResponseMinutes: d.metrics?.avg_response_minutes,
      avgCompletionRate: d.metrics?.avg_completion_rate,
      avgActiveMechanics: d.metrics?.avg_active_mechanics,
      totalComplaints: d.metrics?.total_complaints,
      totalNoShows: d.metrics?.total_no_shows,
    },
  };
}

// Send invites for a ring
// IMPORTANT: Always send mechanic invites before customer invites!
export async function sendInvites(
  hubId: string,
  ring: number,
  userType: 'mechanic' | 'customer',
  batchSize: number = 10
): Promise<InviteResult> {
  // Enforce safe batch sizes
  const safeBatchSize = userType === 'mechanic' 
    ? Math.min(batchSize, 10) 
    : Math.min(batchSize, 25);
  
  const { data, error } = await supabase
    .rpc('send_ring_invites', {
      p_hub_id: hubId,
      p_ring: ring,
      p_user_type: userType,
      p_batch_size: safeBatchSize,
    })
    .single();
  
  if (error || !data) {
    console.error('Send invites error:', error);
    return { invitedCount: 0, batchId: '' };
  }
  
  const d = data as any;
  return {
    invitedCount: d.invited_count,
    batchId: d.invite_batch_id,
  };
}

// Accept an invite code
export async function acceptInvite(inviteCode: string): Promise<{
  success: boolean;
  message: string;
  userType?: string;
  hubName?: string;
}> {
  const { data, error } = await supabase
    .rpc('accept_invite', { p_invite_code: inviteCode })
    .single();
  
  if (error || !data) {
    return { success: false, message: 'Failed to verify invite' };
  }
  
  const d = data as any;
  return {
    success: d.success,
    message: d.message,
    userType: d.user_type,
    hubName: d.hub_name,
  };
}

// Expand hub to next ring (after checks pass)
export async function expandToNextRing(hubId: string): Promise<{
  success: boolean;
  newRadius: number;
  message: string;
}> {
  // First check if expansion is allowed
  const check = await checkCanExpand(hubId);
  
  if (!check.canExpand) {
    return {
      success: false,
      newRadius: 0,
      message: `Cannot expand: ${check.blockers.join(', ')}`,
    };
  }
  
  const newRadius = [25, 50, 75, 100][check.nextRing] || 100;
  
  const { error } = await supabase
    .from('service_hubs')
    .update({ active_radius_miles: newRadius })
    .eq('id', hubId);
  
  if (error) {
    return { success: false, newRadius: 0, message: 'Failed to update hub radius' };
  }
  
  return {
    success: true,
    newRadius,
    message: `Expanded to Ring ${check.nextRing} (${newRadius} miles)`,
  };
}

// Get decision matrix recommendation
export function getDecisionRecommendation(health: HubHealth): {
  action: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
} {
  // Response time increasing
  if (health.responseHealth === 'RED') {
    return {
      action: 'PAUSE_INVITES',
      reason: 'Response time too high (>25 min)',
      priority: 'high',
    };
  }
  
  // Completion dropping
  if (health.completionHealth === 'RED') {
    return {
      action: 'RECRUIT_SUPPLY',
      reason: 'Completion rate below 70%',
      priority: 'high',
    };
  }
  
  // Complaints spiking
  if (health.complaints7d > 5) {
    return {
      action: 'FREEZE_EXPANSION',
      reason: `${health.complaints7d} complaints in 7 days`,
      priority: 'high',
    };
  }
  
  // Yellow zone - caution
  if (health.responseHealth === 'YELLOW') {
    return {
      action: 'MONITOR',
      reason: 'Response time elevated (15-25 min)',
      priority: 'medium',
    };
  }
  
  // Supply idle
  if (health.utilization7d !== null && health.utilization7d < 1) {
    return {
      action: 'INVITE_CUSTOMERS',
      reason: 'Mechanics underutilized (<1 job/day)',
      priority: 'medium',
    };
  }
  
  // Supply strained
  if (health.utilization7d !== null && health.utilization7d > 5) {
    return {
      action: 'RECRUIT_SUPPLY',
      reason: 'Mechanics overloaded (>5 jobs/day)',
      priority: 'medium',
    };
  }
  
  // All green - can expand
  if (health.responseHealth === 'GREEN' && health.completionHealth === 'GREEN') {
    return {
      action: 'CAN_EXPAND',
      reason: 'Metrics stable - ready for next ring',
      priority: 'low',
    };
  }
  
  return {
    action: 'HOLD',
    reason: 'Insufficient data',
    priority: 'low',
  };
}

// Email/SMS templates
export const INVITE_TEMPLATES = {
  mechanic: {
    email: {
      subject: "You're invited to serve the {{hub_name}} area",
      body: `Hi {{first_name}},

We're opening access in the {{hub_name}} area and are inviting a small group of local mechanics first.

You were selected because your location and experience match current demand nearby.

What you'll get:
• Early access before public launch
• Fewer competitors, higher job visibility
• Control over how far you travel

Your invite expires in 72 hours.

👉 Activate your account: {{invite_link}}

— The WrenchGo Team`,
    },
    sms: "You're invited to serve jobs near {{hub_name}}. Early access, limited spots. Activate within 72 hours: {{invite_link}}",
  },
  customer: {
    email: {
      subject: "Now available near you ({{hub_name}})",
      body: `Hi {{first_name}},

We're starting to open access near {{hub_name}} and you're on the early list.

This is a limited rollout to ensure fast response times and quality service.

You can now request help from verified local professionals.

👉 Get started: {{invite_link}}

Thanks for being early — it helps us launch the right way.`,
    },
    sms: "We're now live near {{hub_name}}. Limited early access is open: {{invite_link}}",
  },
  waitlist: {
    email: {
      subject: "You're early — we'll notify you first",
      body: `We're not live in your area yet, but you're on the early list.

As soon as we open nearby, you'll be the first to know.

Thanks for helping us launch thoughtfully.`,
    },
  },
};
