import { randomUUID } from "crypto";
import { config } from "../config.js";
import { upsertAccount, getAccountById, getAccountByPlatform } from "../db.js";

const GITHUB_AUTH_URL = "https://github.com/login/oauth/authorize";
const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";
const GITHUB_USER_URL = "https://api.github.com/user";

export function githubConfigured() {
  return Boolean(config.githubClientId && config.githubClientSecret);
}

function requireConfig() {
  if (!githubConfigured()) {
    throw new Error("GitHub not configured — set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env");
  }
}

/**
 * Generate GitHub OAuth authorization URL
 */
export function buildAuthUrl(state = randomUUID()) {
  requireConfig();
  const params = new URLSearchParams({
    client_id: config.githubClientId,
    redirect_uri: config.githubRedirectUri,
    state,
    scope: "repo read:user",
  });
  return `${GITHUB_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange OAuth callback code for access token and fetch profile
 */
export async function exchangeCode(code) {
  requireConfig();

  const body = new URLSearchParams({
    client_id: config.githubClientId,
    client_secret: config.githubClientSecret,
    code,
    redirect_uri: config.githubRedirectUri,
  });

  const tokenRes = await fetch(GITHUB_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    const errorMsg = tokenData.error_description || tokenData.error || `HTTP ${tokenRes.status}`;
    throw new Error(`GitHub token exchange failed: ${errorMsg}`);
  }

  // Fetch GitHub User Profile info
  const userinfoRes = await fetch(GITHUB_USER_URL, {
    headers: {
      Authorization: `token ${tokenData.access_token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Agentic-OS",
    },
  });

  const profile = await userinfoRes.json().catch(() => ({}));
  if (!userinfoRes.ok) {
    throw new Error(`Failed to fetch GitHub profile: ${profile.message || userinfoRes.status}`);
  }

  const sub = String(profile.id);
  const name = profile.name || profile.login || "GitHub User";
  const email = profile.email || null;
  const avatarUrl = profile.avatar_url || null;

  const accountId = upsertAccount({
    platform: "github",
    zernio_account_id: sub,
    account_urn: profile.login, // using login as urn mapping for github
    username: profile.login,
    display_name: name,
    avatar_url: avatarUrl,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token || null, // Github doesn't always provide refresh tokens
    token_expires_at: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : null,
    auth_type: "direct",
  });

  return {
    id: accountId,
    sub,
    name,
    email,
    username: profile.login,
    avatarUrl,
  };
}

/**
 * Fetch repositories for the connected GitHub account.
 */
export async function listGithubRepos() {
  const account = getAccountByPlatform("github");
  if (!account || !account.access_token) {
    return { error: "No GitHub account connected. Please connect it in settings." };
  }

  const res = await fetch("https://api.github.com/user/repos?sort=updated&per_page=10", {
    headers: {
      Authorization: `token ${account.access_token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Agentic-OS",
    },
  });

  if (!res.ok) {
    return { error: `Failed to fetch repos: HTTP ${res.status}` };
  }

  const repos = await res.json();
  return repos.map(r => ({
    name: r.name,
    full_name: r.full_name,
    private: r.private,
    html_url: r.html_url,
    description: r.description,
    updated_at: r.updated_at,
  }));
}

/**
 * Fetch notifications for the connected GitHub account.
 */
export async function getGithubNotifications() {
  const account = getAccountByPlatform("github");
  if (!account || !account.access_token) {
    return { error: "No GitHub account connected. Please connect it in settings." };
  }

  const res = await fetch("https://api.github.com/notifications?all=false&per_page=10", {
    headers: {
      Authorization: `token ${account.access_token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Agentic-OS",
    },
  });

  if (!res.ok) {
    return { error: `Failed to fetch notifications: HTTP ${res.status}` };
  }

  const notifs = await res.json();
  return notifs.map(n => ({
    title: n.subject.title,
    type: n.subject.type,
    repository: n.repository.full_name,
    reason: n.reason,
    updated_at: n.updated_at,
  }));
}

/**
 * Create a new GitHub repository.
 */
export async function githubCreateRepo({ name, description, is_private = false }) {
  const account = getAccountByPlatform("github");
  if (!account || !account.access_token) {
    return { error: "No GitHub account connected. Please connect it in settings." };
  }

  const res = await fetch("https://api.github.com/user/repos", {
    method: "POST",
    headers: {
      Authorization: `token ${account.access_token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Agentic-OS",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name, description, private: is_private, auto_init: true }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { error: `Failed to create repo: ${err.message || res.status}` };
  }

  const repo = await res.json();
  return {
    success: true,
    name: repo.full_name,
    html_url: repo.html_url,
    clone_url: repo.clone_url,
  };
}

/**
 * Create an issue in a GitHub repository.
 */
export async function githubCreateIssue({ repo_full_name, title, body }) {
  const account = getAccountByPlatform("github");
  if (!account || !account.access_token) {
    return { error: "No GitHub account connected. Please connect it in settings." };
  }

  const res = await fetch(`https://api.github.com/repos/${repo_full_name}/issues`, {
    method: "POST",
    headers: {
      Authorization: `token ${account.access_token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Agentic-OS",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, body }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    return { error: `Failed to create issue: ${err.message || res.status}` };
  }

  const issue = await res.json();
  return {
    success: true,
    number: issue.number,
    html_url: issue.html_url,
    title: issue.title,
  };
}
