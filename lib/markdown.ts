import type { OAuthGuideSpec } from "@/types/oauth";

const esc = (s: string) => s.replace(/\|/g, "\\|").replace(/\n/g, " ");

/** Portable Markdown version of a guide for READMEs, tickets, and Slack threads. */
export function guideToMarkdown(g: OAuthGuideSpec, url?: string): string {
  const lines: string[] = [];
  lines.push(`# ${g.provider} OAuth Readiness Guide`, "");
  if (g.summary) lines.push(`> ${g.summary}`, "");
  lines.push(
    "| Friction tier | Time to dev | Time to production | Provider review |",
    "|---|---|---|---|",
    `| ${g.frictionTier} | ${g.timeToDev} | ${g.timeToProduction} | ${g.requiresReview ? "Required" : "Not required"} |`,
    "",
    `**Developer console:** ${g.directConsoleUrl}`,
    "",
  );

  const e = g.endpoints;
  lines.push(`## Endpoints${e.evidence ? ` [${e.evidence}]` : ""}`, "");
  const rows: [string, string | undefined][] = [
    ["Authorization", e.authorizationUrl],
    ["Token", e.tokenUrl],
    ["Issuer", e.issuer],
    ["Revocation", e.revocationUrl],
  ];
  for (const [k, v] of rows) lines.push(`- **${k}:** ${v ? `\`${v}\`` : "_not confirmed_"}`);
  lines.push(`- **PKCE (S256):** ${e.pkceSupported === true ? "Supported" : e.pkceSupported === false ? "Not supported" : "Unknown"}`, "");

  lines.push("## Scopes", "", "| Scope | Risk | Triggers review | Evidence | Notes |", "|---|---|---|---|---|");
  for (const s of g.scopeMatrix) {
    lines.push(
      `| \`${esc(s.scope)}\` | ${s.riskLevel} | ${s.triggersAudit ? "Yes" : "No"} | ${s.evidence ?? ""} | ${esc(s.warning ? `${s.warning}. ${s.description}` : s.description)} |`,
    );
  }
  lines.push("");

  lines.push("## What the agent automates", "");
  for (const a of g.agentVsHuman.agentAutomated) lines.push(`- ${a}`);
  lines.push("", "## What you must do", "");
  for (const h of g.agentVsHuman.humanRequired) lines.push(`- [ ] ${h}`);
  lines.push("");

  if (g.nuances?.length) {
    lines.push("## Requirements & gotchas", "");
    for (const n of g.nuances) lines.push(`- **[${n.evidence}]** ${n.text}`);
    lines.push("");
  }

  lines.push("## Evidence", "", `**Confidence:** ${g.confidence.status}${g.confidence.verifiedLive ? " (live probed)" : ""}`, "", g.confidence.notes, "");
  if (g.provenance?.uncertainties.length) {
    lines.push("### Could not verify", "");
    for (const u of g.provenance.uncertainties) lines.push(`- ${u}`);
    lines.push("");
  }
  if (g.provenance?.sources.length) {
    lines.push("### Sources", "");
    for (const s of g.provenance.sources) lines.push(`- [${s.title}](${s.url})`);
    lines.push("");
  }
  const origin = g.investigation
    ? `Generated live by the investigation agent (${g.investigation.model}) on ${g.investigation.generatedAt.slice(0, 10)}`
    : `Curated guide, last checked ${g.confidence.lastChecked ?? "unknown"}`;
  lines.push("---", `_${origin}${url ? ` · ${url}` : ""}_`, "");
  return lines.join("\n");
}
