
import { calculateRepoHealth } from "./helpers.js";

export function filterRepositories(repos, {
  query = "",
  language = "",
  license = ""
} = {}) {
  const normalizedQuery = query.trim().toLowerCase();

  return repos.filter((repo) => {
    const name = (repo.name || "").toLowerCase();
    const description = (repo.description || "").toLowerCase();
    const repoLicense =
      repo.license?.spdx_id || repo.license?.name || "";

    const matchesSearch =
      !normalizedQuery ||
      name.includes(normalizedQuery) ||
      description.includes(normalizedQuery);

    return (
      matchesSearch &&
      (!language || repo.language === language) &&
      (!license || repoLicense === license)
    );
  });
}

export function sortRepositories(repos, sort = "updated") {
  const sorted = [...repos];

  sorted.sort((a, b) => {
    if (sort === "stars") {
      return (b.stargazers_count || 0) -
        (a.stargazers_count || 0);
    }

    if (sort === "forks") {
      return (b.forks_count || 0) -
        (a.forks_count || 0);
    }

    if (sort === "name") {
      return (a.name || "").localeCompare(b.name || "");
    }

    if (sort === "health") {
      return calculateRepoHealth(b).score -
        calculateRepoHealth(a).score;
    }

    return (
      new Date(b.updated_at || 0) -
      new Date(a.updated_at || 0)
    );
  });

  return sorted;
}

export function paginateRepositories(repos, page = 1, pageSize = 9) {
  const safePageSize = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(repos.length / safePageSize));
  const currentPage = Math.min(
    Math.max(1, Math.floor(page)),
    pageCount
  );
  const start = (currentPage - 1) * safePageSize;

  return {
    items: repos.slice(start, start + safePageSize),
    currentPage,
    pageCount,
    total: repos.length
  };
}
