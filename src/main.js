import Chart from "chart.js/auto";
import "./style.css";

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
  fetchProfileData
} from "./api/github.js";

import {
  filterRepositories,
  sortRepositories,
  paginateRepositories
} from "./utils/repositories.js";

import { repositoriesToCSV } from "./utils/csv.js";

const $ = (selector) => document.querySelector(selector);

const state = {
  profile: null,
  repos: [],
  events: [],
  currentPage: 1,
  pageSize: 9,
  languageChart: null,
  comparisonChart: null,
  comparison: null
};


function setMessage(element, message, type = "") {
  element.textContent = message;
  element.className = `status-message ${type}`.trim();
}


function showDashboard() {
  $("#dashboardView").classList.remove("hidden");
  $("#comparisonView").classList.add("hidden");
  $("#overviewNav").classList.add("active");
  $("#compareNav").classList.remove("active");
  $("#topbarTitle").textContent = "Overview";
}

function showComparison() {
  $("#dashboardView").classList.add("hidden");
  $("#comparisonView").classList.remove("hidden");
  $("#overviewNav").classList.remove("active");
  $("#compareNav").classList.add("active");
  $("#repositoriesNav").classList.remove("active");
  $("#activityNav").classList.remove("active");
  $("#topbarTitle").textContent = "Profile Comparison";
}

function activateDashboardNav(id) {
  showDashboard();
  document.querySelectorAll(".nav-item").forEach((item) => item.classList.remove("active"));
  $(`#${id}`).classList.add("active");
}

function renderProfile(profile) {
  $("#profileAvatar").src = profile.avatar_url;
  $("#profileAvatar").alt = `${profile.login}'s GitHub avatar`;
  $("#profileName").textContent = profile.name || profile.login;
  $("#profileUsername").textContent = `@${profile.login}`;
  $("#profileUsername").href = profile.html_url;
  $("#profileBio").textContent = profile.bio || "No public bio provided.";
  $("#profileExternalLink").href = profile.html_url;

  const meta = [];
  if (profile.company) meta.push(`⌂ ${profile.company}`);
  if (profile.location) meta.push(`◎ ${profile.location}`);
  if (profile.blog) {
    const blog = /^https?:\/\//i.test(profile.blog)
      ? profile.blog
      : `https://${profile.blog}`;
    meta.push(`<a href="${escapeHTML(blog)}" target="_blank" rel="noreferrer">↗ Website</a>`);
  }
  meta.push(`Joined ${formatDate(profile.created_at)}`);

  $("#profileMeta").innerHTML = meta.map((item) =>
    item.startsWith("<a ") ? item : `<span>${escapeHTML(item)}</span>`
  ).join("");
}

function renderStats(profile, repos) {
  const totalStars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
  const totalForks = repos.reduce((sum, repo) => sum + repo.forks_count, 0);
  const stats = [
    ["Public repositories", profile.public_repos, "▤"],
    ["Followers", profile.followers, "♙"],
    ["Following", profile.following, "⇄"],
    ["Stars on fetched repos", totalStars, "☆"]
  ];

  $("#statsGrid").innerHTML = stats.map(([label, value, icon]) => `
    <article class="stat-card panel">
      <div class="stat-top"><span>${escapeHTML(label)}</span><span class="stat-icon">${icon}</span></div>
      <div class="stat-value">${formatNumber(value)}</div>
    </article>
  `).join("");

  $("#statsGrid").insertAdjacentHTML("beforeend", `
    <article class="stat-card panel">
      <div class="stat-top"><span>Forks on fetched repos</span><span class="stat-icon">⑂</span></div>
      <div class="stat-value">${formatNumber(totalForks)}</div>
    </article>
  `);
}


function renderLanguages(repos) {
  const languages = collectLanguages(repos);
  const colors = [
    "#a5f36b", "#72b7ff", "#c69bff", "#ffbd6e",
    "#ff7d98", "#55d6be", "#f4e06d", "#8f9fff"
  ];

  if (state.languageChart) state.languageChart.destroy();

  const canvas = $("#languageChart");
  state.languageChart = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: languages.map(([name]) => name),
      datasets: [{
        data: languages.map(([, count]) => count),
        backgroundColor: languages.map((_, index) => colors[index % colors.length]),
        borderColor: "#151923",
        borderWidth: 4,
        hoverOffset: 5
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "70%",
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (context) => `${context.label}: ${context.raw} repositories` } }
      }
    }
  });

  $("#languageLegend").innerHTML = languages.length
    ? languages.slice(0, 8).map(([name, count], index) => `
      <div class="legend-item">
        <span class="legend-dot" style="background:${colors[index % colors.length]}"></span>
        <span>${escapeHTML(name)}</span>
        <strong>${count}</strong>
      </div>
    `).join("")
    : `<p class="muted small">No language data found in the fetched repositories.</p>`;
}

function eventDescription(event) {
  const actor = event.actor?.login || "Someone";
  const repo = event.repo?.name || "a repository";
  const messages = {
    PushEvent: `pushed commits to ${repo}`,
    PullRequestEvent: `worked on a pull request in ${repo}`,
    IssuesEvent: `interacted with an issue in ${repo}`,
    IssueCommentEvent: `commented on an issue in ${repo}`,
    WatchEvent: `starred ${repo}`,
    ForkEvent: `forked ${repo}`,
    CreateEvent: `created something in ${repo}`,
    DeleteEvent: `deleted a branch or tag in ${repo}`,
    ReleaseEvent: `published a release in ${repo}`,
    PublicEvent: `made ${repo} public`,
    CommitCommentEvent: `commented on a commit in ${repo}`,
    PullRequestReviewEvent: `reviewed a pull request in ${repo}`,
    PullRequestReviewCommentEvent: `commented on a pull request in ${repo}`,
    GollumEvent: `updated the wiki in ${repo}`
  };

  return { actor, text: messages[event.type] || `was active in ${repo}` };
}

function renderActivity(events) {
  const list = $("#activityList");

  if (!events.length) {
    list.innerHTML = `<p class="muted small">No recent public events were returned by GitHub.</p>`;
    return;
  }

  list.innerHTML = events.slice(0, 12).map((event) => {
    const detail = eventDescription(event);
    const repoUrl = `https://github.com/${event.repo?.name || ""}`;

    return `
      <article class="activity-item">
        <span class="activity-dot"></span>
        <div class="activity-copy">
          <p><strong>${escapeHTML(detail.actor)}</strong> ${escapeHTML(detail.text)}</p>
          <div class="activity-meta">
            <a href="${escapeHTML(repoUrl)}" target="_blank" rel="noreferrer">${escapeHTML(event.repo?.name || "Repository")}</a>
            <span>${relativeDate(event.created_at)}</span>
          </div>
        </div>
      </article>
    `;
  }).join("");
}


function renderActivityHeatmap(events) {
  const container = $("#activityHeatmap");
  const counts = new Map();
  const details = new Map();

  // Count public events for each calendar date.
  for (const event of events) {
    if (!event.created_at) continue;

    const date = new Date(event.created_at);
    if (Number.isNaN(date.getTime())) continue;

    const key = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");

    counts.set(key, (counts.get(key) || 0) + 1);

    if (!details.has(key)) details.set(key, []);
    details.get(key).push(event);
  }

  // Build a calendar covering the most recent 12 weeks.
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const end = new Date(today);
  end.setDate(end.getDate() - end.getDay());

  const start = new Date(end);
  start.setDate(start.getDate() - 77);

  const cells = [];
  const monthLabels = [];
  const monthNames = [];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  for (let week = 0; week < 12; week++) {
    const weekStart = new Date(start);
    weekStart.setDate(start.getDate() + week * 7);

    const monthName = weekStart.toLocaleDateString(undefined, {
      month: "short",
      year: "numeric"
    });

    // Display each month label once.
    monthLabels.push(
      week === 0 || weekStart.getMonth() !== new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate() + (week - 1) * 7
      ).getMonth()
        ? monthName
        : ""
    );

    for (let day = 0; day < 7; day++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + day);

      const key = [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0")
      ].join("-");

      const count = counts.get(key) || 0;
      const dayEvents = details.get(key) || [];

      const level = count === 0 ? 0
        : count === 1 ? 1
        : count <= 3 ? 2
        : count <= 6 ? 3
        : 4;

      const formattedDate = date.toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric"
      });

      const eventBreakdown = [...new Set(dayEvents.map((event) => event.type))];
      const eventDetails = eventBreakdown.length
        ? `\nTypes: ${eventBreakdown.join(", ")}`
        : "";

      const tooltip = `${formattedDate}\n${count} public event${count === 1 ? "" : "s"}${eventDetails}`;

      cells.push(`
        <span
          class="heat-cell level-${level}"
          title="${escapeHTML(tooltip)}"
          aria-label="${escapeHTML(tooltip)}"
          tabindex="0"
          data-date="${key}"
        ></span>
      `);
    }
  }

  container.innerHTML = `
    <div class="heatmap-calendar">
      <div class="heatmap-months">
        ${monthLabels.map((month) => `<span>${escapeHTML(month)}</span>`).join("")}
      </div>

      <div class="heatmap-content">
        <div class="heatmap-day-labels">
          ${dayNames.map((day) => `<span>${day}</span>`).join("")}
        </div>

        <div class="heatmap-grid">
          ${cells.join("")}
        </div>
      </div>

      <div class="heatmap-footer">
        <span>${formatDate(start)}</span>
        <div class="heatmap-legend">
          <span>Less</span>
          <i class="heat-cell level-0"></i>
          <i class="heat-cell level-1"></i>
          <i class="heat-cell level-2"></i>
          <i class="heat-cell level-3"></i>
          <i class="heat-cell level-4"></i>
          <span>More</span>
        </div>
        <span>${formatDate(today)}</span>
      </div>
    </div>
  `;
}


function populateRepositoryFilters(repos) {
  const languages = [...new Set(repos.map((repo) => repo.language).filter(Boolean))].sort();
  const licenses = [...new Set(repos.map((repo) => repo.license?.spdx_id || repo.license?.name).filter(Boolean))].sort();

  const languageFilter = $("#repoLanguageFilter");
  const licenseFilter = $("#repoLicenseFilter");
  const oldLanguage = languageFilter.value;
  const oldLicense = licenseFilter.value;

  languageFilter.innerHTML = `<option value="">All languages</option>` +
    languages.map((language) => `<option value="${escapeHTML(language)}">${escapeHTML(language)}</option>`).join("");

  licenseFilter.innerHTML = `<option value="">All licenses</option>` +
    licenses.map((license) => `<option value="${escapeHTML(license)}">${escapeHTML(license)}</option>`).join("");

  if (languages.includes(oldLanguage)) languageFilter.value = oldLanguage;
  if (licenses.includes(oldLicense)) licenseFilter.value = oldLicense;
}

function renderRepositories() {
const filteredRepos = filterRepositories(state.repos, {
  query: $("#repoSearch").value,
  language: $("#repoLanguageFilter").value,
  license: $("#repoLicenseFilter").value
});

const repos = sortRepositories(
  filteredRepos,
  $("#repoSort").value
);

$("#repositoryCount").textContent =
  `${repos.length} of ${state.repos.length} fetched repositories`;

const page = paginateRepositories(
  repos,
  state.currentPage,
  state.pageSize
);

state.currentPage = page.currentPage;

const pageCount = page.pageCount;
const pageRepos = page.items;

  $("#repoList").innerHTML = pageRepos.length
    ? pageRepos.map((repo) => {
      const health = calculateRepoHealth(repo);
      const license = repo.license?.spdx_id || repo.license?.name || "No license detected";

      return `
        <article class="repo-card">
          <div class="repo-card-heading">
            <a class="repo-name" href="${escapeHTML(repo.html_url)}" target="_blank" rel="noreferrer">${escapeHTML(repo.name)} ↗</a>
            <span class="health-pill health-${health.score >= 80 ? "good" : health.score >= 60 ? "fair" : "low"}">${health.score}/100</span>
          </div>
          <p class="repo-description">${escapeHTML(repo.description || "No description provided.")}</p>
          <div class="repo-tags">
            ${repo.language ? `<span class="repo-tag"><span class="language-dot"></span>${escapeHTML(repo.language)}</span>` : ""}
            ${repo.archived ? `<span class="repo-tag">Archived</span>` : ""}
            <span class="repo-tag">${escapeHTML(license)}</span>
          </div>
          <div class="repo-stats">
            <span>☆ ${formatNumber(repo.stargazers_count)}</span>
            <span>⑂ ${formatNumber(repo.forks_count)}</span>
            <span>Updated ${relativeDate(repo.pushed_at || repo.updated_at)}</span>
          </div>
          <div class="health-detail">
            <div class="health-track"><span style="width:${health.score}%"></span></div>
            <p>${escapeHTML(health.label)}${health.signals.length ? ` · ${escapeHTML(health.signals.slice(0, 2).join("; "))}` : " · No listed maintenance flags"}</p>
          </div>
        </article>
      `;
    }).join("")
    
: `
  <div class="empty-inline">
    <strong>No repositories found</strong>
    <p>Try changing your search term or clearing the language and license filters.</p>
    <button type="button" class="outline-button" id="clearRepoFilters">
      Clear filters
    </button>
  </div>
`;

if (pageRepos.length === 0) {
  $("#clearRepoFilters").addEventListener("click", () => {
    $("#repoSearch").value = "";
    $("#repoLanguageFilter").value = "";
    $("#repoLicenseFilter").value = "";
    $("#repoSort").value = "updated";

    state.currentPage = 1;
    renderRepositories();
  });
}


  const pagination = $("#repoPagination");
  pagination.innerHTML = "";

  if (pageCount > 1) {
    pagination.innerHTML = `
      <button type="button" class="outline-button" id="previousPage" ${state.currentPage === 1 ? "disabled" : ""}>← Previous</button>
      <span>Page ${state.currentPage} of ${pageCount}</span>
      <button type="button" class="outline-button" id="nextPage" ${state.currentPage === pageCount ? "disabled" : ""}>Next →</button>
    `;

    $("#previousPage").addEventListener("click", () => {
      state.currentPage--;
      renderRepositories();
    });

    $("#nextPage").addEventListener("click", () => {
      state.currentPage++;
      renderRepositories();
    });
  }
}

function exportRepositories() {
  if (!state.repos.length) {
    setMessage($("#dashboardMessage"), "Load a profile before exporting repositories.", "error");
    return;
  }

  const csv = repositoriesToCSV(state.repos);
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${state.profile?.login || "github"}-repositories.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}


async function analyzeProfile(username) {
  const searchButton = $("#searchButton");
  const originalButtonText = searchButton.innerHTML;

  setMessage($("#dashboardMessage"), `Loading @${username.trim()}…`);
  searchButton.disabled = true;
  searchButton.innerHTML = `
    <span class="loading-spinner" aria-hidden="true"></span>
    Loading...
  `;
  searchButton.setAttribute("aria-busy", "true");

  try {
    const data = await fetchProfileData(username);
    state.profile = data.profile;
    state.repos = data.repos;
    state.events = data.events;

    renderProfile(state.profile);
    renderStats(state.profile, state.repos);
    renderLanguages(state.repos);
    renderActivity(state.events);
    renderActivityHeatmap(state.events);
    populateRepositoryFilters(state.repos);

    $("#repoSearch").value = "";
    $("#repoLanguageFilter").value = "";
    $("#repoLicenseFilter").value = "";
    $("#repoSort").value = "updated";
    state.currentPage = 1;
    renderRepositories();

    $("#dashboardData").classList.remove("hidden");
    $("#dashboardEmpty").classList.add("hidden");

    setMessage(
      $("#dashboardMessage"),
      `Successfully loaded @${state.profile.login}.`,
      "success"
    );
  } catch (error) {
    setMessage(
      $("#dashboardMessage"),
      error.message || "Unable to load this profile.",
      "error"
    );
  } finally {
    searchButton.disabled = false;
    searchButton.innerHTML = originalButtonText;
    searchButton.removeAttribute("aria-busy");
  }
}


/* =========================================
   PROFILE COMPARISON
========================================= */

function renderComparisonProfile(profile, repos) {
  const stars = repos.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0);
  const forks = repos.reduce((sum, repo) => sum + (repo.forks_count || 0), 0);
  const joinedYear = new Date(profile.created_at).getFullYear();

  return `
    <article class="comparison-profile panel">
      <img class="avatar" src="${escapeHTML(profile.avatar_url)}" alt="${escapeHTML(profile.login)} avatar">
      <div class="comparison-profile-copy">
        <h3>${escapeHTML(profile.name || profile.login)}</h3>
        <a href="${escapeHTML(profile.html_url)}" target="_blank" rel="noreferrer">@${escapeHTML(profile.login)} ↗</a>
        <p>${escapeHTML(profile.bio || "No public bio provided.")}</p>
        <p>${formatNumber(profile.public_repos)} public repos · ${formatNumber(stars)} stars · ${formatNumber(forks)} forks · Joined ${joinedYear}</p>
      </div>
    </article>
  `;
}

function buildComparisonMetrics(dataA, dataB) {
  const getStats = ({ profile, repos }) => ({
    "Public repositories": profile.public_repos,
    "Followers": profile.followers,
    "Following": profile.following,
    "Stars on fetched repositories": repos.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0),
    "Forks on fetched repositories": repos.reduce((sum, repo) => sum + (repo.forks_count || 0), 0),
    "Open issues on fetched repositories": repos.reduce((sum, repo) => sum + (repo.open_issues_count || 0), 0),
    "Repositories fetched": repos.length,
    "Account age (years)": Math.max(0, Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 31557600000))
  });

  const statsA = getStats(dataA);
  const statsB = getStats(dataB);

  $("#compareNameA").textContent = dataA.profile.login;
  $("#compareNameB").textContent = dataB.profile.login;

  const rows = Object.keys(statsA).map((metric) => {
    const a = statsA[metric];
    const b = statsB[metric];
    const tie = a === b;
    const aClass = tie ? "comparison-tie" : a > b ? "comparison-leader" : "";
    const bClass = tie ? "comparison-tie" : b > a ? "comparison-leader" : "";

    return `<tr>
      <td>${escapeHTML(metric)}</td>
      <td class="${aClass}">${formatNumber(a)}</td>
      <td class="${bClass}">${formatNumber(b)}</td>
    </tr>`;
  }).join("");

  $("#comparisonMetricsBody").innerHTML = rows;
  return { statsA, statsB };
}

function renderComparisonChart(dataA, dataB) {
  if (state.comparisonChart) state.comparisonChart.destroy();

  const metrics = [
    ["Public repos", (data) => data.profile.public_repos],
    ["Followers", (data) => data.profile.followers],
    ["Following", (data) => data.profile.following],
    ["Stars", (data) => data.repos.reduce((sum, repo) => sum + (repo.stargazers_count || 0), 0)],
    ["Forks", (data) => data.repos.reduce((sum, repo) => sum + (repo.forks_count || 0), 0)],
    ["Open issues", (data) => data.repos.reduce((sum, repo) => sum + (repo.open_issues_count || 0), 0)]
  ];

  state.comparisonChart = new Chart($("#comparisonChart"), {
    type: "bar",
    data: {
      labels: metrics.map(([label]) => label),
      datasets: [
        {
          label: dataA.profile.login,
          data: metrics.map(([, getValue]) => getValue(dataA)),
          backgroundColor: "#a5f36b",
          borderRadius: 5
        },
        {
          label: dataB.profile.login,
          data: metrics.map(([, getValue]) => getValue(dataB)),
          backgroundColor: "#72b7ff",
          borderRadius: 5
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: "rgba(140,150,170,.12)" },
          ticks: { color: "#9299aa" }
        },
        y: {
          grid: { display: false },
          ticks: { color: "#c8ccda" }
        }
      },
      plugins: {
        legend: { labels: { color: "#c8ccda", usePointStyle: true, pointStyle: "circle" } }
      }
    }
  });
}

function renderComparisonLanguages(dataA, dataB) {
  const languageCounts = (repos) => {
    const counts = {};
    repos.forEach((repo) => {
      if (repo.language) counts[repo.language] = (counts[repo.language] || 0) + 1;
    });
    return counts;
  };

  const countsA = languageCounts(dataA.repos);
  const countsB = languageCounts(dataB.repos);
  const allLanguages = [...new Set([...Object.keys(countsA), ...Object.keys(countsB)])]
    .sort((a, b) => (countsA[b] + countsB[b]) - (countsA[a] + countsB[a]))
    .slice(0, 12);

  const maxCount = Math.max(1, ...allLanguages.map((language) =>
    Math.max(countsA[language] || 0, countsB[language] || 0)
  ));

  $("#comparisonLanguages").innerHTML = allLanguages.length
    ? allLanguages.map((language) => {
      const a = countsA[language] || 0;
      const b = countsB[language] || 0;
      const widthA = (a / maxCount) * 100;
      const widthB = (b / maxCount) * 100;

      return `
        <div class="comparison-language-row">
          <div class="comparison-language-heading">
            <span class="comparison-language-name">${escapeHTML(language)}</span>
            <span class="comparison-language-counts">${escapeHTML(dataA.profile.login)}: ${a} · ${escapeHTML(dataB.profile.login)}: ${b}</span>
          </div>
          <div class="comparison-language-bars">
            <div class="comparison-language-track"><div class="comparison-language-bar" style="width:${widthA}%;background:#a5f36b"></div></div>
            <div class="comparison-language-track"><div class="comparison-language-bar" style="width:${widthB}%;background:#72b7ff"></div></div>
          </div>
        </div>
      `;
    }).join("")
    : `<p class="muted small">No language metadata was found in the fetched repositories.</p>`;

  $("#comparisonLanguages").insertAdjacentHTML("beforeend", `
    <div class="comparison-language-legend">
      <span><span class="legend-dot" style="background:#a5f36b"></span> ${escapeHTML(dataA.profile.login)}</span>
      <span><span class="legend-dot" style="background:#72b7ff"></span> ${escapeHTML(dataB.profile.login)}</span>
    </div>
  `);
}

function renderComparisonInsights(dataA, dataB, stats) {
  const a = dataA.profile;
  const b = dataB.profile;
  const metrics = [
    ["Followers", stats.statsA["Followers"], stats.statsB["Followers"]],
    ["Public repositories", stats.statsA["Public repositories"], stats.statsB["Public repositories"]],
    ["Stars on fetched repositories", stats.statsA["Stars on fetched repositories"], stats.statsB["Stars on fetched repositories"]],
    ["Forks on fetched repositories", stats.statsA["Forks on fetched repositories"], stats.statsB["Forks on fetched repositories"]]
  ];

  const cards = metrics.map(([label, valueA, valueB]) => {
    let message;

    if (valueA === valueB) {
      message = `Both profiles have the same reported total: ${formatNumber(valueA)}.`;
    } else {
      const winner = valueA > valueB ? a.login : b.login;
      const high = Math.max(valueA, valueB);
      const low = Math.min(valueA, valueB);
      message = `${winner} has the higher total (${formatNumber(high)} versus ${formatNumber(low)}).`;
    }

    return `<article class="comparison-insight"><h4>${escapeHTML(label)}</h4><p>${escapeHTML(message)}</p></article>`;
  });

  const joinedA = new Date(a.created_at);
  const joinedB = new Date(b.created_at);
  const older = joinedA < joinedB ? a.login : joinedA > joinedB ? b.login : null;

  cards.push(`
    <article class="comparison-insight">
      <h4>Account history</h4>
      <p>${older ? `${escapeHTML(older)} created their account earlier.` : "Both accounts were created on the same date."}</p>
    </article>
  `);

  const languagesA = new Set(dataA.repos.map((repo) => repo.language).filter(Boolean));
  const languagesB = new Set(dataB.repos.map((repo) => repo.language).filter(Boolean));
  const shared = [...languagesA].filter((language) => languagesB.has(language));

  cards.push(`
    <article class="comparison-insight">
      <h4>Shared languages</h4>
      <p>${shared.length ? `Both profiles have repositories tagged with ${shared.map(escapeHTML).join(", ")}.` : "No shared primary repository languages were found in the fetched data."}</p>
    </article>
  `);

  $("#comparisonSummary").innerHTML = cards.join("");
}

async function compareProfiles(usernameA, usernameB) {
  const first = usernameA.trim();
  const second = usernameB.trim();

  if (!validUsername(first) || !validUsername(second)) {
    throw new Error("Enter two valid GitHub usernames.");
  }

  if (first.toLowerCase() === second.toLowerCase()) {
    throw new Error("Enter two different usernames to compare profiles.");
  }

  const [dataA, dataB] = await Promise.all([
    fetchProfileData(first),
    fetchProfileData(second)
  ]);

  return { dataA, dataB };
}

$("#profileForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const username = $("#usernameInput").value.trim();
  if (username) analyzeProfile(username);
});

$("#compareForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const usernameA = $("#compareUsernameA").value.trim();
  const usernameB = $("#compareUsernameB").value.trim();

  $("#compareButton").disabled = true;
  $("#comparisonResults").classList.add("hidden");
  setMessage($("#compareMessage"), "Loading both profiles and repositories…");

  try {
    const { dataA, dataB } = await compareProfiles(usernameA, usernameB);
    state.comparison = { dataA, dataB };

    $("#comparisonProfiles").innerHTML =
      renderComparisonProfile(dataA.profile, dataA.repos) +
      `<div class="comparison-vs-large">VS</div>` +
      renderComparisonProfile(dataB.profile, dataB.repos);

    const stats = buildComparisonMetrics(dataA, dataB);
    renderComparisonChart(dataA, dataB);
    renderComparisonLanguages(dataA, dataB);
    renderComparisonInsights(dataA, dataB, stats);

    $("#comparisonResults").classList.remove("hidden");
    setMessage($("#compareMessage"), `Compared @${dataA.profile.login} and @${dataB.profile.login}.`, "success");
  } catch (error) {
    setMessage($("#compareMessage"), error.message || "Unable to compare these profiles.", "error");
  } finally {
    $("#compareButton").disabled = false;
  }
});

/* =========================================
   NAVIGATION AND DASHBOARD CONTROLS
========================================= */

$("#overviewNav").addEventListener("click", () => {
  activateDashboardNav("overviewNav");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

$("#brandHome").addEventListener("click", (event) => {
  event.preventDefault();
  activateDashboardNav("overviewNav");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

$("#compareNav").addEventListener("click", showComparison);

$("#repositoriesNav").addEventListener("click", () => {
  activateDashboardNav("repositoriesNav");
  if (state.profile) $("#repositoriesSection").scrollIntoView({ behavior: "smooth" });
});

$("#activityNav").addEventListener("click", () => {
  activateDashboardNav("activityNav");
  if (state.profile) $("#activitySection").scrollIntoView({ behavior: "smooth" });
});

["repoSearch", "repoLanguageFilter", "repoLicenseFilter", "repoSort"].forEach((id) => {
  $(`#${id}`).addEventListener(id === "repoSearch" ? "input" : "change", () => {
    state.currentPage = 1;
    renderRepositories();
  });
});

$("#exportButton").addEventListener("click", exportRepositories);

// Start with the dashboard and an optional demo profile loaded on demand.
showDashboard();
