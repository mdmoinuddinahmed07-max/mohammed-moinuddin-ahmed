-- ============================================================================
-- Complete Supabase Database Setup for MD Moin Uddin Ahmed Portfolio & Leads
-- Project ID: pnexylsgqbgexdqoccst
-- Run this script in: https://supabase.com/dashboard/project/pnexylsgqbgexdqoccst/sql/new
-- ============================================================================

-- 1. Role Enum & User Roles Table
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.claim_owner_admin()
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF lower(coalesce(auth.jwt()->>'email', '')) = 'mdmoinuddinahmed07@gmail.com' THEN
    INSERT INTO public.user_roles(user_id, role)
    VALUES (auth.uid(), 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN public.has_role(auth.uid(), 'admin');
END $$;

REVOKE EXECUTE ON FUNCTION public.claim_owner_admin() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.claim_owner_admin() TO authenticated;

DROP POLICY IF EXISTS "own roles" ON public.user_roles;
CREATE POLICY "own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- 2. Updated-at Trigger Helper
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

-- 3. Portfolio & Lead Tables
CREATE TABLE IF NOT EXISTS public.site_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  full_name text NOT NULL DEFAULT 'MD MOIN UDDIN AHMED',
  headline text NOT NULL DEFAULT 'BCA Student | AI & Automation | Web Development',
  hero_description text NOT NULL DEFAULT '',
  about_summary text NOT NULL DEFAULT '',
  location text DEFAULT 'Hyderabad, India',
  email text,
  phone text,
  portrait_url text DEFAULT '/portrait.jpg',
  rotating_roles text[] NOT NULL DEFAULT '{}',
  languages text[] NOT NULL DEFAULT '{}',
  linkedin_url text,
  github_url text,
  youtube_url text,
  instagram_url text,
  seo_title text,
  seo_description text,
  og_image_url text,
  analytics_id text,
  available_for_projects boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.about_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.skills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  description text,
  icon text,
  proficiency int,
  sort_order int NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  short_description text,
  description text,
  long_description text,
  problem text,
  approach text,
  features text[] NOT NULL DEFAULT '{}',
  learning text,
  category text NOT NULL DEFAULT 'AI & Automation',
  technologies text[] NOT NULL DEFAULT '{}',
  cover_image text,
  gallery text[] NOT NULL DEFAULT '{}',
  project_url text,
  github_url text,
  featured boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  seo_title text,
  seo_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.education (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  degree text NOT NULL,
  institution text NOT NULL,
  year text,
  status text,
  description text,
  sort_order int NOT NULL DEFAULT 0,
  published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Lead / Contact Messages Table
CREATE TABLE IF NOT EXISTS public.contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  phone text,
  subject text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'New',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Table Grants
GRANT SELECT ON public.site_settings, public.about_cards, public.skills, public.projects, public.education TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.site_settings, public.about_cards, public.skills, public.projects, public.education TO authenticated;
GRANT INSERT ON public.contact_messages TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.contact_messages TO authenticated;
GRANT ALL ON public.site_settings, public.about_cards, public.skills, public.projects, public.education, public.contact_messages TO service_role;

-- 5. Enable Row Level Security (RLS)
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.about_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.education ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
DROP POLICY IF EXISTS "public read" ON public.site_settings;
CREATE POLICY "public read" ON public.site_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "admin write" ON public.site_settings;
CREATE POLICY "admin write" ON public.site_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "public read" ON public.about_cards;
CREATE POLICY "public read" ON public.about_cards FOR SELECT USING (published OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin write" ON public.about_cards;
CREATE POLICY "admin write" ON public.about_cards FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "public read" ON public.skills;
CREATE POLICY "public read" ON public.skills FOR SELECT USING (published OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin write" ON public.skills;
CREATE POLICY "admin write" ON public.skills FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "public read" ON public.projects;
CREATE POLICY "public read" ON public.projects FOR SELECT USING (published OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin write" ON public.projects;
CREATE POLICY "admin write" ON public.projects FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "public read" ON public.education;
CREATE POLICY "public read" ON public.education FOR SELECT USING (published OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin write" ON public.education;
CREATE POLICY "admin write" ON public.education FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Lead Submission Policy (allows anyone on the website to submit the Contact form)
DROP POLICY IF EXISTS "anyone can submit" ON public.contact_messages;
CREATE POLICY "anyone can submit" ON public.contact_messages
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    status = 'New'
    AND char_length(name) BETWEEN 1 AND 120
    AND char_length(email) BETWEEN 3 AND 255
    AND char_length(message) BETWEEN 1 AND 5000
    AND coalesce(char_length(subject), 0) <= 200
    AND coalesce(char_length(phone), 0) <= 40
  );

DROP POLICY IF EXISTS "admin read" ON public.contact_messages;
CREATE POLICY "admin read" ON public.contact_messages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin update" ON public.contact_messages;
CREATE POLICY "admin update" ON public.contact_messages FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admin delete" ON public.contact_messages;
CREATE POLICY "admin delete" ON public.contact_messages FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 7. Triggers
DROP TRIGGER IF EXISTS t1 ON public.site_settings;
CREATE TRIGGER t1 BEFORE UPDATE ON public.site_settings FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS t1 ON public.about_cards;
CREATE TRIGGER t1 BEFORE UPDATE ON public.about_cards FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS t1 ON public.skills;
CREATE TRIGGER t1 BEFORE UPDATE ON public.skills FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS t1 ON public.projects;
CREATE TRIGGER t1 BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS t1 ON public.education;
CREATE TRIGGER t1 BEFORE UPDATE ON public.education FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS t1 ON public.contact_messages;
CREATE TRIGGER t1 BEFORE UPDATE ON public.contact_messages FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 8. Seed Portfolio Content
INSERT INTO public.site_settings (
  id, full_name, headline, hero_description, about_summary, location, email, phone, portrait_url, rotating_roles, languages, seo_title, seo_description
) VALUES (
  1,
  'MD MOIN UDDIN AHMED',
  'BCA Student | AI & Automation | Web Development',
  'I build digital experiences, automation workflows, and AI-powered solutions that turn ideas into practical business solutions.',
  'BCA student interested in AI development, workflow automation, and modern web development. Exploring AI agents, n8n, API integrations, responsive website design, and AI-powered creative content. Focused on applying emerging technologies to practical business problems and continuously improving through hands-on projects.',
  'Hyderabad, India',
  'mdmoinuddinahmed07@gmail.com',
  '+91 6301849129',
  '/portrait.jpg',
  ARRAY['AI & Automation', 'AI Developer', 'Web Developer', 'Automation Specialist', 'Creative Technologist'],
  ARRAY['English', 'Hindi', 'Urdu'],
  'MD Moin Uddin Ahmed — AI & Automation | Web Development',
  'Official portfolio of MD Moin Uddin Ahmed, a BCA student in Hyderabad building practical digital solutions with AI, automation, and modern web technology.'
) ON CONFLICT (id) DO UPDATE SET
  portrait_url = EXCLUDED.portrait_url;

INSERT INTO public.about_cards (title, description, sort_order)
SELECT * FROM (VALUES
  ('BCA Student', 'Pursuing a Bachelor of Computer Applications at Jain University.', 1),
  ('AI & Automation', 'Exploring AI agents, n8n workflows and business process automation.', 2),
  ('Web Development', 'Designing and building responsive, modern websites.', 3),
  ('Creative Technology', 'Experimenting with AI video and UGC-style ad concepts.', 4)
) AS v(title, description, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.about_cards);

INSERT INTO public.skills (name, category, sort_order)
SELECT * FROM (VALUES
  ('Generative AI', 'AI & Automation', 1),
  ('AI Agents', 'AI & Automation', 2),
  ('n8n Workflow Automation', 'AI & Automation', 3),
  ('Business Process Automation', 'AI & Automation', 4),
  ('Web Development', 'Web & Design', 1),
  ('Responsive UI/UX', 'Web & Design', 2),
  ('Website Design', 'Web & Design', 3),
  ('API Integrations', 'Integrations & Data', 1),
  ('Database Concepts', 'Integrations & Data', 2),
  ('Backend Concepts', 'Integrations & Data', 3),
  ('AI Video Creation', 'Creative Technology', 1),
  ('UGC Ad Concepts', 'Creative Technology', 2),
  ('Digital Marketing', 'Creative Technology', 3),
  ('Microsoft Word', 'Productivity', 1),
  ('Microsoft Excel', 'Productivity', 2)
) AS v(name, category, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.skills);

INSERT INTO public.projects (title, slug, short_description, description, category, technologies, cover_image, featured, sort_order)
VALUES
  (
    'AI Agent & Workflow Automation',
    'ai-agent-workflow-automation',
    'Exploring conversational AI agents and n8n workflows for automated business communication and lead-management use cases.',
    'Exploring conversational AI agents and n8n workflows for automated business communication and lead-management use cases.',
    'AI & Automation',
    ARRAY['AI Agents', 'n8n', 'APIs', 'Automation'],
    '/projects/ai-agent-workflow-automation.jpg',
    true,
    1
  ),
  (
    'Modern Website Design & Development',
    'modern-website-design-development',
    'Working on concepts for responsive websites, improved user experiences, and AI-assisted website development.',
    'Working on concepts for responsive websites, improved user experiences, and AI-assisted website development.',
    'Web Development',
    ARRAY['React', 'TypeScript', 'Tailwind CSS', 'UI/UX'],
    '/projects/modern-website-design-development.jpg',
    true,
    2
  ),
  (
    'AI-Powered Creative Content',
    'ai-powered-creative-content',
    'Experimenting with AI video workflows and UGC-style advertising concepts for digital marketing.',
    'Experimenting with AI video workflows and UGC-style advertising concepts for digital marketing.',
    'Creative Technology',
    ARRAY['Generative AI', 'AI Video', 'UGC', 'Digital Marketing'],
    '/projects/ai-powered-creative-content.jpg',
    true,
    3
  )
ON CONFLICT (slug) DO UPDATE SET
  cover_image = EXCLUDED.cover_image;

INSERT INTO public.education (degree, institution, year, status, sort_order)
SELECT * FROM (VALUES
  ('Bachelor of Computer Applications (BCA)', 'Jain University', NULL, 'Pursuing', 1),
  ('Intermediate', 'M.S Junior College', '2023', 'Completed', 2),
  ('School Certificate (SSC)', 'Crown High School', '2021', 'Completed', 3)
) AS v(degree, institution, year, status, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM public.education);



-- 9. Database-Level Rate Limiting Trigger on public.contact_messages
CREATE OR REPLACE FUNCTION public.enforce_contact_rate_limit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  recent_count int;
BEGIN
  SELECT count(*) INTO recent_count
  FROM public.contact_messages
  WHERE lower(email) = lower(NEW.email)
    AND created_at > (now() - interval '10 minutes');

  IF recent_count >= 5 THEN
    RAISE EXCEPTION 'Rate limit exceeded: Too many submissions from this email. Please wait 10 minutes before trying again.'
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_contact_rate_limit ON public.contact_messages;
CREATE TRIGGER trg_contact_rate_limit
  BEFORE INSERT ON public.contact_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_contact_rate_limit();
