import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { request, ApiClientError } from './client';

describe('api client', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should return data on success', async () => {
    const mockData = { success: true };
    mockFetch.mockResolvedValue({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => mockData,
    });

    const result = await request('/test');
    expect(result).toEqual(mockData);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should throw ApiClientError on failure', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      headers: { get: () => 'application/json' },
      json: async () => ({ error: 'Bad Request' }),
    });

    await expect(request('/test')).rejects.toThrow('Bad Request');
  });

  it('should retry on network error', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('Network Error'))
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        json: async () => ({ data: 'retry success' }),
      });

    const result = await request('/test', {}, { retries: 1, timeout: 100 });
    expect(result).toEqual({ data: 'retry success' });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
