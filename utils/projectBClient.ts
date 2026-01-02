op, // utils/projectBClient.ts
// Helper to call Project B via Edge Function proxy

import { supabase } from './supabase'

export interface ProjectBQuery {
  action: 'select' | 'insert' | 'update' | 'delete' | 'rpc'
  table: string
  query: {
    select?: string
    match?: Record<string, any>
    data?: Record<string, any> | Record<string, any>[]
    limit?: number
    function?: string
    params?: Record<string, any>
  }
}

export async function callProjectB<T = any>(
  query: ProjectBQuery
): Promise<{ data: T | null; error: Error | null }> {
  try {
    const { data, error } = await supabase.functions.invoke('project-b-proxy', {
      body: query
    })

    if (error) {
      return { data: null, error }
    }

    return { data: data.data, error: null }
  } catch (error) {
    return { 
      data: null, 
      error: error instanceof Error ? error : new Error('Unknown error') 
    }
  }
}

// Example usage functions

export async function getProjectBUsers() {
  return callProjectB({
    action: 'select',
    table: 'users',
    query: {
      select: 'id, email, created_at',
      limit: 100
    }
  })
}

export async function createProjectBRecord(table: string, data: Record<string, any>) {
  return callProjectB({
    action: 'insert',
    table,
    query: { data }
  })
}

export async function callProjectBRPC(functionName: string, params: Record<string, any>) {
  return callProjectB({
    action: 'rpc',
    table: '', // not used for RPC
    query: {
      function: functionName,
      params
    }
  })
}
