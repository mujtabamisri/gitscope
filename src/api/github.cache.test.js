
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  fetchProfileData,
  clearProfileCache
} from "./github.js";

function mockGitHubFetch() {
  const mockFetch = vi.fn(async (url) => ({
    ok: true,
    status: 200,
    headers: {
      get: () => null
    },
    json: async () => {
      if (url.includes("/events/public")) {
        return [{ id: "event-1" }];
      }

      if (url.includes("/repos?")) {
        return [{ id: 1, name: "demo-repo" }];
      }

      return { login: "cache-demo" };
    }
  }));

  vi.stubGlobal("fetch", mockFetch);

  return mockFetch;
}

afterEach(() => {
  clearProfileCache();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("GitHub profile caching", () => {
  it("reuses cached data for the same username", async () => {
    const mockFetch = mockGitHubFetch();

    const first = await fetchProfileData("cache-demo");
    const second = await fetchProfileData("cache-demo");

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(second).toBe(first);
  });

  it("treats usernames with different casing as the same cache entry", async () => {
    const mockFetch = mockGitHubFetch();

    await fetchProfileData("cache-demo");
    await fetchProfileData("CACHE-DEMO");

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("fetches fresh data after 60 seconds", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));

    const mockFetch = mockGitHubFetch();

    await fetchProfileData("cache-expiry-demo");

    vi.advanceTimersByTime(60_001);

    await fetchProfileData("cache-expiry-demo");

    expect(mockFetch).toHaveBeenCalledTimes(6);
  });

  it("does not cache failed requests", async () => {
    const mockFetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      headers: {
        get: () => null
      },
      json: async () => ({})
    }));

    vi.stubGlobal("fetch", mockFetch);

    await expect(
      fetchProfileData("cache-failure-demo")
    ).rejects.toThrow("GitHub API returned an error (500).");

    await expect(
      fetchProfileData("cache-failure-demo")
    ).rejects.toThrow("GitHub API returned an error (500).");

    expect(mockFetch).toHaveBeenCalledTimes(6);
  });
});
