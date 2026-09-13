import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiRequest, ApiError } from '../api';

const respond = (status, body = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

describe('apiRequest', () => {
  let fetchMock;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // Runs a request to completion, fast-forwarding through every retry delay.
  const settle = async (promise) => {
    const outcome = promise.then((value) => ({ value }), (error) => ({ error }));
    await vi.runAllTimersAsync();
    return outcome;
  };

  it('returns the parsed body on success', async () => {
    fetchMock.mockResolvedValueOnce(respond(200, { level: 3 }));
    const { value } = await settle(apiRequest('/stats/'));
    expect(value.data).toEqual({ level: 3 });
  });

  it('sends the stored token', async () => {
    localStorage.setItem('levelup_auth_token', 'abc123');
    fetchMock.mockResolvedValueOnce(respond(200));
    await settle(apiRequest('/stats/'));
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Token abc123');
  });

  it('sends no Authorization header when signed out', async () => {
    fetchMock.mockResolvedValueOnce(respond(200));
    await settle(apiRequest('/login/'));
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
  });

  it("keeps the caller's method and headers alongside the defaults", async () => {
    fetchMock.mockResolvedValueOnce(respond(200));
    await settle(apiRequest('/tasks/', { method: 'POST', headers: { 'X-Test': '1' } }));
    const config = fetchMock.mock.calls[0][1];
    expect(config.method).toBe('POST');
    expect(config.headers).toMatchObject({ 'Content-Type': 'application/json', 'X-Test': '1' });
  });

  it('retries a cold-start 503 and returns the eventual success', async () => {
    fetchMock
      .mockResolvedValueOnce(respond(503))
      .mockResolvedValueOnce(respond(200, { awake: true }));
    const { value } = await settle(apiRequest('/stats/'));
    expect(value.data).toEqual({ awake: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up after the last retry', async () => {
    fetchMock.mockResolvedValue(respond(502));
    const { error } = await settle(apiRequest('/stats/'));
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(error.message).toBe('HTTP error! status: 502');
  });

  it.each([400, 401, 404, 429])('does not retry a %i', async (status) => {
    fetchMock.mockResolvedValue(respond(status));
    await settle(apiRequest('/stats/'));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces the server's own reason for a rejected request", async () => {
    // Login and register display err.message as-is, so this string is exactly
    // what the player reads.
    fetchMock.mockResolvedValue(respond(400, { error: 'Username already exists' }));
    const { error } = await settle(apiRequest('/register/'));
    expect(error.message).toBe('Username already exists');
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(400);
  });

  it("surfaces DRF's detail message for a throttled request", async () => {
    fetchMock.mockResolvedValue(respond(429, { detail: 'Request was throttled.' }));
    const { error } = await settle(apiRequest('/login/'));
    expect(error.message).toBe('Request was throttled.');
  });

  it('retries a network failure, then explains it', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    const { error } = await settle(apiRequest('/stats/'));
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(error.message).toMatch(/^Connection error: Unable to connect to server/);
  });

  it('recovers if the network comes back during the retries', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(respond(200, { back: true }));
    const { value } = await settle(apiRequest('/stats/'));
    expect(value.data).toEqual({ back: true });
  });
});
