export interface DiagnosticLog {
  timestamp: string;
  endpoint: string;
  method: string;
  status?: number;
  statusText?: string;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
  serverReachable?: boolean;
  corsVerified?: boolean;
  diagnosticsHint?: string;
}

/**
 * Enhanced fetch wrapper with robust automatic telemetry logging and failure diagnostics.
 */
export async function diagnosticFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : (input as any).url || String(input);
  const method = init?.method || 'GET';
  const startTimestamp = new Date().toISOString();
  
  console.log(`[API DIAGNOSTICS] 🚀 [START] ${method} ${url}`, {
    headers: init?.headers,
    mode: init?.mode,
    timestamp: startTimestamp
  });

  try {
    const response = await fetch(input, init);
    const endTimestamp = new Date().toISOString();
    
    // Check for standard server response headers
    const corsHeader = response.headers.get('Access-Control-Allow-Origin');
    
    console.log(`[API DIAGNOSTICS] ✅ [SUCCESS] ${method} ${url} -> Status: ${response.status} ${response.statusText}`, {
      status: response.status,
      type: response.type,
      corsHeader,
      timestamp: endTimestamp
    });
    
    return response;
  } catch (error: any) {
    const endTimestamp = new Date().toISOString();
    const errorMessage = error?.message || String(error);
    
    console.error(`[API DIAGNOSTICS] ❌ [FAILED] ${method} ${url} - Error: ${errorMessage}`, {
      error,
      timestamp: endTimestamp
    });

    // Run connection probe and CORS diagnostics
    let serverReachable = false;
    let healthDetails: any = null;
    let probeErrorMsg = '';

    try {
      console.log(`[API DIAGNOSTICS] 🩺 Running heartbeat probe to '/api/health' to verify API Server reachability...`);
      const probeRes = await fetch('/api/health');
      serverReachable = probeRes.ok;
      if (probeRes.ok) {
        healthDetails = await probeRes.json();
      }
      console.log(`[API DIAGNOSTICS] 🩺 Heartbeat response status: ${probeRes.status}`, healthDetails);
    } catch (probeErr: any) {
      probeErrorMsg = probeErr?.message || String(probeErr);
      console.error(`[API DIAGNOSTICS] 🩺 Heartbeat probe FAILED: ${probeErrorMsg}`);
    }

    // Formulate a helpful diagnostics hint
    let diagnosticsHint = 'Unknown connection error';
    if (!serverReachable) {
      diagnosticsHint = 'The API Server appears completely offline, crashed, or inaccessible. Verify that the express process is listening on Port 3000 and is properly started.';
    } else {
      diagnosticsHint = `The server is alive and reachable at '/api/health'. The fetch failure to '${url}' is likely due to an incorrect router mapping, cors configuration rejection on this specific route, or bad request payload.`;
    }

    const logPayload: DiagnosticLog = {
      timestamp: endTimestamp,
      endpoint: url,
      method,
      error: {
        message: errorMessage,
        name: error?.name,
        stack: error?.stack,
      },
      serverReachable,
      corsVerified: serverReachable && healthDetails ? true : false,
      diagnosticsHint,
    };

    try {
      const storedLogs = JSON.parse(localStorage.getItem('frostybite_api_failure_logs') || '[]');
      storedLogs.push(logPayload);
      localStorage.setItem('frostybite_api_failure_logs', JSON.stringify(storedLogs.slice(-30))); // Keep last 30 API exceptions
    } catch (_) {}

    console.group(`[API CLIENT FAILURE REPORT - ${method} ${url}]`);
    console.info(`Failure timestamp: ${endTimestamp}`);
    console.table(logPayload);
    console.groupEnd();

    throw error;
  }
}
