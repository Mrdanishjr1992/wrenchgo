import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface SupportRequestPayload {
  category: string;
  message: string;
  job_id?: string;
  screenshot_url?: string;
  metadata?: {
    platform?: string;
    app_version?: string;
    device_model?: string;
    role?: string;
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const payload: SupportRequestPayload = await req.json();

    if (!payload.category || !payload.message) {
      throw new Error('Missing required fields: category and message');
    }

    const validCategories = [
      'payments_refunds',
      'job_issue',
      'account_login',
      'bug_app_problem',
      'other',
    ];

    if (!validCategories.includes(payload.category)) {
      throw new Error('Invalid category');
    }

    const metadata = {
      platform: payload.metadata?.platform || 'unknown',
      app_version: payload.metadata?.app_version || 'unknown',
      device_model: payload.metadata?.device_model || 'unknown',
      role: payload.metadata?.role || 'unknown',
    };

    const { data: supportRequest, error: insertError } = await supabaseClient
      .from('support_requests')
      .insert({
        user_id: user.id,
        category: payload.category,
        message: payload.message,
        job_id: payload.job_id || null,
        screenshot_url: payload.screenshot_url || null,
        metadata,
        status: 'open',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      throw new Error(`Failed to create support request: ${insertError.message}`);
    }

    if (RESEND_API_KEY) {
      try {
        const categoryLabels: Record<string, string> = {
          payments_refunds: 'Payments & Refunds',
          job_issue: 'Job Issue',
          account_login: 'Account / Login',
          bug_app_problem: 'Bug / App Problem',
          other: 'Other',
        };

        const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #3b82f6; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background-color: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; }
    .field { margin-bottom: 15px; }
    .label { font-weight: bold; color: #6b7280; }
    .value { margin-top: 5px; }
    .metadata { background-color: #fff; padding: 15px; border-radius: 6px; margin-top: 15px; }
    .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>🔧 New Support Request - WrenchGo</h2>
    </div>
    <div class="content">
      <div class="field">
        <div class="label">Category:</div>
        <div class="value">${categoryLabels[payload.category] || payload.category}</div>
      </div>
      
      <div class="field">
        <div class="label">Message:</div>
        <div class="value">${payload.message.replace(/\n/g, '<br>')}</div>
      </div>
      
      <div class="field">
        <div class="label">User ID:</div>
        <div class="value">${user.id}</div>
      </div>
      
      ${user.email ? `
      <div class="field">
        <div class="label">User Email:</div>
        <div class="value">${user.email}</div>
      </div>
      ` : ''}
      
      ${payload.job_id ? `
      <div class="field">
        <div class="label">Job ID:</div>
        <div class="value">${payload.job_id}</div>
      </div>
      ` : ''}
      
      ${payload.screenshot_url ? `
      <div class="field">
        <div class="label">Screenshot:</div>
        <div class="value"><a href="${payload.screenshot_url}">View Screenshot</a></div>
      </div>
      ` : ''}
      
      <div class="metadata">
        <div class="label">Metadata:</div>
        <div class="value">
          <strong>Platform:</strong> ${metadata.platform}<br>
          <strong>App Version:</strong> ${metadata.app_version}<br>
          <strong>Device:</strong> ${metadata.device_model}<br>
          <strong>Role:</strong> ${metadata.role}
        </div>
      </div>
      
      <div class="field" style="margin-top: 20px;">
        <div class="label">Request ID:</div>
        <div class="value">${supportRequest.id}</div>
      </div>
      
      <div class="field">
        <div class="label">Created At:</div>
        <div class="value">${new Date(supportRequest.created_at).toLocaleString()}</div>
      </div>
    </div>
    <div class="footer">
      This is an automated notification from WrenchGo Support System
    </div>
  </div>
</body>
</html>
        `;

        const emailResponse = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${RESEND_API_KEY}`,
          },
          body: JSON.stringify({
            from: 'WrenchGo Support <no-reply@wrenchgoapp.com>',
            to: ['support@wrenchgoapp.com'],
            subject: `[${categoryLabels[payload.category]}] New Support Request #${supportRequest.id.slice(0, 8)}`,
            html: emailHtml,
          }),
        });

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text();
          console.error('Email send failed:', errorText);
        }
      } catch (emailError) {
        console.error('Email error (non-fatal):', emailError);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        request_id: supportRequest.id,
        message: 'Support request submitted successfully',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
