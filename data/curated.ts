import type { OAuthGuideSpec } from "@/types/oauth";

/**
 * Pre-indexed seed guides. These load instantly and never hit external APIs.
 *
 * Evidence policy:
 * - "Live Verified" is used only for facts confirmed by fetching the provider's
 *   discovery document (checked 2026-10-28).
 * - "Doc Supported" facts come from the official docs listed in provenance.sources.
 * - Anything about review turnaround or audit cost is "Uncertain": providers do not publish SLAs.
 */

const github: OAuthGuideSpec = {
  slug: "github",
  provider: "GitHub",
  domain: "github.com",
  summary:
    "Register an OAuth App in under 5 minutes. No review, localhost callbacks work, and the same app serves production.",
  frictionTier: "Instant (Zero Review)",
  timeToDev: "5 minutes",
  timeToProduction: "Same day",
  requiresReview: false,
  endpoints: {
    authorizationUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    revocationUrl: "https://api.github.com/applications/{client_id}/grant",
    pkceSupported: true,
    evidence: "Doc Supported",
  },
  scopeMatrix: [
    {
      scope: "(no scope)",
      riskLevel: "low",
      triggersAudit: false,
      description: "Read-only access to public information (public profile, public repos).",
      evidence: "Doc Supported",
    },
    {
      scope: "read:user",
      riskLevel: "low",
      triggersAudit: false,
      description: "Read the authenticated user's full profile data.",
      evidence: "Doc Supported",
    },
    {
      scope: "user:email",
      riskLevel: "low",
      triggersAudit: false,
      description: "Read the user's email addresses, including private ones.",
      evidence: "Doc Supported",
    },
    {
      scope: "read:org",
      riskLevel: "medium",
      triggersAudit: false,
      description: "Read organization membership, teams, and org projects.",
      evidence: "Doc Supported",
    },
    {
      scope: "public_repo",
      riskLevel: "medium",
      triggersAudit: false,
      description: "Read and write access to public repositories only (code, issues, PRs, stars).",
      evidence: "Doc Supported",
    },
    {
      scope: "repo",
      riskLevel: "critical",
      triggersAudit: false,
      description:
        "Full read/write control of all public AND private repositories the user can access. Coarse-grained: there is no read-only private repo scope for OAuth Apps.",
      evidence: "Doc Supported",
      warning: "Private code access: org owners may need to approve your app",
    },
    {
      scope: "workflow",
      riskLevel: "critical",
      triggersAudit: false,
      description: "Add and update GitHub Actions workflow files, which can run arbitrary code in CI.",
      evidence: "Doc Supported",
      warning: "Can modify CI: expect security pushback from org admins",
    },
    {
      scope: "admin:org",
      riskLevel: "critical",
      triggersAudit: false,
      description: "Full management of organizations, teams, and memberships.",
      evidence: "Doc Supported",
      warning: "Org admin power: org owners will scrutinize or block this",
    },
    {
      scope: "delete_repo",
      riskLevel: "critical",
      triggersAudit: false,
      description: "Delete administrable repositories. Rarely justified for an agent.",
      evidence: "Doc Supported",
      warning: "Destructive: most org owners will refuse this scope",
    },
  ],
  agentVsHuman: {
    agentAutomated: [
      "Generate the authorize URL with state + PKCE (S256) code_challenge",
      "Scaffold the callback handler that exchanges ?code= for an access token",
      "Pick the minimal scope set for your agent's actions and flag over-broad scopes like repo",
      "Generate token revocation and 'disconnect' code using the Applications API",
      "Write a smoke test that calls GET /user with the issued token",
    ],
    humanRequired: [
      "Sign in to GitHub and click 'New OAuth App' (Settings → Developer settings → OAuth Apps)",
      "Choose ownership: personal account vs. organization (org-owned apps survive staff turnover)",
      "Copy the Client ID and generate + store the Client Secret (shown only once)",
      "Ask org owners to approve the app if their org enables OAuth App access restrictions",
    ],
  },
  directConsoleUrl: "https://github.com/settings/applications/new",
  confidence: {
    status: "high",
    verifiedLive: false,
    notes:
      "GitHub publishes no OIDC/RFC 8414 discovery document for user OAuth (both /.well-known paths returned 404), so endpoints are taken from official docs rather than probed. Flow and scope behavior are stable and well documented.",
    lastChecked: "2026-10-28",
  },
  nuances: [
    {
      text: "OAuth Apps allow exactly one callback URL. The redirect_uri you send must share its host and port and sit under its path. Loopback (127.0.0.1) redirects may use any port, which helps desktop and CLI agents.",
      evidence: "Doc Supported",
    },
    {
      text: "Organizations can enable OAuth App access restrictions. Your app then cannot read that org's private resources until an org owner approves it. This is the one human gate, and it is per-customer.",
      evidence: "Doc Supported",
    },
    {
      text: "OAuth App tokens do not expire on a timer. GitHub revokes them if unused for a year or if the user revokes access. GitHub Apps issue user tokens that expire after 8 hours and come with refresh tokens.",
      evidence: "Doc Supported",
    },
    {
      text: "GitHub caps active tokens per user/app/scope combination (10). Re-authorizing repeatedly silently revokes the oldest token, so reuse stored tokens instead of re-running OAuth.",
      evidence: "Doc Supported",
    },
    {
      text: "If you need fine-grained, per-repository permissions, consider a GitHub App instead of an OAuth App. It is still instant to create, but has more setup surface (installations, webhooks).",
      evidence: "Doc Supported",
    },
    {
      text: "Listing on GitHub Marketplace involves a review, but it is optional and not required to serve users.",
      evidence: "Doc Supported",
    },
  ],
  provenance: {
    sources: [
      {
        title: "Creating an OAuth app",
        url: "https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app",
      },
      {
        title: "Authorizing OAuth apps",
        url: "https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps",
      },
      {
        title: "Scopes for OAuth apps",
        url: "https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps",
      },
      {
        title: "About OAuth App access restrictions",
        url: "https://docs.github.com/en/organizations/managing-oauth-access-to-your-organizations-data/about-oauth-app-access-restrictions",
      },
      {
        title: "Differences between GitHub Apps and OAuth apps",
        url: "https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps",
      },
    ],
    uncertainties: [
      "PKCE (code_challenge / code_verifier) is documented and 'strongly recommended', but the token exchange still expects the client secret. Do not ship the secret in public clients such as CLIs or desktop apps.",
      "There is no published guidance on whether GitHub will restrict OAuth Apps in favor of GitHub Apps. Treat OAuth Apps as stable for now.",
    ],
  },
};

const slack: OAuthGuideSpec = {
  slug: "slack",
  provider: "Slack",
  domain: "slack.com",
  summary:
    "Instant inside your own workspace. Other workspaces' admins may need to approve installs, and the Slack Marketplace adds a human review.",
  frictionTier: "Tenant Gated (Admin Approval)",
  timeToDev: "15 minutes",
  timeToProduction: "1 day – 6+ weeks",
  requiresReview: false,
  endpoints: {
    authorizationUrl: "https://slack.com/oauth/v2/authorize",
    tokenUrl: "https://slack.com/api/oauth.v2.access",
    issuer: "https://slack.com",
    revocationUrl: "https://slack.com/api/auth.revoke",
    pkceSupported: true,
    evidence: "Doc Supported",
  },
  scopeMatrix: [
    {
      scope: "chat:write",
      riskLevel: "low",
      triggersAudit: false,
      description: "Post messages as the bot in channels it has been added to.",
      evidence: "Doc Supported",
    },
    {
      scope: "channels:read",
      riskLevel: "low",
      triggersAudit: false,
      description: "List public channels and their basic info. No message content.",
      evidence: "Doc Supported",
    },
    {
      scope: "users:read",
      riskLevel: "low",
      triggersAudit: false,
      description: "View people in the workspace (names, profiles). Email requires users:read.email.",
      evidence: "Doc Supported",
    },
    {
      scope: "users:read.email",
      riskLevel: "medium",
      triggersAudit: false,
      description: "View workspace members' email addresses. Admins and Marketplace reviewers expect a clear justification.",
      evidence: "Doc Supported",
      warning: "Workspace admins may ask why you need emails",
    },
    {
      scope: "channels:history",
      riskLevel: "medium",
      triggersAudit: false,
      description:
        "Read message history in public channels the app is in. This is the core scope for agents that summarize or search messages.",
      evidence: "Doc Supported",
    },
    {
      scope: "files:read",
      riskLevel: "medium",
      triggersAudit: false,
      description: "Read files shared in channels and conversations the app can access.",
      evidence: "Doc Supported",
    },
    {
      scope: "groups:history",
      riskLevel: "critical",
      triggersAudit: false,
      description: "Read message history in private channels the app has been added to.",
      evidence: "Doc Supported",
      warning: "Workspace Admin Consent Required in restricted workspaces",
    },
    {
      scope: "im:history",
      riskLevel: "critical",
      triggersAudit: false,
      description:
        "Read direct messages the app is part of. Workspace admins scrutinize this heavily.",
      evidence: "Doc Supported",
      warning: "Workspace Admin Consent Required: DMs are heavily scrutinized",
    },
    {
      scope: "admin.*",
      riskLevel: "critical",
      triggersAudit: false,
      description:
        "Admin API scopes (e.g. admin.users:write). Only an Enterprise org owner/admin can install, and the install must be org-wide.",
      evidence: "Doc Supported",
      warning: "Enterprise org owner must install org-wide",
    },
  ],
  agentVsHuman: {
    agentAutomated: [
      "Generate an app manifest (scopes, redirect URLs, bot user, event subscriptions) you can paste into 'Create from manifest'",
      "Build the 'Add to Slack' authorize URL with state and the bot + user scope lists",
      "Scaffold the callback that calls oauth.v2.access and stores per-workspace bot tokens (team.id → token)",
      "Implement token rotation handling if you enable it (refresh before the 12h expiry)",
      "Add request-signature verification for incoming Events API and interactivity payloads",
    ],
    humanRequired: [
      "Create the app at api.slack.com/apps and pick a development workspace you can install into",
      "Host the redirect URL on a public HTTPS endpoint (a tunnel such as ngrok works for local dev)",
      "Turn on Public Distribution (Manage Distribution) before other workspaces can install",
      "Get a workspace admin to approve the app in each customer workspace that restricts app installs",
      "Optionally submit to the Slack Marketplace: listing copy, privacy policy, support page, and a scope-by-scope justification for review",
    ],
  },
  directConsoleUrl: "https://api.slack.com/apps",
  confidence: {
    status: "medium",
    verifiedLive: true,
    notes:
      "Live probe of slack.com/.well-known/openid-configuration returned 200 with issuer https://slack.com. That discovery doc covers 'Sign in with Slack' (OIDC) only. The bot install flow (oauth.v2) endpoints come from the docs. Marketplace review timing is not published.",
    lastChecked: "2026-10-28",
  },
  nuances: [
    {
      text: "The OIDC discovery document advertises different endpoints (/openid/connect/authorize, openid.connect.token) than the bot install flow. Use oauth.v2 for agents that act in a workspace and OIDC only for 'Sign in with Slack'.",
      evidence: "Live Verified",
    },
    {
      text: "Installs in your own workspace work immediately. Installing into other workspaces requires enabling Public Distribution, but no review.",
      evidence: "Doc Supported",
    },
    {
      text: "Workspaces can require admin approval for app installs, and Enterprise orgs control apps centrally. Expect a per-customer approval step you cannot automate.",
      evidence: "Doc Supported",
    },
    {
      text: "Since 2025, commercially distributed apps that are NOT in the Slack Marketplace get much lower rate limits on conversations.history and conversations.replies. This hits AI agents that read history hard, and may make a Marketplace listing effectively mandatory.",
      evidence: "Doc Supported",
    },
    {
      text: "PKCE trap for bot tokens: PKCE is supported (S256 only), but enabling it is one-way and permanently marks your app as a public client. After that, localhost and custom-scheme redirects count as 'desktop redirects', which cannot request bot scopes. If your agent needs a bot token, do not enable PKCE. Keep the client secret on your server instead.",
      evidence: "Doc Supported",
    },
    {
      text: "Bot tokens do not expire unless you opt in to token rotation. Once rotation is on it cannot be turned off, and access tokens then expire every 12 hours.",
      evidence: "Doc Supported",
    },
    {
      text: "Slack's API terms restrict how message data may be stored and used, including for training models. Review them before building an agent that indexes messages.",
      evidence: "Doc Supported",
    },
  ],
  provenance: {
    sources: [
      { title: "Installing with OAuth", url: "https://docs.slack.dev/authentication/installing-with-oauth/" },
      { title: "Permission scopes reference", url: "https://docs.slack.dev/reference/scopes/" },
      { title: "Distributing your app", url: "https://docs.slack.dev/app-management/distribution/" },
      { title: "Sign in with Slack (OIDC)", url: "https://docs.slack.dev/authentication/sign-in-with-slack/" },
      { title: "Using PKCE (public clients, desktop redirects)", url: "https://docs.slack.dev/authentication/using-pkce/" },
      { title: "Token rotation", url: "https://docs.slack.dev/authentication/using-token-rotation/" },
      {
        title: "Rate limit changes for non-Marketplace apps (changelog)",
        url: "https://docs.slack.dev/changelog/2025/05/29/rate-limit-changes-for-non-marketplace-apps/",
      },
      {
        title: "OIDC discovery document (live probe)",
        url: "https://slack.com/.well-known/openid-configuration",
      },
    ],
    uncertainties: [
      "Slack Marketplace review turnaround is not published. Developer reports range from about 1 to 6+ weeks, with back-and-forth on scope justifications.",
      "Marketplace eligibility rules (e.g. minimum active installs) have changed over time. Confirm the current guidelines before you plan a launch date.",
      "We could not confirm in the docs whether plain-http localhost redirect URLs are accepted. Plan on an HTTPS tunnel for local development.",
    ],
  },
};

const googleWorkspace: OAuthGuideSpec = {
  slug: "google-workspace",
  provider: "Google Workspace",
  domain: "google.com",
  summary:
    "Testing mode works in minutes but caps you at 100 users. Gmail and Drive scopes need brand and scope verification, and restricted scopes also need an annual CASA security assessment.",
  frictionTier: "Review Wall (Audit/Verification)",
  timeToDev: "30 minutes",
  timeToProduction: "2 – 12+ weeks",
  requiresReview: true,
  endpoints: {
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    issuer: "https://accounts.google.com",
    revocationUrl: "https://oauth2.googleapis.com/revoke",
    pkceSupported: true,
    evidence: "Live Verified",
  },
  scopeMatrix: [
    {
      scope: "openid email profile",
      riskLevel: "low",
      triggersAudit: false,
      description: "Sign-in and basic profile. Non-sensitive: no scope verification needed.",
      evidence: "Doc Supported",
    },
    {
      scope: "https://www.googleapis.com/auth/drive.file",
      riskLevel: "low",
      triggersAudit: false,
      description:
        "Access only files the user opens or creates with your app. Non-sensitive, and Google's recommended way to avoid the restricted Drive scopes.",
      evidence: "Doc Supported",
    },
    {
      scope: "https://www.googleapis.com/auth/calendar.events",
      riskLevel: "medium",
      triggersAudit: true,
      description: "Read/write calendar events. Sensitive: requires sensitive-scope verification (no CASA).",
      evidence: "Doc Supported",
      warning: "Sensitive scope: verification required (demo video, privacy policy)",
    },
    {
      scope: "https://www.googleapis.com/auth/spreadsheets",
      riskLevel: "medium",
      triggersAudit: true,
      description: "Read/write all of the user's Google Sheets. Sensitive: requires sensitive-scope verification.",
      evidence: "Doc Supported",
      warning: "Sensitive scope: verification required (demo video, privacy policy)",
    },
    {
      scope: "https://www.googleapis.com/auth/gmail.send",
      riskLevel: "medium",
      triggersAudit: true,
      description: "Send email on the user's behalf (no read access). Sensitive: requires verification, not CASA.",
      evidence: "Doc Supported",
      warning: "Sensitive scope: verification required (demo video, privacy policy)",
    },
    {
      scope: "https://www.googleapis.com/auth/gmail.readonly",
      riskLevel: "critical",
      triggersAudit: true,
      description:
        "Read all email and settings. Restricted: requires restricted-scope verification plus an annual CASA security assessment.",
      evidence: "Doc Supported",
      warning: "Restricted scope: Requires CASA Audit (annual) + restricted verification",
    },
    {
      scope: "https://www.googleapis.com/auth/gmail.modify",
      riskLevel: "critical",
      triggersAudit: true,
      description: "Read, compose, send, and label email (no permanent delete). Restricted: verification plus CASA.",
      evidence: "Doc Supported",
      warning: "Restricted scope: Requires CASA Audit (annual) + restricted verification",
    },
    {
      scope: "https://mail.google.com/",
      riskLevel: "critical",
      triggersAudit: true,
      description: "Full mailbox access including permanent deletion. Restricted: verification plus CASA. Avoid unless essential.",
      evidence: "Doc Supported",
      warning: "Restricted scope: Requires CASA Audit (annual) + restricted verification",
    },
    {
      scope: "https://www.googleapis.com/auth/drive.readonly",
      riskLevel: "critical",
      triggersAudit: true,
      description: "Read all Drive files. Restricted: verification plus CASA. Prefer drive.file plus the Picker API.",
      evidence: "Doc Supported",
      warning: "Restricted scope: Requires CASA Audit (annual) + restricted verification",
    },
    {
      scope: "https://www.googleapis.com/auth/drive",
      riskLevel: "critical",
      triggersAudit: true,
      description: "Full read/write/delete on all Drive files. Restricted: verification plus CASA.",
      evidence: "Doc Supported",
      warning: "Restricted scope: Requires CASA Audit (annual) + restricted verification",
    },
  ],
  agentVsHuman: {
    agentAutomated: [
      "Resolve endpoints and PKCE support from accounts.google.com/.well-known/openid-configuration",
      "Classify every requested scope as non-sensitive, sensitive, or restricted, and suggest narrower substitutes (e.g. drive.file instead of drive)",
      "Generate the authorize URL with access_type=offline, prompt=consent, PKCE, and incremental authorization",
      "Scaffold the token exchange and refresh logic, and handle partially granted scopes (users can untick scopes on the granular consent screen)",
      "Draft the per-scope justification text and the demo-video shot list for the verification submission",
    ],
    humanRequired: [
      "Create a Google Cloud project and configure the Google Auth Platform (consent screen / branding)",
      "Prove ownership of every authorized domain in Google Search Console (DNS TXT record)",
      "Publish a homepage and a privacy policy on that verified domain, with a disclosure that matches Google's Limited Use requirements",
      "Add test users (max 100) while in Testing mode",
      "Record and upload an unlisted YouTube demo video showing the consent flow and how each scope is used",
      "Respond to Google reviewer emails. Delays here are the main cause of multi-week timelines",
      "For restricted scopes: complete a CASA assessment with an authorized lab, pay its fee, and recertify every 12 months",
    ],
  },
  directConsoleUrl: "https://console.cloud.google.com/auth/overview",
  confidence: {
    status: "high",
    verifiedLive: true,
    notes:
      "Live probe of accounts.google.com/.well-known/openid-configuration returned 200. It confirmed the authorization, token, and revocation endpoints and code_challenge_methods_supported: [plain, S256]. The verification requirements are well documented. Turnaround times and CASA pricing are not.",
    lastChecked: "2026-10-28",
  },
  nuances: [
    {
      text: "In Testing mode, refresh tokens for apps requesting non-basic scopes expire after 7 days. Agents that run unattended will silently lose access until you publish the app.",
      evidence: "Doc Supported",
    },
    {
      text: "An unverified app using sensitive or restricted scopes is capped at 100 users, and those users see the 'Google hasn't verified this app' warning screen.",
      evidence: "Doc Supported",
    },
    {
      text: "Internal apps (user type 'Internal') used only within your own Workspace organization skip verification entirely. This is the fastest path for internal tools.",
      evidence: "Doc Supported",
    },
    {
      text: "Workspace admins can block or restrict third-party apps via API Controls. Enterprise customers may need to mark your client ID as trusted before their users can connect.",
      evidence: "Doc Supported",
    },
    {
      text: "Each Google Account can hold a limited number of refresh tokens per client ID (100). Issuing more silently invalidates the oldest ones.",
      evidence: "Doc Supported",
    },
    {
      text: "Adding a new sensitive or restricted scope after approval triggers a new verification. Request everything you will need in the first submission.",
      evidence: "Doc Supported",
    },
  ],
  provenance: {
    sources: [
      {
        title: "Using OAuth 2.0 for Web Server Applications",
        url: "https://developers.google.com/identity/protocols/oauth2/web-server",
      },
      {
        title: "Sensitive scope verification",
        url: "https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification",
      },
      {
        title: "Restricted scope verification",
        url: "https://developers.google.com/identity/protocols/oauth2/production-readiness/restricted-scope-verification",
      },
      {
        title: "Google API Services User Data Policy (Limited Use)",
        url: "https://developers.google.com/terms/api-services-user-data-policy",
      },
      {
        title: "CASA (Cloud Application Security Assessment)",
        url: "https://appdefensealliance.dev/casa",
      },
      {
        title: "OIDC discovery document (live probe)",
        url: "https://accounts.google.com/.well-known/openid-configuration",
      },
    ],
    uncertainties: [
      "Verification turnaround is not guaranteed. Sensitive scopes commonly take days to a few weeks, and restricted scopes plus CASA commonly take 6–12+ weeks, depending mostly on review rounds.",
      "CASA assessment cost depends on the lab and tier. Published and anecdotal figures range from a few hundred to several thousand USD per year.",
      "Exact scope classifications change occasionally. Re-check the scope against Google's current sensitive/restricted lists before submitting.",
    ],
  },
};

export const curatedGuides: OAuthGuideSpec[] = [github, slack, googleWorkspace];

export function getCuratedGuide(slug: string): OAuthGuideSpec | undefined {
  return curatedGuides.find((g) => g.slug === slug);
}

/** Matches "github.com", "api.github.com", etc. to a curated guide. */
export function getCuratedGuideByDomain(domain: string): OAuthGuideSpec | undefined {
  const d = domain.toLowerCase();
  return curatedGuides.find((g) => d === g.domain || d.endsWith(`.${g.domain}`));
}
