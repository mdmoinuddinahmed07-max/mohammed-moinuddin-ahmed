import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { FolderKanban, Wrench, GraduationCap, Inbox, Sparkles, CheckCircle2, Clock } from "lucide-react";
import { RateLimitPanel } from "@/components/site/RateLimitPanel";
import { BookingsTableSection } from "./admin.messages";

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["admin_dashboard_stats"],
    queryFn: async () => {
      const [projectsRes, skillsRes, eduRes, msgRes] = await Promise.all([
        supabase.from("projects").select("id", { count: "exact" }),
        supabase.from("skills").select("id", { count: "exact" }),
        supabase.from("education").select("id", { count: "exact" }),
        supabase.from("contact_messages").select("id, status"),
      ]);
      const leads = msgRes.data || [];
      const newCount = leads.filter((m) => !m.status || m.status === "New" || m.status === "unread").length;
      const inProgressCount = leads.filter((m) => m.status === "In Progress" || m.status === "Contacted").length;
      const completedCount = leads.filter((m) => m.status === "Completed" || m.status === "read").length;

      return {
        totalLeads: leads.length,
        newLeads: newCount,
        inProgressLeads: inProgressCount,
        completedLeads: completedCount,
        projects: projectsRes.count || 0,
        skills: skillsRes.count || 0,
        education: eduRes.count || 0,
      };
    },
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="eyebrow">Admin Panel</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Bookings & Portfolio Dashboard</h1>
        </div>
        <Link
          to="/admin/messages"
          className="inline-flex items-center gap-2 rounded-lg bg-gradient-brand px-4 py-2.5 text-xs font-semibold text-primary-foreground shadow-glow"
        >
          <Inbox size={15} /> Open Full Bookings View
        </Link>
      </div>

      {/* Booking / Lead Stats Row */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Bookings / Leads"
          value={stats?.totalLeads ?? "-"}
          href="/admin/messages"
          icon={<Inbox className="text-primary" size={20} />}
        />
        <StatCard
          title="New Inquiries"
          value={stats?.newLeads ?? "-"}
          href="/admin/messages"
          icon={<Sparkles className="text-primary" size={20} />}
          highlight={Boolean(stats?.newLeads && stats.newLeads > 0)}
        />
        <StatCard
          title="Contacted / In Progress"
          value={stats?.inProgressLeads ?? "-"}
          href="/admin/messages"
          icon={<Clock className="text-amber-400" size={20} />}
        />
        <StatCard
          title="Completed Bookings"
          value={stats?.completedLeads ?? "-"}
          href="/admin/messages"
          icon={<CheckCircle2 className="text-emerald-400" size={20} />}
        />
      </div>

      {/* Portfolio Content Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Published Projects"
          value={stats?.projects ?? "-"}
          href="/admin/projects"
          icon={<FolderKanban className="text-muted-foreground" size={18} />}
        />
        <StatCard
          title="Technical Skills"
          value={stats?.skills ?? "-"}
          href="/admin/skills"
          icon={<Wrench className="text-muted-foreground" size={18} />}
        />
        <StatCard
          title="Education Entries"
          value={stats?.education ?? "-"}
          href="/admin/education"
          icon={<GraduationCap className="text-muted-foreground" size={18} />}
        />
      </div>

      {/* Rate Limiting & Spam Protection Panel */}
      <RateLimitPanel />

      {/* Embedded Live Bookings & Leads Table right on Dashboard */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Booking & Lead Form Data</h2>
          <Link to="/admin/messages" className="text-xs font-semibold text-primary hover:underline">
            View dedicated page →
          </Link>
        </div>
        <BookingsTableSection showHeader={true} />
      </div>
    </div>
  );
}

function StatCard({ title, value, href, icon, highlight }) {
  return (
    <Link
      to={href}
      className="flex items-center justify-between rounded-xl border border-border bg-card p-5 shadow-card transition-colors hover:border-primary/40"
    >
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <p className={`text-3xl font-bold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</p>
      </div>
      <div className="rounded-xl border border-border bg-background/60 p-3">{icon}</div>
    </Link>
  );
}
