import { PostgrestError } from '@supabase/supabase-js';

interface QueryResult<T> {
  data: T | null;
  error: PostgrestError | Error | null;
}

interface QueryContext {
  operation: string;
  table?: string;
  filters?: Record<string, unknown>;
}

const queryErrors: Array<{ context: QueryContext; error: string; timestamp: Date }> = [];
const MAX_ERROR_LOG = 20;

export function logQueryError(context: QueryContext, error: PostgrestError | Error): void {
  const errorEntry = {
    context,
    error: error.message,
    timestamp: new Date(),
  };
  
  queryErrors.unshift(errorEntry);
  if (queryErrors.length > MAX_ERROR_LOG) {
    queryErrors.pop();
  }
  
  if (__DEV__) {
    console.error(`[DB Query Error] ${context.operation}${context.table ? ` on ${context.table}` : ''}:`, error.message);
    if (context.filters) {
      console.error('  Filters:', JSON.stringify(context.filters));
    }
  }
}

export function getRecentQueryErrors() {
  return [...queryErrors];
}

export function clearQueryErrors() {
  queryErrors.length = 0;
}

export async function safeQuery<T>(
  queryFn: () => Promise<{ data: T | null; error: PostgrestError | null }>,
  context: QueryContext
): Promise<QueryResult<T>> {
  try {
    const { data, error } = await queryFn();
    
    if (error) {
      logQueryError(context, error);
      return { data: null, error };
    }
    
    return { data, error: null };
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    logQueryError(context, error);
    return { data: null, error };
  }
}

export function ensureArray<T>(data: T | T[] | null | undefined): T[] {
  if (data === null || data === undefined) return [];
  return Array.isArray(data) ? data : [data];
}

export function ensureSingle<T>(data: T | T[] | null | undefined): T | null {
  if (data === null || data === undefined) return null;
  return Array.isArray(data) ? data[0] ?? null : data;
}

export function isValidUuid(id: string | null | undefined): boolean {
  if (!id) return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}
