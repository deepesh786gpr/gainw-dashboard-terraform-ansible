import { useState, useCallback, useRef, useEffect } from 'react';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastFetch: Date | null;
}

interface ApiOptions {
  retries?: number;
  retryDelay?: number;
  timeout?: number;
  cache?: boolean;
  cacheTime?: number;
}

interface UseApiReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastFetch: Date | null;
  execute: (url: string, options?: RequestInit) => Promise<T | null>;
  retry: () => Promise<T | null>;
  reset: () => void;
}

// Simple cache implementation
const apiCache = new Map<string, { data: any; timestamp: number; cacheTime: number }>();

const useApi = <T = any>(defaultOptions: ApiOptions = {}): UseApiReturn<T> => {
  const [state, setState] = useState<ApiState<T>>({
    data: null,
    loading: false,
    error: null,
    lastFetch: null,
  });

  const lastRequestRef = useRef<{ url: string; options?: RequestInit } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const {
    retries = 3,
    retryDelay = 1000,
    timeout = 30000,
    cache = false,
    cacheTime = 5 * 60 * 1000, // 5 minutes
  } = defaultOptions;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const getCacheKey = (url: string, options?: RequestInit) => {
    return `${url}-${JSON.stringify(options || {})}`;
  };

  const getFromCache = (cacheKey: string) => {
    if (!cache) return null;
    
    const cached = apiCache.get(cacheKey);
    if (!cached) return null;
    
    const isExpired = Date.now() - cached.timestamp > cached.cacheTime;
    if (isExpired) {
      apiCache.delete(cacheKey);
      return null;
    }
    
    return cached.data;
  };

  const setCache = (cacheKey: string, data: any) => {
    if (!cache) return;
    
    apiCache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      cacheTime,
    });
  };

  const executeRequest = async (
    url: string,
    options: RequestInit = {},
    attempt: number = 1
  ): Promise<T | null> => {
    try {
      // Cancel previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();
      
      // Check cache first
      const cacheKey = getCacheKey(url, options);
      const cachedData = getFromCache(cacheKey);
      if (cachedData) {
        setState(prev => ({
          ...prev,
          data: cachedData,
          loading: false,
          error: null,
          lastFetch: new Date(),
        }));
        return cachedData;
      }

      setState(prev => ({ ...prev, loading: true, error: null }));

      // Set timeout
      const timeoutId = setTimeout(() => {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
      }, timeout);

      const response = await fetch(url, {
        ...options,
        signal: abortControllerRef.current.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const contentType = response.headers.get('content-type');
          if (contentType && contentType.includes('application/json')) {
            const errorData = await response.json();
            errorMessage = errorData.error || errorData.message || errorMessage;
          } else {
            const errorText = await response.text();
            // Extract meaningful error from HTML if present
            const match = errorText.match(/<pre>(.*?)<\/pre>/s);
            if (match) {
              errorMessage = match[1].replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
            }
          }
        } catch {
          // Use default error message if parsing fails
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Cache successful response
      setCache(cacheKey, data);

      setState(prev => ({
        ...prev,
        data,
        loading: false,
        error: null,
        lastFetch: new Date(),
      }));

      return data;
    } catch (error: any) {
      // Don't retry on abort
      if (error.name === 'AbortError') {
        return null;
      }

      console.error(`API request failed (attempt ${attempt}):`, error);

      // Retry logic
      if (attempt < retries) {
        console.log(`Retrying in ${retryDelay}ms... (attempt ${attempt + 1}/${retries})`);
        await sleep(retryDelay);
        return executeRequest(url, options, attempt + 1);
      }

      // Final failure
      const errorMessage = error.message || 'An unexpected error occurred';
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage,
        lastFetch: new Date(),
      }));

      return null;
    }
  };

  const execute = useCallback(async (url: string, options?: RequestInit): Promise<T | null> => {
    lastRequestRef.current = { url, options };
    return executeRequest(url, options);
  }, [retries, retryDelay, timeout, cache, cacheTime]);

  const retry = useCallback(async (): Promise<T | null> => {
    if (!lastRequestRef.current) {
      throw new Error('No previous request to retry');
    }
    
    const { url, options } = lastRequestRef.current;
    return executeRequest(url, options);
  }, []);

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
      lastFetch: null,
    });
    lastRequestRef.current = null;
    
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    data: state.data,
    loading: state.loading,
    error: state.error,
    lastFetch: state.lastFetch,
    execute,
    retry,
    reset,
  };
};

// Specialized hooks for common operations
export const useApiGet = <T = any>(url?: string, options: ApiOptions = {}) => {
  const api = useApi<T>(options);
  
  useEffect(() => {
    if (url) {
      api.execute(url);
    }
  }, [url]);
  
  return api;
};

export const useApiPost = <T = any>(options: ApiOptions = {}) => {
  return useApi<T>(options);
};

export const useApiPut = <T = any>(options: ApiOptions = {}) => {
  return useApi<T>(options);
};

export const useApiDelete = <T = any>(options: ApiOptions = {}) => {
  return useApi<T>(options);
};

export default useApi;
