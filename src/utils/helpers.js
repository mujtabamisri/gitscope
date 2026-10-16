
const numberFormat = new Intl.NumberFormat("en-US");

export function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

export function formatNumber(value) {
  return numberFormat.format(Number(value) || 0);
}

export function formatDate(value) {
  if (!value) return "Unknown";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

export function relativeDate(value) {
  if (!value) return "Unknown";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  const days = Math.floor(
    (Date.now() - date.getTime()) / 86400000
  );

  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;

  return `${Math.floor(days / 365)} years ago`;
}

export function validUsername(username) {
  return /^(?!.*--)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(username);
}

export function collectLanguages(repos) {
  const counts = {};

  for (const repo of repos) {
    if (repo.language) {
      counts[repo.language] = (counts[repo.language] || 0) + 1;
    }
  }

  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

export function calculateRepoHealth(repo) {
  let score = 100;
  const signals = [];

  const lastUpdated = repo.pushed_at
    ? new Date(repo.pushed_at)
    : null;

  const daysSinceUpdate =
    lastUpdated && !Number.isNaN(lastUpdated.getTime())
      ? Math.floor((Date.now() - lastUpdated.getTime()) / 86400000)
      : Infinity;

  if (daysSinceUpdate > 365) {
    score -= 30;
    signals.push("No recent push in over a year");
  } else if (daysSinceUpdate > 180) {
    score -= 20;
    signals.push("No recent push in 6+ months");
  } else if (daysSinceUpdate > 90) {
    score -= 10;
    signals.push("No recent push in 3+ months");
  }

  if (!repo.description?.trim()) {
    score -= 10;
    signals.push("Missing description");
  }

  if (!repo.license) {
    score -= 10;
    signals.push("No detected license");
  }

  if (repo.archived) {
    score -= 30;
    signals.push("Archived repository");
  }

  score = Math.max(0, Math.min(100, score));

  const label = score >= 80
    ? "Healthy"
    : score >= 60
      ? "Fair"
      : score >= 40
        ? "Needs attention"
        : "Low signals";

  return { score, label, signals, daysSinceUpdate };
}
