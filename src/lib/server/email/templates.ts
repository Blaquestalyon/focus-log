/**
 * Email templates (§8 "Email templates"): HTML (table layout, inline CSS) + a plain-text part.
 * Dark card on navy, 4px ribbon band, gold wordmark with a four-point sparkle, no tracking.
 */
import { formatDelta, formatDuration, formatShare, formatTime, formatWeekRange, WD_SHORT } from '@/lib/format';
import { parseDateStr } from '@/lib/time';
import type { WeeklySummary } from '@/lib/weekly-core';
import type { EmailContent } from './postmark';

const C = {
  body: '#0C0E16',
  card: '#121522',
  text: '#F4F1E8',
  secondary: '#B4B7C6',
  muted: '#7F849A',
  link: '#E8C468',
  gold: '#D4A745',
  goldText: '#E2BC5C',
  onGold: '#0B0B10',
  border: '#262B3F',
  ribbonSolid: '#1546C9',
};
const FONT = 'Archivo, Arial, Helvetica, sans-serif';
const MONO = "'JetBrains Mono', Menlo, Consolas, monospace";
const PROJECT_HEX: Record<string, string> = {
  azure: '#4C8DFF', violet: '#9B7BFF', rose: '#FF6B9A', coral: '#FF8A5B',
  lime: '#A6E05A', teal: '#2ED3B7', sand: '#C9B48A', slate: '#8A93B8',
};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 8px 0;"><tr><td bgcolor="${C.gold}" style="border-radius:4px;">
<a href="${esc(href)}" style="display:inline-block;padding:12px 20px;font-family:${FONT};font-size:15px;font-weight:700;color:${C.onGold};text-decoration:none;border-radius:4px;">${esc(label)}</a>
</td></tr></table>`;
}

function eyebrow(text: string): string {
  return `<div style="font-family:${MONO};font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${C.link};margin:0 0 12px 0;">${esc(text)}</div>`;
}

function layout(appUrl: string, inner: string, preheader: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>Focus Log</title></head>
<body bgcolor="${C.body}" style="margin:0;padding:0;background:${C.body};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.body}" style="background:${C.body};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.card}" style="width:100%;max-width:560px;background:${C.card};border:1px solid ${C.border};border-radius:8px;">
<tr><td height="4" bgcolor="${C.ribbonSolid}" style="height:4px;line-height:4px;font-size:0;background:${C.ribbonSolid};background-image:linear-gradient(90deg,#0B1E6E 0%,#1546C9 45%,#22C3FF 100%);border-radius:8px 8px 0 0;">&nbsp;</td></tr>
<tr><td style="padding:24px 32px 0 32px;font-family:${FONT};">
<span style="color:${C.goldText};font-size:18px;">&#10022;</span>
<span style="font-family:${FONT};font-size:18px;font-weight:800;letter-spacing:0.01em;color:${C.goldText};">Focus Log</span>
</td></tr>
<tr><td style="padding:24px 32px 32px 32px;font-family:${FONT};font-size:16px;line-height:1.5;color:${C.text};">
${inner}
</td></tr>
</table>
<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;">
<tr><td style="padding:16px 32px;font-family:${FONT};font-size:12px;line-height:1.5;color:${C.muted};">
Sent by your Focus Log at power-in-numbers.net. Turn these emails off in Settings: <a href="${esc(appUrl)}/settings" style="color:${C.muted};">${esc(appUrl)}/settings</a>
</td></tr></table>
</td></tr></table>
</body></html>`;
}

function textFooter(appUrl: string): string {
  return `\n\n--\nSent by your Focus Log at power-in-numbers.net. Turn these emails off in Settings: ${appUrl}/settings\n`;
}

export function nudgeEmail(p: {
  appUrl: string; sessionId: string; taskName: string; projectName: string | null; startedAt: string; elapsedSeconds: number; tz: string;
}): EmailContent {
  const dur = formatDuration(p.elapsedSeconds);
  const subject = `Your timer has been running for ${dur}`;
  const url = `${p.appUrl}/?nudge=${p.sessionId}`;
  const where = p.projectName ? `${p.taskName} (${p.projectName})` : p.taskName;
  const started = formatTime(p.startedAt, p.tz);
  const bodyLine = `Your Focus Log timer for ${where} started at ${started} and has been running for ${dur} without a pause.`;
  const html = layout(
    p.appUrl,
    `${eyebrow('Still running')}
<h1 style="margin:0 0 12px 0;font-family:${FONT};font-size:24px;line-height:1.25;font-weight:700;color:${C.text};">Still on ${esc(p.taskName)}?</h1>
<p style="margin:0;color:${C.secondary};">${esc(bodyLine)}</p>
${button('Open Focus Log', url)}
<p style="margin:8px 0 0 0;color:${C.secondary};font-size:14px;">If you forgot to stop it, you can pick when you really stopped.</p>`,
    bodyLine,
  );
  const text = `STILL RUNNING\nStill on ${p.taskName}?\n\n${bodyLine}\n\nOpen Focus Log: ${url}\n\nIf you forgot to stop it, you can pick when you really stopped.${textFooter(p.appUrl)}`;
  return { subject, html, text, tag: 'nudge' };
}

export function weeklyEmail(p: { appUrl: string; summary: WeeklySummary; nowYear?: number }): EmailContent {
  const s = p.summary;
  const range = formatWeekRange(s.monday).toUpperCase();
  const total = formatDuration(s.total_seconds);
  const delta = formatDelta(s.total_seconds, s.previous_total_seconds);
  const deltaLine = delta === '—' ? 'Nothing logged the week before' : delta === 'No change' ? 'No change vs the week before' : `${delta} vs the week before`;
  const reportsUrl = `${p.appUrl}/reports?period=week&start=${s.monday}`;
  const addUrl = `${p.appUrl}/history?add=1&date=${s.monday}`;
  const cell = `padding:8px 0;border-bottom:1px solid ${C.border};font-family:${FONT};font-size:14px;`;
  const num = `${cell}text-align:right;color:${C.text};white-space:nowrap;`;
  const th = `padding:0 0 8px 0;font-family:${MONO};font-size:11px;letter-spacing:0.08em;text-transform:uppercase;color:${C.muted};text-align:left;`;
  const projects = s.projects
    .map((pr) => {
      const sq = pr.color ? PROJECT_HEX[pr.color] : '#363C56';
      const share = formatShare(s.total_seconds ? (pr.seconds / s.total_seconds) * 100 : 0);
      return `<tr><td style="${cell}color:${C.text};"><span style="display:inline-block;width:8px;height:8px;background:${sq};border-radius:2px;margin-right:8px;"></span>${esc(pr.name)}</td><td style="${num}">${formatDuration(pr.seconds)}</td><td style="${num}color:${C.secondary};padding-left:16px;">${share}</td></tr>`;
    })
    .join('');
  const tasks = s.top_tasks
    .map((t) => `<tr><td style="${cell}color:${C.text};">${esc(t.name)}</td><td style="${cell}color:${C.secondary};">${esc(t.project_name ?? 'No project')}</td><td style="${num}">${formatDuration(t.seconds)}</td></tr>`)
    .join('');
  const days = s.days
    .map((d) => {
      const { y, m, d: dd } = parseDateStr(d.date);
      const wd = WD_SHORT[new Date(Date.UTC(y, m - 1, dd, 12)).getUTCDay()];
      return `<tr><td style="${cell}color:${C.text};">${wd}</td><td style="${num}">${formatDuration(d.seconds)}</td></tr>`;
    })
    .join('');
  const runningNote = s.running_at_end
    ? `<p style="margin:16px 0 0 0;color:${C.secondary};font-size:14px;">A timer was still running at the end of the week. Time up to midnight Sunday is included.</p>`
    : '';
  const html = layout(
    p.appUrl,
    `${eyebrow(`Week of ${range}`)}
<div style="font-family:${FONT};font-size:40px;line-height:1.1;font-weight:800;color:${C.goldText};margin:0 0 8px 0;">${total}</div>
<div style="color:${C.secondary};font-size:14px;margin:0 0 24px 0;">${esc(deltaLine)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
<tr><th style="${th}">Project</th><th style="${th}text-align:right;">Time</th><th style="${th}text-align:right;padding-left:16px;">Share</th></tr>${projects}</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
<tr><th style="${th}">Top tasks</th><th style="${th}">Project</th><th style="${th}text-align:right;">Time</th></tr>${tasks}</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
<tr><th style="${th}">Day</th><th style="${th}text-align:right;">Time</th></tr>${days}</table>
${runningNote}
${button('Open this week in Reports', reportsUrl)}
<p style="margin:8px 0 0 0;font-size:14px;"><a href="${esc(addUrl)}" style="color:${C.link};">Missed something? Add time</a></p>`,
    `${total} logged. ${deltaLine}.`,
  );
  const text =
    `WEEK OF ${range}\n${total}\n${deltaLine}\n\nPROJECTS\n` +
    s.projects.map((pr) => `- ${pr.name}: ${formatDuration(pr.seconds)} (${formatShare(s.total_seconds ? (pr.seconds / s.total_seconds) * 100 : 0)})`).join('\n') +
    `\n\nTOP TASKS\n` +
    s.top_tasks.map((t) => `- ${t.name} (${t.project_name ?? 'No project'}): ${formatDuration(t.seconds)}`).join('\n') +
    `\n\nDAYS\n` +
    s.days.map((d) => {
      const { y, m, d: dd } = parseDateStr(d.date);
      return `- ${WD_SHORT[new Date(Date.UTC(y, m - 1, dd, 12)).getUTCDay()]}: ${formatDuration(d.seconds)}`;
    }).join('\n') +
    (s.running_at_end ? '\n\nA timer was still running at the end of the week. Time up to midnight Sunday is included.' : '') +
    `\n\nOpen this week in Reports: ${reportsUrl}\nMissed something? Add time: ${addUrl}` +
    textFooter(p.appUrl);
  return { subject: s.subject, html, text, tag: 'weekly' };
}

export function passwordLinkEmail(p: { appUrl: string; link: string }): EmailContent {
  const subject = 'Set your Focus Log password';
  const line = 'Use this link to set your password. It works once and expires in 60 minutes.';
  const html = layout(
    p.appUrl,
    `<h1 style="margin:0 0 12px 0;font-family:${FONT};font-size:24px;line-height:1.25;font-weight:700;color:${C.text};">Set your password</h1>
<p style="margin:0;color:${C.secondary};">${line}</p>
${button('Set my password', p.link)}
<p style="margin:8px 0 0 0;color:${C.secondary};font-size:14px;">Didn't ask for this? You can ignore this email — your password hasn't changed.</p>`,
    line,
  );
  const text = `Set your password\n\n${line}\n\nSet my password: ${p.link}\n\nDidn't ask for this? You can ignore this email — your password hasn't changed.${textFooter(p.appUrl)}`;
  return { subject, html, text, tag: 'password-link' };
}

export function testEmail(p: { appUrl: string }): EmailContent {
  const subject = 'Focus Log test email';
  const line = 'Email is working. Reminders and your Monday summary will arrive at this address.';
  const html = layout(
    p.appUrl,
    `<h1 style="margin:0 0 12px 0;font-family:${FONT};font-size:24px;line-height:1.25;font-weight:700;color:${C.text};">Test email</h1>
<p style="margin:0;color:${C.secondary};">${line}</p>`,
    line,
  );
  return { subject, html, text: `${line}${textFooter(p.appUrl)}`, tag: 'test' };
}
