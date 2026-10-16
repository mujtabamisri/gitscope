
import { validUsername } from "../utils/helpers.js";

const PROFILE_CACHE_TTL = 60 * 1000;
const profileCache = new Map();

export function clearProfileCache() {
  profileCache.clear();
}



export async function githubFetch(path) {
  let response;

  try {
    response = await fetch(`https://api.github.com${path}`, {
      headers: {
        Accept: "application/vnd.github+json"
      }
    });
  } catch (error) {
    if (error.name === "AbortError") {
      throw error;
    }

    throw new Error(
      "Unable to connect to GitHub. Check your internet connection and try again."
    );
  }

  if (response.status === 404) {
    throw new Error(
      "GitHub profile or resource not found. Check the username."
    );
  }

  if (response.status === 403 || response.status === 429) {
    const reset = response.headers.get("x-ratelimit-reset");

    const resetText = reset
      ? ` Try again after ${new Date(
          Number(reset) * 1000
        ).toLocaleTimeString()}.`
      : " Please wait a little before trying again.";

    throw new Error(`GitHub API rate limit reached.${resetText}`);
  }

  if (!response.ok) {
    throw new Error(
      `GitHub API returned an error (${response.status}).`
    );
  }

  return response.json();
}



export async function fetchProfileData(username) {
  const normalized = username.trim();

  if (!validUsername(normalized)) {
    throw new Error("Enter a valid GitHub username.");
  }

  const cacheKey = normalized.toLowerCase();
  const cached = profileCache.get(cacheKey);

  if (cached && Date.now() - cached.timestamp < PROFILE_CACHE_TTL) {
    return cached.data;
  }

  if (cached) {
    profileCache.delete(cacheKey);
  }

  const encodedUsername = encodeURIComponent(normalized);

  const [profile, repos, events] = await Promise.all([
    githubFetch(`/users/${encodedUsername}`),
    githubFetch(
      `/users/${encodedUsername}/repos?per_page=100&sort=updated&type=owner`
    ),
    githubFetch(
      `/users/${encodedUsername}/events/public?per_page=100`
    )
  ]);

  const data = { profile, repos, events };

  profileCache.set(cacheKey, {
    data,
    timestamp: Date.now()
  });

  return data;
}

