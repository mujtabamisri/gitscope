
import { describe, it, expect } from "vitest";

import {
  filterRepositories,
  sortRepositories,
  paginateRepositories
} from "./repositories.js";

const repos = [
  {
    name: "zebra",
    description: "A JavaScript project",
    language: "JavaScript",
    stargazers_count: 10,
    forks_count: 2,
    updated_at: "2026-01-01T00:00:00Z",
    license: { spdx_id: "MIT" }
  },
  {
    name: "alpha",
    description: "A Python tool",
    language: "Python",
    stargazers_count: 30,
    forks_count: 5,
    updated_at: "2026-03-01T00:00:00Z",
    license: { spdx_id: "Apache-2.0" }
  },
  {
    name: "middle",
    description: "Another JavaScript app",
    language: "JavaScript",
    stargazers_count: 20,
    forks_count: 1,
    updated_at: "2026-02-01T00:00:00Z",
    license: null
  }
];

describe("filterRepositories", () => {
  it("filters by repository name", () => {
    expect(
      filterRepositories(repos, { query: "ALPHA" })
        .map((repo) => repo.name)
    ).toEqual(["alpha"]);
  });

  it("searches repository descriptions", () => {
    expect(
      filterRepositories(repos, { query: "javascript" })
        .map((repo) => repo.name)
    ).toEqual(["zebra", "middle"]);
  });

  it("filters by language and license together", () => {
    expect(
      filterRepositories(repos, {
        language: "JavaScript",
        license: "MIT"
      }).map((repo) => repo.name)
    ).toEqual(["zebra"]);
  });

  it("returns all repositories when filters are empty", () => {
    expect(filterRepositories(repos)).toHaveLength(3);
  });
});

describe("sortRepositories", () => {
  it("sorts by stars in descending order", () => {
    expect(
      sortRepositories(repos, "stars")
        .map((repo) => repo.name)
    ).toEqual(["alpha", "middle", "zebra"]);
  });

  it("sorts by forks in descending order", () => {
    expect(
      sortRepositories(repos, "forks")
        .map((repo) => repo.name)
    ).toEqual(["alpha", "zebra", "middle"]);
  });

  it("sorts names alphabetically", () => {
    expect(
      sortRepositories(repos, "name")
        .map((repo) => repo.name)
    ).toEqual(["alpha", "middle", "zebra"]);
  });

  it("sorts by most recently updated by default", () => {
    expect(
      sortRepositories(repos)
        .map((repo) => repo.name)
    ).toEqual(["alpha", "middle", "zebra"]);
  });

  it("does not mutate the original repository array", () => {
    const originalOrder = repos.map((repo) => repo.name);

    sortRepositories(repos, "name");

    expect(repos.map((repo) => repo.name))
      .toEqual(originalOrder);
  });
});

describe("paginateRepositories", () => {
  it("returns the requested page", () => {
    const result = paginateRepositories(repos, 2, 2);

    expect(result.items.map((repo) => repo.name))
      .toEqual(["middle"]);
    expect(result.currentPage).toBe(2);
    expect(result.pageCount).toBe(2);
    expect(result.total).toBe(3);
  });

  it("clamps an out-of-range page to the last page", () => {
    const result = paginateRepositories(repos, 99, 2);

    expect(result.currentPage).toBe(2);
    expect(result.items).toHaveLength(1);
  });

  it("handles an empty repository list", () => {
    const result = paginateRepositories([], 1, 9);

    expect(result.items).toEqual([]);
    expect(result.currentPage).toBe(1);
    expect(result.pageCount).toBe(1);
    expect(result.total).toBe(0);
  });
});
