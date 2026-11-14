import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { config, ROOT_DIR } from "../config.js";
import { upsertAccount, getAccountById, getAccountByPlatform } from "../db.js";

const LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2/authorization";
const LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken";
const LINKEDIN_USERINFO_URL = "https://api.linkedin.com/v2/userinfo";
const LINKEDIN_REST_API = "https://api.linkedin.com/rest";
const LINKEDIN_VERSION = "202401";

export function linkedinConfigured() {
  return Boolean(config.linkedinClientId && config.linkedinClientSecret);
}

function requireConfig() {
  if (!linkedinConfigured()) {
    throw new Error("LinkedIn not configured — set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET in .env");
  }
}

/**
 * Generate LinkedIn OAuth 2.0 authorization URL
 */
export function buildAuthUrl(state = randomUUID()) {
  requireConfig();
  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.linkedinClientId,
    redirect_uri: config.linkedinRedirectUri,
    state,
    scope: "openid profile email w_member_social",
  });
  return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange OAuth callback code for access token and fetch profile
 */
export async function exchangeCode(code) {
  requireConfig();

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: config.linkedinClientId,
    client_secret: config.linkedinClientSecret,
    redirect_uri: config.linkedinRedirectUri,
  });

  const tokenRes = await fetch(LINKEDIN_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    const errorMsg = tokenData.error_description || tokenData.error || `HTTP ${tokenRes.status}`;
    throw new Error(`LinkedIn token exchange failed: ${errorMsg}`);
  }

  // Fetch Member Profile info via OpenID Connect userinfo endpoint
  const userinfoRes = await fetch(LINKEDIN_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  const profile = await userinfoRes.json().catch(() => ({}));
  const sub = profile.sub || tokenData.sub || randomUUID();
  const name = profile.name || [profile.given_name, profile.family_name].filter(Boolean).join(" ") || "LinkedIn User";
  const email = profile.email || null;
  const avatarUrl = profile.picture || null;
  const personUrn = `urn:li:person:${sub}`;

  const accountId = upsertAccount({
    platform: "linkedin",
    zernio_account_id: sub,
    account_urn: personUrn,
    username: email || name,
    display_name: name,
    avatar_url: avatarUrl,
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token || null,
    token_expires_at: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : null,
    auth_type: "direct",
  });

  return {
    id: accountId,
    sub,
    name,
    email,
    personUrn,
    avatarUrl,
  };
}

/**
 * Upload an image to LinkedIn using REST Images API
 */
async function uploadImage({ accessToken, personUrn, localImagePath }) {
  const cleanPath = localImagePath.replace(/^\//, "");
  const fullPath = join(ROOT_DIR, cleanPath);
  if (!existsSync(fullPath)) {
    throw new Error(`Image file not found: ${localImagePath}`);
  }

  const imageBytes = readFileSync(fullPath);
  const ext = localImagePath.split(".").pop().toLowerCase();
  const contentType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

  // 1. Initialize image upload
  const initRes = await fetch(`${LINKEDIN_REST_API}/images?action=initializeUpload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "LinkedIn-Version": LINKEDIN_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: personUrn,
      },
    }),
  });

  const initData = await initRes.json().catch(() => ({}));
  if (!initRes.ok || !initData?.value?.uploadUrl) {
    throw new Error(`LinkedIn image init failed: ${initData?.message || initRes.statusText || initRes.status}`);
  }

  const { uploadUrl, image: imageUrn } = initData.value;

  // 2. Upload binary bytes to the provided uploadUrl
  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": contentType,
    },
    body: imageBytes,
  });

  if (!putRes.ok) {
    throw new Error(`LinkedIn image upload failed: HTTP ${putRes.status}`);
  }

  return imageUrn;
}

/**
 * Upload a PDF Document (Carousel) to LinkedIn via the official Documents API
 */
async function uploadDocument({ accessToken, personUrn, localDocPath, title = "Carousel Document" }) {
  const cleanPath = localDocPath.replace(/^\//, "");
  const fullPath = join(ROOT_DIR, cleanPath);
  if (!existsSync(fullPath)) {
    throw new Error(`Local document not found: ${fullPath}`);
  }

  const docBytes = readFileSync(fullPath);

  // 1. Initialize Document Upload
  const initRes = await fetch(`${LINKEDIN_REST_API}/documents?action=initializeUpload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "LinkedIn-Version": LINKEDIN_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      initializeUploadRequest: {
        owner: personUrn,
      },
    }),
  });

  const initData = await initRes.json().catch(() => ({}));
  if (!initRes.ok || !initData?.value?.uploadUrl) {
    throw new Error(`LinkedIn document init failed: ${initData?.message || initRes.statusText || initRes.status}`);
  }

  const { uploadUrl, document: docUrn } = initData.value;

  // 2. Upload binary PDF bytes to uploadUrl
  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/pdf",
    },
    body: docBytes,
  });

  if (!putRes.ok) {
    throw new Error(`LinkedIn document upload failed: HTTP ${putRes.status}`);
  }

  return docUrn;
}

/**
 * Publish a post (text, image, or PDF document carousel) directly to LinkedIn feed
 */
export async function publishLinkedInPost({ accountId, content, mediaPath }) {
  let account = accountId ? getAccountById(accountId) : null;
  if (!account) {
    account = getAccountByPlatform("linkedin");
  }

  if (!account || !account.access_token) {
    throw new Error("No connected LinkedIn account with valid credentials. Connect LinkedIn in Settings first.");
  }

  const accessToken = account.access_token;
  const personUrn = account.account_urn || (account.zernio_account_id ? `urn:li:person:${account.zernio_account_id}` : null);
  if (!personUrn) {
    throw new Error("Unable to determine LinkedIn Author URN.");
  }

  let mediaUrn = null;
  let isPdf = false;
  if (mediaPath) {
    if (mediaPath.toLowerCase().endsWith(".pdf")) {
      isPdf = true;
      mediaUrn = await uploadDocument({
        accessToken,
        personUrn,
        localDocPath: mediaPath,
        title: "Technical Carousel Deck",
      });
    } else {
      mediaUrn = await uploadImage({
        accessToken,
        personUrn,
        localImagePath: mediaPath,
      });
    }
  }

  // Construct Post payload for LinkedIn REST API
  const postBody = {
    author: personUrn,
    commentary: content,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  if (mediaUrn) {
    postBody.content = {
      media: {
        title: isPdf ? "Technical Carousel Deck" : "Image",
        id: mediaUrn,
      },
    };
  }

  const postRes = await fetch(`${LINKEDIN_REST_API}/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "LinkedIn-Version": LINKEDIN_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(postBody),
  });

  if (postRes.ok || postRes.status === 201) {
    const postId = postRes.headers.get("x-restli-id") || randomUUID();
    return {
      id: postId,
      status: "published",
      platform: "linkedin",
      url: `https://www.linkedin.com/feed/`,
    };
  }

  // Fallback to legacy ugcPosts if REST Posts API returns specific schema error
  const errJson = await postRes.json().catch(() => ({}));
  console.warn("LinkedIn REST /posts failed, attempting UGC fallback:", errJson?.message || postRes.status);

  const ugcBody = {
    author: personUrn,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: {
          text: content,
        },
        shareMediaCategory: imageUrn ? "IMAGE" : "NONE",
        ...(imageUrn
          ? {
              media: [
                {
                  status: "READY",
                  media: imageUrn,
                  title: { text: "Image" },
                },
              ],
            }
          : {}),
      },
    },
    visibility: {
      "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
    },
  };

  const ugcRes = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(ugcBody),
  });

  const ugcData = await ugcRes.json().catch(() => ({}));
  if (ugcRes.ok || ugcRes.status === 201) {
    return {
      id: ugcData.id || ugcRes.headers.get("x-restli-id") || randomUUID(),
      status: "published",
      platform: "linkedin",
      url: `https://www.linkedin.com/feed/`,
    };
  }

  const errMsg = ugcData.message || errJson.message || `LinkedIn API error HTTP ${postRes.status}`;
  throw new Error(`LinkedIn publishing failed: ${errMsg}`);
}
