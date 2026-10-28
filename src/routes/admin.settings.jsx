import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StateBox } from "@/components/site/Shared";
import { RateLimitPanel } from "@/components/site/RateLimitPanel";
export const Route = createFileRoute("/admin/settings")({
    component: AdminSettings,
});
function AdminSettings() {
    const qc = useQueryClient();
    const { data: settings, isLoading } = useQuery({
        queryKey: ["admin_site_settings"],
        queryFn: async () => {
            const { data, error } = await supabase.from("site_settings").select("*").single();
            if (error && error.code !== 'PGRST116')
                throw error; // Allow empty
            return data || {
                full_name: "",
                headline: "",
                hero_description: "",
                about_summary: "",
                email: "",
                phone: "",
                location: "",
                github_url: "",
                linkedin_url: "",
                instagram_url: "",
                youtube_url: "",
                portrait_url: "",
                og_image_url: "",
                analytics_id: "",
                seo_title: "",
                seo_description: "",
                available_for_projects: true,
                languages: [],
                rotating_roles: [],
            };
        },
    });
    const saveMutation = useMutation({
        mutationFn: async (newData) => {
            // Upsert or update based on whether we already have an ID.
            // Usually there's only one row (id=1). Let's assume id=1 or we UPSERT.
            const payload = { ...newData, id: settings?.id || 1 };
            const { error } = await supabase.from("site_settings").upsert(payload);
            if (error)
                throw error;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["admin_site_settings"] });
            toast.success("Settings saved successfully");
        },
        onError: (err) => toast.error(err.message || "Failed to save settings"),
    });
    const handleSave = (e) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const parseArray = (str) => str.split(",").map((s) => s.trim()).filter(Boolean);
        saveMutation.mutate({
            full_name: formData.get("full_name"),
            headline: formData.get("headline"),
            hero_description: formData.get("hero_description"),
            about_summary: formData.get("about_summary"),
            email: formData.get("email"),
            phone: formData.get("phone"),
            location: formData.get("location"),
            github_url: formData.get("github_url"),
            linkedin_url: formData.get("linkedin_url"),
            instagram_url: formData.get("instagram_url"),
            youtube_url: formData.get("youtube_url"),
            portrait_url: formData.get("portrait_url"),
            og_image_url: formData.get("og_image_url"),
            analytics_id: formData.get("analytics_id"),
            seo_title: formData.get("seo_title"),
            seo_description: formData.get("seo_description"),
            available_for_projects: formData.get("available_for_projects") === "on",
            languages: parseArray(formData.get("languages")),
            rotating_roles: parseArray(formData.get("rotating_roles")),
        });
    };
    if (isLoading)
        return <StateBox>Loading settings...</StateBox>;
    return (<div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Site Settings & Profile</h1>
      </div>

      <div className="max-w-4xl">
        <RateLimitPanel compact={false} />
      </div>

      <form onSubmit={handleSave} className="space-y-8 max-w-4xl">
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Basic Profile</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Full Name</label>
              <input name="full_name" required defaultValue={settings?.full_name} className="w-full rounded-md border p-2"/>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Headline</label>
              <input name="headline" required defaultValue={settings?.headline} className="w-full rounded-md border p-2"/>
            </div>
          </div>
          <div className="space-y-1 mt-4">
            <label className="text-sm font-medium">Hero Description</label>
            <textarea name="hero_description" rows={3} required defaultValue={settings?.hero_description} className="w-full rounded-md border p-2"/>
          </div>
          <div className="space-y-1 mt-4">
            <label className="text-sm font-medium">About Summary</label>
            <textarea name="about_summary" rows={4} required defaultValue={settings?.about_summary} className="w-full rounded-md border p-2"/>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 mt-4">
            <div className="space-y-1">
              <label className="text-sm font-medium">Rotating Roles (comma separated)</label>
              <input name="rotating_roles" defaultValue={settings?.rotating_roles?.join(", ")} className="w-full rounded-md border p-2"/>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Languages (comma separated)</label>
              <input name="languages" defaultValue={settings?.languages?.join(", ")} className="w-full rounded-md border p-2"/>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Contact & Links</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Email</label>
              <input name="email" type="email" defaultValue={settings?.email || ""} className="w-full rounded-md border p-2"/>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Phone</label>
              <input name="phone" defaultValue={settings?.phone || ""} className="w-full rounded-md border p-2"/>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Location</label>
              <input name="location" defaultValue={settings?.location || ""} className="w-full rounded-md border p-2"/>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">GitHub URL</label>
              <input name="github_url" defaultValue={settings?.github_url || ""} className="w-full rounded-md border p-2"/>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">LinkedIn URL</label>
              <input name="linkedin_url" defaultValue={settings?.linkedin_url || ""} className="w-full rounded-md border p-2"/>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Instagram URL</label>
              <input name="instagram_url" defaultValue={settings?.instagram_url || ""} className="w-full rounded-md border p-2"/>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">YouTube URL</label>
              <input name="youtube_url" defaultValue={settings?.youtube_url || ""} className="w-full rounded-md border p-2"/>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" name="available_for_projects" id="available_for_projects" defaultChecked={settings?.available_for_projects}/>
              <label htmlFor="available_for_projects" className="text-sm font-medium">Available for freelance/projects</label>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-semibold mb-4">Media & SEO</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Portrait Image URL</label>
              <input name="portrait_url" defaultValue={settings?.portrait_url || ""} className="w-full rounded-md border p-2"/>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">OG Image URL (Social Share)</label>
              <input name="og_image_url" defaultValue={settings?.og_image_url || ""} className="w-full rounded-md border p-2"/>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">SEO Title</label>
              <input name="seo_title" defaultValue={settings?.seo_title || ""} className="w-full rounded-md border p-2"/>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Analytics ID (e.g. GA)</label>
              <input name="analytics_id" defaultValue={settings?.analytics_id || ""} className="w-full rounded-md border p-2"/>
            </div>
          </div>
          <div className="space-y-1 mt-4">
            <label className="text-sm font-medium">SEO Description</label>
            <textarea name="seo_description" rows={2} defaultValue={settings?.seo_description || ""} className="w-full rounded-md border p-2"/>
          </div>
        </div>

        <div className="flex justify-end pt-4 pb-12">
          <button type="submit" disabled={saveMutation.isPending} className="rounded-md bg-primary px-6 py-2.5 text-primary-foreground text-base font-semibold shadow hover:bg-primary/90">
            {saveMutation.isPending ? "Saving..." : "Save All Settings"}
          </button>
        </div>
      </form>
    </div>);
}
