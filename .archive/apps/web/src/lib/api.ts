export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export async function fetchApi<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; message?: string; [key: string]: any }> {
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;
  
  const token = typeof window !== 'undefined' ? localStorage.getItem('racsemi_token') : null;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  try {
    const res = await fetch(url, {
      ...options,
      headers,
      credentials: 'omit'
    });

    const data = await res.json();
    return data;
  } catch (err: any) {
    console.error(`API Fetch Error [${endpoint}]:`, err);
    return {
      success: false,
      message: err.message || 'Network communication error'
    };
  }
}
