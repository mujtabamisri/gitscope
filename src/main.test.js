import {
  describe,
  it,
  expect,
  vi,
  afterEach
} from "vitest";

import {
  escapeHTML,
  formatNumber,
  formatDate,
  relativeDate,
  validUsername,
  calculateRepoHealth,
  collectLanguages
} from "./utils/helpers.js";

import {
  githubFetch,
  fetchProfileData,
  clearProfileCache
} from "./api/github.js";

describe("escapeHTML", () => {
  it("escapes HTML special characters", () => {
    expect(escapeHTML('<script>"hello"</script>')).toBe(
      "&lt;script&gt;&quot;hello&quot;&lt;/script&gt;"
    );
  });
});

describe("formatNumber", () => {
  it("formats numbers with thousands separators", () => {
    expect(formatNumber(12345)).toBe("12,345");
  });

  it("handles invalid numeric values", () => {
    expect(formatNumber("invalid")).toBe("0");
  });
});

describe("formatDate", () => {
  it("returns Unknown for missing or invalid dates", () => {
    expect(formatDate("")).toBe("Unknown");
    expect(formatDate("not-a-date")).toBe("Unknown");
  });

  it("formats a valid date", () => {
    expect(formatDate("2025-01-15T12:00:00Z")).not.toBe("Unknown");
  });
});

describe("relativeDate", () => {
  it("handles missing and invalid dates", () => {
    expect(relativeDate("")).toBe("Unknown");
    expect(relativeDate("invalid")).toBe("Unknown");
  });

  it("recognizes today's date", () => {
    expect(relativeDate(new Date().toISOString())).toBe("Today");
  });
});

describe("validUsername", () => {
  it("accepts valid GitHub usernames", () => {
    expect(validUsername("octocat")).toBe(true);
    expect(validUsername("user-123")).toBe(true);
    expect(validUsername("a")).toBe(true);
  });

  it("rejects invalid GitHub usernames", () => {
    expect(validUsername("")).toBe(false);
    expect(validUsername("-username")).toBe(false);
    expect(validUsername("username-")).toBe(false);
    expect(validUsername("two--hyphens")).toBe(false);
    expect(validUsername("user name")).toBe(false);
  });
});

describe("collectLanguages", () => {
  it("counts languages and sorts by frequency", () => {
    const repos = [
      { language: "JavaScript" },
      { language: "Python" },
      { language: "JavaScript" },
      { language: "TypeScript" },
      { language: "JavaScript" }
    ];

    expect(collectLanguages(repos)).toEqual([
      ["JavaScript", 3],
      ["Python", 1],
      ["TypeScript", 1]
    ]);
  });

  it("ignores repositories without a language", () => {
    expect(collectLanguages([
      { language: null },
      { language: "" }
    ])).toEqual([]);
  });
});

describe("calculateRepoHealth", () => {
  it("gives a fully documented, recently updated repo a healthy score", () => {
    const repo = {
      pushed_at: new Date().toISOString(),
      description: "A sample project",
      license: { spdx_id: "MIT" },
      archived: false
    };

    const result = calculateRepoHealth(repo);

    expect(result.score).toBe(100);
    expect(result.label).toBe("Healthy");
    expect(result.signals).toEqual([]);
  });

  it("reduces the score for missing information and archived repos", () => {
    const repo = {
      pushed_at: new Date().toISOString(),
      description: "",
      license: null,
      archived: true
    };

    const result = calculateRepoHealth(repo);

    expect(result.score).toBe(50);
    expect(result.label).toBe("Needs attention");
    expect(result.signals).toContain("Missing description");
    expect(result.signals).toContain("No detected license");
    expect(result.signals).toContain("Archived repository");
  });
});


afterEach(() => {
  vi.unstubAllGlobals();
});

function mockResponse(data, status = 200, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: vi.fn().mockResolvedValue(data)
  };
}

describe("githubFetch", () => {

  
it("handles network failures", async () => {
  const networkError = vi.fn().mockRejectedValue(
    new TypeError("Failed to fetch")
  );

  vi.stubGlobal("fetch", networkError);

  await expect(
    githubFetch("/users/octocat")
  ).rejects.toThrow(
    "Unable to connect to GitHub. Check your internet connection and try again."
  );

  expect(networkError).toHaveBeenCalledTimes(1);
});

  
  it("fetches data from the GitHub API", async () => {
    const profile = { login: "octocat", public_repos: 8 };
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse(profile)
    );

    vi.stubGlobal("fetch", fetchMock);

    const result = await githubFetch("/users/octocat");

    expect(result).toEqual(profile);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/users/octocat",
      {
        headers: {
          Accept: "application/vnd.github+json"
        }
      }
    );
  });

  it("throws an error when the resource is not found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockResponse({}, 404))
    );

    await expect(
      githubFetch("/users/does-not-exist")
    ).rejects.toThrow(
      "GitHub profile or resource not found"
    );
  });

  it("handles GitHub rate limits", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockResponse({}, 403))
    );

    await expect(
      githubFetch("/users/octocat")
    ).rejects.toThrow("GitHub API rate limit reached");
  });

  it("handles other API errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockResponse({}, 500))
    );

    await expect(
      githubFetch("/users/octocat")
    ).rejects.toThrow(
      "GitHub API returned an error (500)."
    );
  });
});

describe("fetchProfileData", () => {
  it("rejects invalid usernames without making API requests", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchProfileData("invalid username")
    ).rejects.toThrow("Enter a valid GitHub username.");

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads a profile, repositories, and public events", async () => {
    const profile = { login: "octocat" };
    const repos = [{ name: "hello-world" }];
    const events = [{ type: "PushEvent" }];

    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockResponse(profile))
      .mockResolvedValueOnce(mockResponse(repos))
      .mockResolvedValueOnce(mockResponse(events));

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchProfileData("octocat");

    expect(result).toEqual({ profile, repos, events });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("trims whitespace from usernames", async () => {
    clearProfileCache();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(mockResponse({ login: "octocat" }))
      .mockResolvedValueOnce(mockResponse([]))
      .mockResolvedValueOnce(mockResponse([]));

    vi.stubGlobal("fetch", fetchMock);

    await fetchProfileData("  octocat  ");

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.github.com/users/octocat",
      expect.any(Object)
    );
  });
});
