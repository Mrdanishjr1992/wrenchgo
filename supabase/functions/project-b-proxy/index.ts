import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const projectBUrl = Deno.env.get('PROJECT_B_URL')
    const projectBServiceKey = Deno.env.get('PROJECT_B_SERVICE_ROLE_KEY')

    if (!projectBUrl || !projectBServiceKey) {
      throw new Error('Project B credentials not configured')
    }

    const supabaseB = createClient(projectBUrl, projectBServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    const { action, table, query } = await req.json()

    let result

    switch (action) {
      case 'select':
        result = await supabaseB
          .from(table)
          .select(query.select || '*')
          .match(query.match || {})
          .limit(query.limit || 100)
        break

      case 'insert':
        result = await supabaseB
          .from(table)
          .insert(query.data)
          .select()
        break

      case 'update':
        result = await supabaseB
          .from(table)
          .update(query.data)
          .match(query.match)
          .select()
        break

      case 'delete':
        result = await supabaseB
          .from(table)
          .delete()
          .match(query.match)
        break

      case 'rpc':
        result = await supabaseB.rpc(query.function, query.params || {})
        break

      default:
        throw new Error(`Unsupported action: ${action}`)
    }

    if (result.error) {
      throw result.error
    }

    return new Response(
      JSON.stringify({ data: result.data }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})
