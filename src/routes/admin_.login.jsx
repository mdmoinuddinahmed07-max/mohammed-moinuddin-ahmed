import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  checkLoginRateLimit,
  recordLoginFailure,
  resetLoginAttempts,
} from "@/lib/rate-limit";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const ADMIN_SESSION_KEY = "mma_admin_session";
const ADMIN_EMAIL = "mdmoinuddinahmed07@gmail.com";
const ADMIN_PASS = "Moin@786";

export const Route = createFileRoute("/admin_/login")({
  head: () => ({
    meta: [
      { title: "Admin Login — Mohammed Moinuddin Ahmed" },
      { name: "description", content: "Sign in to manage bookings, leads, and portfolio content." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Login,
});

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [rateState, setRateState] = useState(() => checkLoginRateLimit(""));

  useEffect(() => {
    const t = setInterval(() => {
      setRateState(checkLoginRateLimit(email));
    }, 1000);
    return () => clearInterval(t);
  }, [email]);

  async function submit(e) {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    const limitCheck = checkLoginRateLimit(trimmedEmail);
    setRateState(limitCheck);
    if (!limitCheck.allowed) {
      toast.error(limitCheck.reason);
      return;
    }

    setBusy(true);
    try {
      if (trimmedEmail === ADMIN_EMAIL && password === ADMIN_PASS) {
        resetLoginAttempts();
        localStorage.setItem(
          ADMIN_SESSION_KEY,
          JSON.stringify({ email: ADMIN_EMAIL, loggedInAt: new Date().toISOString() }),
        );
        await supabase.auth.signInWithPassword({ email: ADMIN_EMAIL, password: ADMIN_PASS }).catch(() => {});
        toast.success("Welcome back, Moin!");
        navigate({ to: "/admin", replace: true });
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
      if (error) throw error;
      resetLoginAttempts();
      localStorage.setItem(
        ADMIN_SESSION_KEY,
        JSON.stringify({ email: trimmedEmail, loggedInAt: new Date().toISOString() }),
      );
      toast.success("Signed in to Admin Panel");
      navigate({ to: "/admin", replace: true });
    } catch (err) {
      const failure = recordLoginFailure(trimmedEmail);
      setRateState(checkLoginRateLimit(trimmedEmail));
      if (failure.locked) {
        toast.error(`Rate limit exceeded! Login locked for ${Math.ceil(failure.retryAfterSeconds / 60)} minutes.`);
      } else {
        toast.error(
          `${err instanceof Error ? err.message : "Invalid email or password"} (${failure.remainingAttempts} attempts remaining)`,
        );
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-md space-y-4">
        <Link to="/" className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft size={14} /> Back to Portfolio Website
        </Link>

        <form onSubmit={submit} className="space-y-5 rounded-2xl border border-border bg-card p-8 shadow-card">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-brand text-primary-foreground">
              <ShieldCheck size={20} />
            </div>
            <div>
              <p className="eyebrow">Portfolio & Lead CRM</p>
              <h1 className="text-2xl font-bold">Admin Panel Sign In</h1>
            </div>
          </div>

          {!rateState.allowed && (
            <div className="flex items-start gap-2.5 rounded-xl border border-destructive/40 bg-destructive/10 p-3.5 text-xs text-destructive">
              <ShieldAlert size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Rate Limit Active — Login Temporarily Locked</p>
                <p className="mt-0.5">{rateState.reason}</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Admin Email</Label>
            <Input
              id="email"
              name="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter admin email"
              required
              disabled={!rateState.allowed}
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter admin password"
              required
              disabled={!rateState.allowed}
              autoComplete="current-password"
            />
          </div>

          <Button type="submit" className="w-full" disabled={busy || !rateState.allowed}>
            {busy && <Loader2 className="mr-2 animate-spin" size={16} />}
            {!rateState.allowed ? `Locked (${rateState.retryAfterSeconds}s)` : "Sign In to Admin Panel"}
          </Button>
        </form>
      </div>
    </div>
  );
}
