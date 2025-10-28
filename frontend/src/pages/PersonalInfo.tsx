import React, { useState, useEffect } from "react";
import { supabase, Profile } from "../services/supabaseClient";
import AuthLayout from "../components/AuthLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";

type FormState = {
  full_name: string;
  username: string;
  dob: string;
  country: string;
  native_language: string;
  learning_goal: string;
  timezone: string;
};
import AuthLayout from "../components/AuthLayout";

type Props = {
  onDone: (updatedProfile?: Profile | null) => void;
  onBack?: () => void;
};

export default function PersonalInfo({ onDone, onBack }: Props) {
  const [form, setForm] = useState<FormState>({
    full_name: "",
    username: "",
    dob: "",
    country: "",
    native_language: "",
    learning_goal: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
  });

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    // prefill from existing profile if available
    let mounted = true;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data, error } = await supabase
          .from("profiles")
          .select("full_name, username, dob, country, native_language, learning_goal, timezone")
          .eq("id", user.id)
          .maybeSingle();
        if (error) return;
        if (!mounted) return;
        setForm((f) => ({ ...f, ...(data || {}) }));
      } catch (e) {
        // ignore
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const save = async () => {
    setErr(null);
    if (!form.full_name.trim() || !form.username.trim() || !form.dob) {
      setErr("Please fill full name, username and date of birth.");
      return;
    }

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setErr("No authenticated user found. Please sign in again.");
        setSaving(false);
        return;
      }

      // Check username uniqueness (avoid conflicting unique index errors)
      if (form.username.trim()) {
        const { data: existing, error: lookupErr } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", form.username.trim())
          .maybeSingle();

        if (lookupErr) {
          // non-fatal: continue and let update surface any schema issues
          console.warn("Username lookup failed:", lookupErr);
        } else if (existing && existing.id && existing.id !== user.id) {
          setErr("Username is already taken. Please choose a different one.");
          setSaving(false);
          return;
        }
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name.trim(),
          username: form.username.trim(),
          dob: form.dob,
          country: form.country || null,
          native_language: form.native_language || null,
          learning_goal: form.learning_goal || null,
          timezone: form.timezone || null,
        })
        .eq("id", user.id);

      if (error) {
        // handle missing-column error specifically (Postgres SQLSTATE 42703)
        if ((error as any)?.code === "42703" || String((error as any)?.message || "").toLowerCase().includes("column")) {
          setErr("Database missing columns for Personal Info. Run the migration to add full_name/dob/timezone/etc.");
        } else {
          setErr(error.message || String(error));
        }
        setSaving(false);
        return;
      }

      // re-fetch full profile to decide where to navigate and return updated row
      const { data: updatedProfile, error: selErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (selErr || !updatedProfile) {
        // if we can't read updated profile, return undefined so caller falls back to level-selection
        onDone(undefined);
      } else {
        onDone(updatedProfile as Profile);
      }
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <AuthLayout
      title="Tell us about you"
      subtitle="We’ll personalize your practice plan based on your details."
      onBack={onBack}
      rightSlot={
        <div>
          <img src="/assets/auth-illustration.svg" alt="Illustration" className="w-full h-auto rounded-lg" />
        </div>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Tell us about you</CardTitle>
          <CardDescription>We’ll personalize your practice plan based on your details.</CardDescription>
        </CardHeader>

        <CardContent>
          {err && (
            <div className="bg-red-50 border-l-4 border-red-400 text-red-700 p-3 mb-4 rounded-r-lg" role="alert">
              <p>{err}</p>
            </div>
          )}

          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <div>
              <Label htmlFor="full_name">Full name</Label>
              <Input id="full_name" value={form.full_name} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, full_name: e.target.value })} />
            </div>

            <div>
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={form.username} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, username: e.target.value })} />
            </div>

            <div>
              <Label htmlFor="dob">Date of birth</Label>
              <Input id="dob" type="date" max={new Date().toISOString().slice(0, 10)} value={form.dob} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, dob: e.target.value })} />
            </div>

            <div>
              <Label htmlFor="country">Country (optional)</Label>
              <Input id="country" value={form.country} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, country: e.target.value })} />
            </div>

            <div>
              <Label htmlFor="native_language">Native language (optional)</Label>
              <Input id="native_language" value={form.native_language} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, native_language: e.target.value })} />
            </div>

            <div>
              <Label htmlFor="learning_goal">Learning goal (optional)</Label>
              <Input id="learning_goal" value={form.learning_goal} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, learning_goal: e.target.value })} />
            </div>

            <div>
              <Label htmlFor="timezone">Timezone</Label>
              <Input id="timezone" value={form.timezone} readOnly />
            </div>

            <div className="flex items-center justify-between pt-2">
              <Button variant="ghost" type="button" onClick={() => onDone(undefined)} disabled={saving}>
                Skip
              </Button>

              <Button type="submit" disabled={saving}>
                {saving ? "Saving..." : "Save and continue"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </AuthLayout>
  );
}
