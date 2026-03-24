export function isAiDebugEnabled() {
  const raw = String(process.env.AI_DEBUG || '').trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes' || raw === 'on';
}

export function aiDebug(...args: any[]) {
  if (!isAiDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.log(...args);
}

