/**
 * Friendly browser label from a User-Agent (§7 PUT /api/push/subscriptions):
 * browser (Edge, Chrome, Firefox, Safari, Opera, else "Browser") + " on " +
 * platform (Windows, Mac, iPhone, iPad, Android, ChromeOS, Linux, else "this device").
 */
export function browserLabel(ua: string | null | undefined): string {
  const s = ua ?? '';
  let browser = 'Browser';
  if (/Edg(e|A|iOS)?\//.test(s)) browser = 'Edge';
  else if (/OPR\/|Opera/.test(s)) browser = 'Opera';
  else if (/Firefox\/|FxiOS\//.test(s)) browser = 'Firefox';
  else if (/Chrome\/|CriOS\/|Chromium\//.test(s)) browser = 'Chrome';
  else if (/Safari\//.test(s) && /Version\//.test(s)) browser = 'Safari';
  else if (/AppleWebKit\//.test(s) && /(iPhone|iPad|Macintosh)/.test(s)) browser = 'Safari';

  let platform = 'this device';
  if (/iPhone/.test(s)) platform = 'iPhone';
  else if (/iPad/.test(s)) platform = 'iPad';
  else if (/Android/.test(s)) platform = 'Android';
  else if (/CrOS/.test(s)) platform = 'ChromeOS';
  else if (/Windows/.test(s)) platform = 'Windows';
  else if (/Macintosh|Mac OS X/.test(s)) platform = 'Mac';
  else if (/Linux/.test(s)) platform = 'Linux';

  return `${browser} on ${platform}`.slice(0, 60);
}

/** Smartphone icon when the label names a phone or tablet. */
export function isMobileLabel(label: string): boolean {
  return /iPhone|iPad|Android/.test(label);
}
