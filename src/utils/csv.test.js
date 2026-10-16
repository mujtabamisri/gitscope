
import { describe, it, expect } from "vitest";
import { repositoriesToCSV } from "./csv.js";

const repo = {
  name: "demo-project",
  html_url: "https://github.com/example/demo-project",
  description: 'A project, with "quotes"',
  language: "JavaScript",
  stargazers_count: 12,
  forks_count: 3,
  open_issues_count: 2,
  license: { spdx_id: "MIT" },
  updated_at: "2026-10-01T12:00:00Z",
  archived: false,
  pushed_at: "2026-10-01T12:00:00Z"
};

describe("repositoriesToCSV", () => {
  it("includes the expected CSV headers", () => {
    const csv = repositoriesToCSV([]);

    expect(csv.split("\r\n")[0]).toBe(
      '"name","url","description","language","stars","forks","open_issues","license","updated_at","health_score"'
    );
  });

  it("exports repository information", () => {
    const csv = repositoriesToCSV([repo]);
    const rows = csv.split("\r\n");

    expect(rows).toHaveLength(2);
    expect(rows[1]).toContain('"demo-project"');
    expect(rows[1]).toContain(
      '"https://github.com/example/demo-project"'
    );
    expect(rows[1]).toContain('"JavaScript"');
    expect(rows[1]).toContain('"MIT"');
  });

  it("escapes commas and quotation marks in descriptions", () => {
    const csv = repositoriesToCSV([repo]);

    expect(csv).toContain('"A project, with ""quotes"""');
  });

  it("handles missing optional fields", () => {
    const csv = repositoriesToCSV([{
      ...repo,
      description: null,
      language: null,
      license: null
    }]);

    expect(csv).toContain('"demo-project"');
  });
});
