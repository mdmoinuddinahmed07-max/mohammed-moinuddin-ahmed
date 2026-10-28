import { useEffect, useState } from "react";
import { ShieldAlert, ShieldCheck, RotateCcw, Sliders, Activity, Lock, CheckCircle2, Ban } from "lucide-react";
import { toast } from "sonner";
import {
  getRateLimitStats,
  getRateLimitLogs,
  saveRateLimitConfig,
  clearRateLimitCounters,
} from "@/lib/rate-limit";
import { cn } from "@/lib/utils";

export function RateLimitPanel({ compact = false }) {
  const [stats, setStats] = useState(() => getRateLimitStats());
  const [logs, setLogs] = useState(() => getRateLimitLogs());
  const [form, setForm] = useState(() => getRateLimitStats().config);

  const refresh = () => {
    const next = getRateLimitStats();
    setStats(next);
    setLogs(getRateLimitLogs());
  };

  useEffect(() => {
    refresh();
    const onUpdate = () => refresh();
    window.addEventListener("mma-rate-limit-updated", onUpdate);
    const interval = setInterval(refresh, 3000);
    return () => {
      window.removeEventListener("mma-rate-limit-updated", onUpdate);
      clearInterval(interval);
    };
  }, []);

  const handleToggle = () => {
    const nextEnabled = !stats.config.enabled;
    const updated = saveRateLimitConfig({ enabled: nextEnabled });
    setForm(updated);
    refresh();
    toast.success(nextEnabled ? "Rate Limiting protection enabled" : "Rate Limiting paused");
  };

  const handleSaveRules = (e) => {
    e.preventDefault();
    const updated = saveRateLimitConfig({
      enabled: Boolean(form.enabled),
      leadMaxRequests: Math.max(1, Number(form.leadMaxRequests) || 3),
      leadWindowMinutes: Math.max(1, Number(form.leadWindowMinutes) || 10),
      leadCooldownSeconds: Math.max(0, Number(form.leadCooldownSeconds) || 30),
      loginMaxAttempts: Math.max(1, Number(form.loginMaxAttempts) || 5),
      loginLockoutMinutes: Math.max(1, Number(form.loginLockoutMinutes) || 15),
    });
    setForm(updated);
    refresh();
    toast.success("Rate limit rules saved");
  };

  const handleResetCounters = () => {
    clearRateLimitCounters();
    refresh();
    toast.success("Rate limit counters and lockouts cleared");
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-card space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "grid h-10 w-10 place-items-center rounded-xl border",
              stats.config.enabled
                ? "border-primary/40 bg-primary/15 text-primary"
                : "border-amber-500/40 bg-amber-500/15 text-amber-400",
            )}
          >
            {stats.config.enabled ? <ShieldCheck size={20} /> : <ShieldAlert size={20} />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold">Rate Limiting & Spam Protection</h2>
              <span
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                  stats.config.enabled
                    ? "border-emerald-500/40 bg-emerald-500/15 text-emerald-400"
                    : "border-amber-500/40 bg-amber-500/15 text-amber-400",
                )}
              >
                {stats.config.enabled ? "Active" : "Paused"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Protects your Booking / Lead form from spam floods and secures Admin Login against brute-force attempts.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetCounters}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted"
          >
            <RotateCcw size={13} /> Reset Counters
          </button>
          <button
            type="button"
            onClick={handleToggle}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors",
              stats.config.enabled
                ? "border border-amber-500/40 bg-amber-500/15 text-amber-400 hover:bg-amber-500/25"
                : "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
          >
            {stats.config.enabled ? "Pause Protection" : "Enable Protection"}
          </button>
        </div>
      </div>

      {/* Live Rate Limit Metrics */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-background/50 p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Lead Quota (Current Window)</span>
            <Activity size={14} className="text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold">
            {stats.activeLeadRequests} / {stats.config.leadMaxRequests}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {stats.leadRemainingQuota} remaining per {stats.config.leadWindowMinutes}m window ({stats.config.leadCooldownSeconds}s cooldown)
          </p>
        </div>

        <div className="rounded-xl border border-border bg-background/50 p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Admin Login Shield</span>
            <Lock size={14} className={stats.isLoginLocked ? "text-destructive" : "text-primary"} />
          </div>
          <p className="mt-2 text-2xl font-bold">
            {stats.activeLoginFailures} / {stats.config.loginMaxAttempts}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {stats.isLoginLocked
              ? `Locked (${stats.loginLockRemainingSeconds}s left)`
              : `${stats.loginRemainingAttempts} attempts before ${stats.config.loginLockoutMinutes}m lockout`}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-background/50 p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Allowed Submissions</span>
            <CheckCircle2 size={14} className="text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-400">{stats.allowedCount}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Verified booking requests passed</p>
        </div>

        <div className="rounded-xl border border-border bg-background/50 p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Blocked / Throttled</span>
            <Ban size={14} className="text-rose-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-rose-400">{stats.blockedCount}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Spam / rapid requests stopped</p>
        </div>
      </div>

      {/* Configurable Rate Limit Thresholds */}
      <form onSubmit={handleSaveRules} className="rounded-xl border border-border bg-background/40 p-4 space-y-4">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <Sliders size={14} /> Configure Rate Limit Thresholds
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="space-y-1 text-xs">
            <span className="font-medium text-muted-foreground">Max Leads / Window</span>
            <input
              type="number"
              min={1}
              max={50}
              value={form.leadMaxRequests}
              onChange={(e) => setForm({ ...form, leadMaxRequests: e.target.value })}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1 text-xs">
            <span className="font-medium text-muted-foreground">Lead Window (Minutes)</span>
            <input
              type="number"
              min={1}
              max={120}
              value={form.leadWindowMinutes}
              onChange={(e) => setForm({ ...form, leadWindowMinutes: e.target.value })}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1 text-xs">
            <span className="font-medium text-muted-foreground">Lead Cooldown (Seconds)</span>
            <input
              type="number"
              min={0}
              max={600}
              value={form.leadCooldownSeconds}
              onChange={(e) => setForm({ ...form, leadCooldownSeconds: e.target.value })}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1 text-xs">
            <span className="font-medium text-muted-foreground">Max Login Failures</span>
            <input
              type="number"
              min={1}
              max={20}
              value={form.loginMaxAttempts}
              onChange={(e) => setForm({ ...form, loginMaxAttempts: e.target.value })}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
            />
          </label>

          <label className="space-y-1 text-xs">
            <span className="font-medium text-muted-foreground">Login Lockout (Minutes)</span>
            <input
              type="number"
              min={1}
              max={120}
              value={form.loginLockoutMinutes}
              onChange={(e) => setForm({ ...form, loginLockoutMinutes: e.target.value })}
              className="w-full rounded-lg border border-input bg-card px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="flex items-center justify-between pt-1">
          <p className="text-[11px] text-muted-foreground">
            Database-level rate limit trigger is also active on <code className="text-primary">public.contact_messages</code>.
          </p>
          <button
            type="submit"
            className="rounded-lg bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Save Rate Limit Rules
          </button>
        </div>
      </form>

      {/* Recent Rate Limit Activity Log */}
      {!compact && logs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">Recent Rate Limit Events</p>
          <div className="max-h-44 overflow-y-auto rounded-lg border border-border bg-background/50 divide-y divide-border/60 text-xs">
            {logs.slice(0, 8).map((log) => (
              <div key={log.id} className="flex items-center justify-between gap-3 px-3.5 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                      log.status === "blocked"
                        ? "bg-rose-500/15 text-rose-400"
                        : log.status === "allowed"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-primary/15 text-primary",
                    )}
                  >
                    {log.status}
                  </span>
                  <span className="font-medium text-foreground truncate">{log.scope}</span>
                  <span className="text-muted-foreground truncate">— {log.detail}</span>
                </div>
                <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
