const CONFIG_KEY = "mma_rate_limit_config";
const STATE_KEY = "mma_rate_limit_state";
const LOGS_KEY = "mma_rate_limit_logs";

export const DEFAULT_RATE_LIMIT_CONFIG = {
  enabled: true,
  leadMaxRequests: 3,
  leadWindowMinutes: 10,
  leadCooldownSeconds: 30,
  loginMaxAttempts: 5,
  loginLockoutMinutes: 15,
};

function safeRead(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function safeReadArray(key) {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function safeWrite(key, val) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(val));
    window.dispatchEvent(new CustomEvent("mma-rate-limit-updated"));
  } catch {
    // ignore storage errors
  }
}

export function getRateLimitConfig() {
  return safeRead(CONFIG_KEY, DEFAULT_RATE_LIMIT_CONFIG);
}

export function saveRateLimitConfig(partial) {
  const next = { ...getRateLimitConfig(), ...partial };
  safeWrite(CONFIG_KEY, next);
  addRateLimitLog({
    type: "config",
    scope: "Admin Panel",
    status: "updated",
    detail: `Rate limit rules updated (${next.enabled ? "Enabled" : "Paused"}: max ${next.leadMaxRequests} leads/${next.leadWindowMinutes}m, max ${next.loginMaxAttempts} login attempts/${next.loginLockoutMinutes}m)`,
  });
  return next;
}

function getState() {
  return safeRead(STATE_KEY, {
    leadTimestamps: [],
    leadByEmail: {},
    loginFailures: [],
    loginLockedUntil: 0,
    allowedCount: 0,
    blockedCount: 0,
  });
}

function saveState(next) {
  safeWrite(STATE_KEY, next);
}

export function addRateLimitLog(entry) {
  const logs = safeReadArray(LOGS_KEY);
  const next = [
    {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
      ...entry,
    },
    ...logs,
  ].slice(0, 25);
  safeWrite(LOGS_KEY, next);
}

export function getRateLimitLogs() {
  return safeReadArray(LOGS_KEY);
}

export function checkLeadRateLimit(email = "") {
  const cfg = getRateLimitConfig();
  if (!cfg.enabled) return { allowed: true, retryAfterSeconds: 0 };

  const now = Date.now();
  const windowMs = Math.max(1, Number(cfg.leadWindowMinutes) || 10) * 60 * 1000;
  const cooldownMs = Math.max(0, Number(cfg.leadCooldownSeconds) || 0) * 1000;
  const maxReq = Math.max(1, Number(cfg.leadMaxRequests) || 3);

  const state = getState();
  const recentGlobal = (state.leadTimestamps || []).filter((t) => now - t < windowMs);
  const normEmail = email.trim().toLowerCase();
  const recentEmail = normEmail
    ? ((state.leadByEmail && state.leadByEmail[normEmail]) || []).filter((t) => now - t < windowMs)
    : [];

  // 1. Check short cooldown between consecutive submissions
  const lastSubmission = recentGlobal[recentGlobal.length - 1] || 0;
  if (cooldownMs > 0 && lastSubmission && now - lastSubmission < cooldownMs) {
    const retryAfterSeconds = Math.ceil((cooldownMs - (now - lastSubmission)) / 1000);
    state.blockedCount = (state.blockedCount || 0) + 1;
    saveState({ ...state, leadTimestamps: recentGlobal });
    addRateLimitLog({
      type: "lead_form",
      scope: normEmail || "Anonymous Visitor",
      status: "blocked",
      detail: `Blocked by cooldown (${retryAfterSeconds}s remaining)`,
    });
    return {
      allowed: false,
      retryAfterSeconds,
      reason: `Please wait ${retryAfterSeconds}s before sending another booking/message.`,
    };
  }

  // 2. Check sliding window max requests
  if (recentGlobal.length >= maxReq || recentEmail.length >= maxReq) {
    const oldest = Math.min(recentGlobal[0] || now, recentEmail[0] || now);
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - oldest)) / 1000));
    state.blockedCount = (state.blockedCount || 0) + 1;
    saveState({ ...state, leadTimestamps: recentGlobal });
    addRateLimitLog({
      type: "lead_form",
      scope: normEmail || "Visitor IP/Session",
      status: "blocked",
      detail: `Rate limit exceeded (${maxReq} submissions per ${cfg.leadWindowMinutes} min)`,
    });
    return {
      allowed: false,
      retryAfterSeconds,
      reason: `Rate limit reached (${maxReq} submissions per ${cfg.leadWindowMinutes} minutes). Try again in ${Math.ceil(retryAfterSeconds / 60)} min.`,
    };
  }

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: Math.max(0, maxReq - recentGlobal.length - 1),
  };
}

export function recordLeadSubmission(email = "") {
  const now = Date.now();
  const cfg = getRateLimitConfig();
  const windowMs = Math.max(1, Number(cfg.leadWindowMinutes) || 10) * 60 * 1000;
  const state = getState();
  const normEmail = email.trim().toLowerCase();

  const recentGlobal = [...(state.leadTimestamps || []).filter((t) => now - t < windowMs), now];
  const leadByEmail = { ...(state.leadByEmail || {}) };
  if (normEmail) {
    leadByEmail[normEmail] = [...(leadByEmail[normEmail] || []).filter((t) => now - t < windowMs), now];
  }

  saveState({
    ...state,
    leadTimestamps: recentGlobal,
    leadByEmail,
    allowedCount: (state.allowedCount || 0) + 1,
  });

  addRateLimitLog({
    type: "lead_form",
    scope: normEmail || "Visitor",
    status: "allowed",
    detail: `Lead submission accepted (${recentGlobal.length}/${cfg.leadMaxRequests} in current ${cfg.leadWindowMinutes}m window)`,
  });
}

export function checkLoginRateLimit(email = "") {
  const cfg = getRateLimitConfig();
  if (!cfg.enabled) return { allowed: true, remainingAttempts: cfg.loginMaxAttempts, retryAfterSeconds: 0 };

  const now = Date.now();
  const state = getState();
  const windowMs = Math.max(1, Number(cfg.loginLockoutMinutes) || 15) * 60 * 1000;
  const maxAttempts = Math.max(1, Number(cfg.loginMaxAttempts) || 5);

  if (state.loginLockedUntil && now < state.loginLockedUntil) {
    const retryAfterSeconds = Math.ceil((state.loginLockedUntil - now) / 1000);
    return {
      allowed: false,
      remainingAttempts: 0,
      retryAfterSeconds,
      reason: `Too many failed login attempts. Admin login is locked for ${retryAfterSeconds}s.`,
    };
  }

  const recentFailures = (state.loginFailures || []).filter((t) => now - t < windowMs);
  return {
    allowed: true,
    remainingAttempts: Math.max(0, maxAttempts - recentFailures.length),
    retryAfterSeconds: 0,
  };
}

export function recordLoginFailure(email = "") {
  const cfg = getRateLimitConfig();
  const now = Date.now();
  const windowMs = Math.max(1, Number(cfg.loginLockoutMinutes) || 15) * 60 * 1000;
  const maxAttempts = Math.max(1, Number(cfg.loginMaxAttempts) || 5);
  const state = getState();

  const recentFailures = [...(state.loginFailures || []).filter((t) => now - t < windowMs), now];
  let loginLockedUntil = state.loginLockedUntil || 0;
  let locked = false;

  if (cfg.enabled && recentFailures.length >= maxAttempts) {
    loginLockedUntil = now + windowMs;
    locked = true;
  }

  saveState({
    ...state,
    loginFailures: recentFailures,
    loginLockedUntil,
    blockedCount: locked ? (state.blockedCount || 0) + 1 : state.blockedCount || 0,
  });

  addRateLimitLog({
    type: "admin_login",
    scope: email || "Admin Login",
    status: locked ? "blocked" : "warning",
    detail: locked
      ? `Admin login locked for ${cfg.loginLockoutMinutes}m after ${recentFailures.length} failed attempts`
      : `Failed admin login attempt (${recentFailures.length}/${maxAttempts})`,
  });

  return {
    locked,
    attemptsUsed: recentFailures.length,
    remainingAttempts: Math.max(0, maxAttempts - recentFailures.length),
    retryAfterSeconds: locked ? Math.ceil(windowMs / 1000) : 0,
  };
}

export function resetLoginAttempts() {
  const state = getState();
  saveState({
    ...state,
    loginFailures: [],
    loginLockedUntil: 0,
  });
}

export function clearRateLimitCounters() {
  saveState({
    leadTimestamps: [],
    leadByEmail: {},
    loginFailures: [],
    loginLockedUntil: 0,
    allowedCount: 0,
    blockedCount: 0,
  });
  addRateLimitLog({
    type: "admin_action",
    scope: "Admin Panel",
    status: "reset",
    detail: "All rate limit counters and lockouts cleared by Admin",
  });
}

export function getRateLimitStats() {
  const cfg = getRateLimitConfig();
  const state = getState();
  const now = Date.now();
  const leadWindowMs = Math.max(1, Number(cfg.leadWindowMinutes) || 10) * 60 * 1000;
  const loginWindowMs = Math.max(1, Number(cfg.loginLockoutMinutes) || 15) * 60 * 1000;

  const activeLeadRequests = (state.leadTimestamps || []).filter((t) => now - t < leadWindowMs).length;
  const activeLoginFailures = (state.loginFailures || []).filter((t) => now - t < loginWindowMs).length;
  const isLoginLocked = Boolean(state.loginLockedUntil && now < state.loginLockedUntil);
  const loginLockRemainingSeconds = isLoginLocked ? Math.ceil((state.loginLockedUntil - now) / 1000) : 0;

  return {
    config: cfg,
    activeLeadRequests,
    leadRemainingQuota: Math.max(0, cfg.leadMaxRequests - activeLeadRequests),
    activeLoginFailures,
    loginRemainingAttempts: Math.max(0, cfg.loginMaxAttempts - activeLoginFailures),
    isLoginLocked,
    loginLockRemainingSeconds,
    allowedCount: state.allowedCount || 0,
    blockedCount: state.blockedCount || 0,
  };
}
