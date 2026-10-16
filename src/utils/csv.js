
import { calculateRepoHealth } from "./helpers.js";

export function repositoriesToCSV(repos) {
  const headers = [
    "name",
    "url",
    "description",
    "language",
    "stars",
    "forks",
    "open_issues",
    "license",
    "updated_at",
    "health_score"
  ];

  const rows = repos.map((repo) => [
    repo.name,
    repo.html_url,
    repo.description || "",
    repo.language || "",
    repo.stargazers_count,
    repo.forks_count,
    repo.open_issues_count,
    repo.license?.spdx_id || repo.license?.name || "",
    repo.updated_at,
    calculateRepoHealth(repo).score
  ]);

  const csvCell = (value) =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;

  return [headers, ...rows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n");
}
