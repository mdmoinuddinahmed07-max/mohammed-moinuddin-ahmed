import { Loader2, Mail, MapPin, Phone, ShieldAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { checkLeadRateLimit, recordLeadSubmission } from "@/lib/rate-limit";
import { Reveal, SectionHeader } from "./Shared";

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().max(40).optional(),
  subject: z.string().trim().max(200).optional(),
  message: z.string().trim().min(10, "Message should be at least 10 characters").max(5000),
});

const PENDING_LEADS_KEY = "mma_pending_leads";
const field = "w-full rounded-lg border border-input bg-background px-4 py-3 text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none";

async function flushPendingLeads() {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(PENDING_LEADS_KEY);
    if (!raw) return;
    const pending = JSON.parse(raw);
    if (!Array.isArray(pending) || !pending.length) return;
    const { error } = await supabase.from("contact_messages").insert(pending);
    if (!error) {
      localStorage.removeItem(PENDING_LEADS_KEY);
    }
  } catch {
    // Ignore storage or network errors during background sync
  }
}

export function Contact({ s }) {
  const [state, setState] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [errors, setErrors] = useState({});

  useEffect(() => {
    void flushPendingLeads();
  }, []);

  async function submit(e) {
    e.preventDefault();
    if (state === "loading") return;
    const form = e.currentTarget;
    const parsed = schema.safeParse(Object.fromEntries(new FormData(form)));
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])));
      return;
    }

    const d = parsed.data;
    const rateCheck = checkLeadRateLimit(d.email);
    if (!rateCheck.allowed) {
      setErrors({});
      setErrorMsg(rateCheck.reason);
      setState("rate_limited");
      return;
    }

    setErrors({});
    setErrorMsg("");
    setState("loading");

    const payload = {
      name: d.name,
      email: d.email,
      phone: d.phone || null,
      subject: d.subject || null,
      message: d.message,
      status: "New",
    };

    const { error } = await supabase.from("contact_messages").insert(payload);
    if (error) {
      console.error("[Supabase Lead Insert Error]", error);
      if (error.code === "PGRST205" || error.code === "42P01") {
        try {
          const existing = JSON.parse(localStorage.getItem(PENDING_LEADS_KEY) || "[]");
          existing.push({ ...payload, created_at: new Date().toISOString() });
          localStorage.setItem(PENDING_LEADS_KEY, JSON.stringify(existing));
        } catch {
          // ignore
        }
        setErrorMsg("Database table `contact_messages` not initialized yet — run `supabase/setup_database.sql` in your Supabase SQL Editor.");
      } else {
        setErrorMsg(error.message || "Something went wrong. Please try again or email directly.");
      }
      setState("error");
      return;
    }

    recordLeadSubmission(d.email);
    void flushPendingLeads();
    form.reset();
    setState("success");
  }

  return (
    <section id="contact" className="scroll-mt-20 border-t border-border bg-surface py-24">
      <div className="mx-auto grid max-w-7xl gap-14 px-5 lg:grid-cols-[1fr_1.2fr] lg:px-8">
        <div>
          <SectionHeader
            index="06"
            eyebrow="Contact"
            title="Let's Build Something Together"
            subtitle="Have a project, idea, or automation challenge? Let's discuss how technology can turn it into something practical."
          />
          <ul className="space-y-4 text-sm">
            <li className="flex items-center gap-3"><MapPin size={17} className="text-primary" />{s?.location}</li>
            {s?.email && <li><a href={`mailto:${s.email}`} className="flex items-center gap-3 hover:text-primary"><Mail size={17} className="text-primary" />{s.email}</a></li>}
            {s?.phone && <li><a href={`tel:${s.phone.replace(/\s/g, "")}`} className="flex items-center gap-3 hover:text-primary"><Phone size={17} className="text-primary" />{s.phone}</a></li>}
          </ul>
        </div>
        <Reveal>
          <form onSubmit={submit} noValidate className="grid gap-4 rounded-2xl border border-border bg-card p-6 shadow-card sm:grid-cols-2 sm:p-8">
            {[
              { n: "name", l: "Name *", t: "text", ac: "name" },
              { n: "email", l: "Email *", t: "email", ac: "email" },
              { n: "phone", l: "Phone", t: "tel", ac: "tel" },
              { n: "subject", l: "Subject", t: "text", ac: "off" },
            ].map((f) => (
              <label key={f.n} className="text-sm">
                <span className="mb-1.5 block text-muted-foreground">{f.l}</span>
                <input name={f.n} type={f.t} autoComplete={f.ac} className={field} aria-invalid={!!errors[f.n]} />
                {errors[f.n] && <span className="mt-1 block text-xs text-destructive">{errors[f.n]}</span>}
              </label>
            ))}
            <label className="text-sm sm:col-span-2">
              <span className="mb-1.5 block text-muted-foreground">Message *</span>
              <textarea name="message" rows={5} className={field} aria-invalid={!!errors.message} />
              {errors.message && <span className="mt-1 block text-xs text-destructive">{errors.message}</span>}
            </label>
            <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center">
              <button disabled={state === "loading"} className="inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-brand px-6 py-3 font-semibold text-primary-foreground shadow-glow disabled:opacity-60">
                {state === "loading" && <Loader2 size={16} className="animate-spin" />} Send Message
              </button>
              <p role="status" className="text-sm">
                {state === "success" && <span className="text-success">Thanks! Your message has been received.</span>}
                {state === "rate_limited" && (
                  <span className="inline-flex items-center gap-1.5 text-amber-400">
                    <ShieldAlert size={15} /> {errorMsg}
                  </span>
                )}
                {state === "error" && <span className="text-destructive">{errorMsg || "Something went wrong. Please try again or email directly."}</span>}
              </p>
            </div>
          </form>
        </Reveal>
      </div>
    </section>
  );
}
