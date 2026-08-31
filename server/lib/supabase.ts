import { createClient, SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    const supabaseUrl =
      process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL;

    const supabaseServiceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      throw new Error(
        "[Supabase Server] SUPABASE_URL is required"
      );
    }

    if (!supabaseServiceKey) {
      throw new Error(
        "[Supabase Server] SUPABASE_SERVICE_ROLE_KEY is required"
      );
    }

    // Sanitize URL: @supabase/supabase-js expects the base URL.
    let sanitizedUrl = supabaseUrl.replace(/https?:\/\/https?:\/\//g, 'https://');
    sanitizedUrl = sanitizedUrl.replace(/\/rest\/v1\/?$/i, '');
    sanitizedUrl = sanitizedUrl.replace(/\/$/, '');

    supabaseInstance = createClient(
      sanitizedUrl,
      supabaseServiceKey
    );
  }
  return supabaseInstance;
}

// Export a Proxy that intercepts all property/method access on supabase to enforce lazy loading and automatic timeouts
function wrapThenableWithTimeout(obj: any, parent: any, ms: number = 8000): any {
  if (obj === null || obj === undefined) return obj;

  // If the object is a function, wrap it so its return value is wrapped, and bind the function
  if (typeof obj === 'function') {
    const boundFn = obj.bind(parent);
    return function (this: any, ...args: any[]) {
      const result = boundFn(...args);
      return wrapThenableWithTimeout(result, this || parent, ms);
    };
  }

  // If it's a thenable or contains thenable, use Proxy to intercept property accesses
  if (typeof obj === 'object') {
    return new Proxy(obj, {
      get: (target: any, prop: string | symbol) => {
        if (prop === 'then') {
          if (typeof target.then !== 'function') return undefined;
          return function (this: any, onfulfilled: any, onrejected: any) {
            const p = new Promise((resolve, reject) => {
              let completed = false;
              const timer = setTimeout(() => {
                if (!completed) {
                  completed = true;
                  reject(new Error(`Supabase operation timed out after ${ms}ms`));
                }
              }, ms);
              target.then.call(
                target,
                (res: any) => {
                  if (!completed) {
                    completed = true;
                    clearTimeout(timer);
                    resolve(res);
                  }
                },
                (err: any) => {
                  if (!completed) {
                    completed = true;
                    clearTimeout(timer);
                    reject(err);
                  }
                }
              );
            });
            return p.then(onfulfilled, onrejected);
          };
        }
        
        const val = target[prop];
        if (val !== null && (typeof val === 'object' || typeof val === 'function')) {
          return wrapThenableWithTimeout(val, target, ms);
        }
        return val;
      }
    });
  }

  return obj;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get: (target: any, prop: string | symbol) => {
    const client = getSupabaseClient();
    const value = (client as any)[prop];
    if (process.env.NODE_ENV === 'production') {
      return typeof value === 'function' ? value.bind(client) : value;
    }
    return wrapThenableWithTimeout(value, client, 8000);
  }
});
