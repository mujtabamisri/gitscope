
const API = "https://api.github.com";

const $ = (selector) => document.querySelector(selector);

const form = $("#search-form");
const usernameInput = $("#username");
const searchButton = $("#search-button");
const status = $("#status");
const dashboard = $("#dashboard");
const repoContainer = $("#repositories");
const commitContainer = $("#commits");
const filterInput = $("#repo-filter");

let repositories = [];
let languageChart = null;
let searchVersion = 0;

function formatNumber(number) {
  return new Intl.NumberFormat().format(number ?? 0);
}

function formatDate(date) {
  if (!date) return "Date unavailable";

  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;

  return element;
}

function createLink(url, text) {
  const link = createElement("a", "", text);
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

async function githubRequest(path) {
  const response = await fetch(`${API}${path}`, {
    headers: {
      Accept: "application/vnd.github+json"
    }
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        "GitHub user or resource not found. Check the username."
      );
    }

    if (response.status === 403 || response.status === 429) {
      throw new Error(
        "GitHub API rate limit reached. Please wait and try again."
      );
    }

    throw new Error(`GitHub API error: ${response.status}`);
  }

  return response.json();
}

function renderProfile(user) {
  $("#avatar").src = user.avatar_url;
  $("#avatar").alt = `${user.login}'s GitHub avatar`;

  $("#name").textContent = user.name || user.login;

  const profileLink = $("#profile-link");
  profileLink.href = user.html_url;
  profileLink.textContent = `@${user.login}`;

  $("#bio").textContent = user.bio || "No public bio provided.";

  $("#repo-count").textContent =
    formatNumber(user.public_repos);

  $("#followers").textContent =
    formatNumber(user.followers);
}

function renderStats(repos) {
  const stars = repos.reduce(
    (total, repo) => total + repo.stargazers_count,
    0
  );

  const forks = repos.reduce(
    (total, repo) => total + repo.forks_count,
    0
  );

  $("#star-count").textContent = formatNumber(stars);
  $("#fork-count").textContent = formatNumber(forks);
}

function renderLanguageChart(repos) {
  const counts = {};

  for (const repo of repos) {
    if (repo.language) {
      counts[repo.language] = (counts[repo.language] || 0) + 1;
    }
  }

  const entries = Object.entries(counts)
    .sort((a, b) => b[1] - a[1]);

  const canvas = $("#language-chart");

  if (languageChart) {
    languageChart.destroy();
    languageChart = null;
  }

  if (entries.length === 0) {
    canvas.hidden = true;

    const message = createElement(
    "p",
    "muted chart-empty",
    "No primary language data is available for these repositories."
    );

    canvas.parentElement.append(message);
    return;
  }

  canvas.hidden = false;

  // Remove a previous empty-state message, if one exists.
  const oldMessage = canvas.parentElement.querySelector(
    ".chart-empty"
  );

  if (oldMessage) oldMessage.remove();

  languageChart = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: entries.map(([language]) => language),
      datasets: [{
        data: entries.map(([, count]) => count),
        backgroundColor: [
          "#7c8cff",
          "#65d6a2",
          "#f6bd60",
          "#f28482",
          "#9b8afb",
          "#62b6cb",
          "#e7a1f5",
          "#b7c9e2"
        ],
        borderColor: "#121a2b",
        borderWidth: 4,
        hoverOffset: 7
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#c4cde0",
            padding: 16
          }
        },
        tooltip: {
          callbacks: {
            label(context) {
              return `${context.label}: ${context.raw} repositories`;
            }
          }
        }
      }
    }
  });
}

function renderRepositories() {
  const query = filterInput.value.trim().toLowerCase();

  const filtered = repositories.filter((repo) => {
    const searchable = [
      repo.name,
      repo.description,
      repo.language
    ].filter(Boolean).join(" ").toLowerCase();

    return searchable.includes(query);
  });

  repoContainer.replaceChildren();

  if (filtered.length === 0) {
    repoContainer.append(
      createElement("p", "muted", "No matching repositories found.")
    );
    return;
  }

  for (const repo of filtered) {
    const item = createElement("article", "repo-item");
    const title = createElement("h4");

    title.append(createLink(repo.html_url, repo.name));

    const description = createElement(
      "p",
      "",
      repo.description || "No description provided."
    );

    const meta = createElement("div", "repo-meta");

    meta.append(
      createElement("span", "", `★ ${formatNumber(repo.stargazers_count)}`),
      createElement("span", "", `⑂ ${formatNumber(repo.forks_count)}`),
      createElement("span", "", repo.language || "Language unspecified"),
      createElement("span", "", `Updated ${formatDate(repo.updated_at)}`)
    );

    item.append(title, description, meta);
    repoContainer.append(item);
  }
}

async function loadRecentCommits(repos, version) {
  commitContainer.replaceChildren();

  commitContainer.append(
    createElement("p", "muted", "Loading recent commits...")
  );

  // Fetch commits from the five most recently updated repositories.
  const recentRepos = repos.slice(0, 5);

  const results = await Promise.all(
    recentRepos.map(async (repo) => {
      try {
        const commits = await githubRequest(
          `/repos/${encodeURIComponent(repo.owner.login)}/${encodeURIComponent(repo.name)}/commits?per_page=5`
        );

        return commits.map((commit) => ({
          ...commit,
          repositoryName: repo.name
        }));
      } catch {
        // Some repositories may have no accessible commit history.
        return [];
      }
    })
  );

  if (version !== searchVersion) return;

  const commits = results
    .flat()
    .sort((a, b) => {
      const dateA = new Date(a.commit.author?.date || 0).getTime();
      const dateB = new Date(b.commit.author?.date || 0).getTime();

      return dateB - dateA;
    })
    .slice(0, 8);

  commitContainer.replaceChildren();

  if (commits.length === 0) {
    commitContainer.append(
      createElement(
        "p",
        "muted",
        "No recent commits could be retrieved. Repositories may be empty or inaccessible."
      )
    );
    return;
  }

  for (const commit of commits) {
    const item = createElement("article", "commit-item");

    const link = createLink(
      commit.html_url,
      commit.commit.message.split("\n")[0] || "Untitled commit"
    );

    const details = createElement(
      "p",
      "",
      `${commit.repositoryName} · ${formatDate(
        commit.commit.author?.date
      )}`
    );

    item.append(link, details);
    commitContainer.append(item);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const username = usernameInput.value.trim();

  if (!username) return;

  const version = ++searchVersion;

  searchButton.disabled = true;
  searchButton.textContent = "Analyzing...";
  status.textContent = "Fetching GitHub profile and repositories...";
  dashboard.hidden = true;
  filterInput.value = "";

  if (languageChart) {
    languageChart.destroy();
    languageChart = null;
  }

  try {
    const encodedUsername = encodeURIComponent(username);

    const [user, repos] = await Promise.all([
      githubRequest(`/users/${encodedUsername}`),
      githubRequest(
        `/users/${encodedUsername}/repos?sort=updated&per_page=100`
      )
    ]);

    if (version !== searchVersion) return;

    repositories = repos;

    renderProfile(user);
    renderStats(repos);
    renderLanguageChart(repos);
    renderRepositories();

    dashboard.hidden = false;
    status.textContent =
      `Analysis complete for ${user.login}.`;

    // Recent commits load after the main dashboard is displayed.
    loadRecentCommits(repos, version);

  } catch (error) {
    if (version !== searchVersion) return;

    status.textContent = error.message;
    repositories = [];
  } finally {
    if (version === searchVersion) {
      searchButton.disabled = false;
      searchButton.textContent = "Analyze profile";
    }
  }
});

filterInput.addEventListener("input", renderRepositories);
