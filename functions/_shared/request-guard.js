const buckets = new Map();

export function isSameOriginRequest(request) {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

function clientKey(request) {
  return request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
}

export function checkBestEffortRateLimit(request, { namespace, limit, windowMs }) {
  const now = Date.now();
  const key = `${namespace}:${clientKey(request)}`;
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: Math.max(0, limit - 1), resetAt: now + windowMs };
  }

  current.count += 1;
  if (current.count > limit) return { allowed: false, remaining: 0, resetAt: current.resetAt };
  return { allowed: true, remaining: Math.max(0, limit - current.count), resetAt: current.resetAt };
}
