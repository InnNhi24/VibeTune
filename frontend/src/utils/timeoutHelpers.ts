/**
 * Timeout utilities for VibeTune
 * Helps prevent hanging promises and improves app responsiveness
 */

/**
 * Wraps a promise with a timeout
 * @param promise - The promise to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param timeoutMessage - Custom timeout error message
 * @returns Promise that resolves with original result or rejects with timeout error
 */
export function withTimeout<T>(
  promise: Promise<T>, 
  timeoutMs: number, 
  timeoutMessage = 'Operation timed out'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    const id = setTimeout(() => {
      reject(new Error(`${timeoutMessage} after ${timeoutMs}ms`));
    }, timeoutMs);
    
    // Clear timeout if original promise resolves/rejects first
    promise.finally(() => clearTimeout(id));
  });

  return Promise.race([promise, timeoutPromise]);
}

/**
 * Wraps an async function with automatic timeout
 * @param fn - Async function to wrap
 * @param timeoutMs - Timeout in milliseconds
 * @param timeoutMessage - Custom timeout error message
 * @returns Wrapped function that automatically times out
 */
export function withAsyncTimeout<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  timeoutMs: number,
  timeoutMessage?: string
): T {
  return ((...args: Parameters<T>) => {
    return withTimeout(
      fn(...args),
      timeoutMs,
      timeoutMessage || `${fn.name || 'Function'} timed out`
    );
  }) as T;
}

/**
 * Creates a delay that automatically rejects after timeout
 * Useful for testing timeout behavior
 * @param delayMs - Delay in milliseconds
 * @param timeoutMs - Timeout in milliseconds
 * @returns Promise that resolves after delay or rejects after timeout
 */
export function delayWithTimeout(delayMs: number, timeoutMs: number): Promise<void> {
  const delayPromise = new Promise<void>(resolve => setTimeout(resolve, delayMs));
  return withTimeout(delayPromise, timeoutMs, 'Delay timed out');
}

/**
 * Executes a function with a timeout, returning null on timeout instead of throwing
 * @param fn - Function to execute
 * @param timeoutMs - Timeout in milliseconds
 * @param fallbackValue - Value to return on timeout (default: null)
 * @returns Result of function or fallback value on timeout
 */
export async function tryWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  fallbackValue: T | null = null
): Promise<T | null> {
  try {
    return await withTimeout(fn(), timeoutMs, 'Operation timed out');
  } catch (error) {
    if (error.message.includes('timed out')) {
      console.warn(`Operation timed out after ${timeoutMs}ms, using fallback value`);
      return fallbackValue;
    }
    throw error; // Re-throw non-timeout errors
  }
}

/**
 * Batch execute promises with individual timeouts
 * Continues even if some promises timeout
 * @param promises - Array of promise-returning functions
 * @param timeoutMs - Timeout for each promise
 * @returns Array of results, with null for timed-out promises
 */
export async function batchWithTimeout<T>(
  promises: (() => Promise<T>)[],
  timeoutMs: number
): Promise<(T | null)[]> {
  const results = await Promise.allSettled(
    promises.map(promiseFn => tryWithTimeout(promiseFn, timeoutMs))
  );

  return results.map(result => 
    result.status === 'fulfilled' ? result.value : null
  );
}

/**
 * Abortable fetch with timeout
 * @param url - URL to fetch
 * @param options - Fetch options
 * @param timeoutMs - Timeout in milliseconds
 * @returns Promise that resolves with Response or rejects with timeout
 */
export function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number = 5000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  const fetchPromise = fetch(url, {
    ...options,
    signal: controller.signal
  });
  
  fetchPromise.finally(() => clearTimeout(timeoutId));
  
  return fetchPromise.catch(error => {
    if (error.name === 'AbortError') {
      throw new Error(`Fetch request to ${url} timed out after ${timeoutMs}ms`);
    }
    throw error;
  });
}

/**
 * Retry a function with exponential backoff and timeout
 * @param fn - Function to retry
 * @param maxRetries - Maximum number of retries
 * @param timeoutMs - Timeout for each attempt
 * @param backoffMs - Initial backoff delay
 * @returns Promise that resolves with result or rejects after all retries fail
 */
export async function retryWithTimeout<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  timeoutMs: number = 5000,
  backoffMs: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await withTimeout(fn(), timeoutMs, `Attempt ${attempt + 1} timed out`);
    } catch (error) {
      lastError = error as Error;
      console.warn(`Attempt ${attempt + 1} failed:`, error.message);
      
      if (attempt < maxRetries) {
        const delay = backoffMs * Math.pow(2, attempt);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw new Error(`All ${maxRetries + 1} attempts failed. Last error: ${lastError.message}`);
}