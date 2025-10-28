import React, { useEffect, useState } from "react";
import { supabase, Profile } from "../services/supabaseClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
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

type Props = {
  onDone: (updatedProfile?: Profile | null) => void;
};

export default function PersonalInfo({ onDone }: Props) {
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
    let mounted = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        const user = data.user;
        if (!user) return;

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("full_name,username,dob,country,native_language,learning_goal,timezone")
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          console.warn("Failed to load profile for PersonalInfo prefill:", error);
          return;
        }

        if (!mounted) return;
        if (profile) {
          setForm((f: FormState) => ({ ...f, ...(profile as Partial<FormState>) }));
        }
      } catch (e) {
        console.warn("PersonalInfo prefill error", e);
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
      const { data } = await supabase.auth.getUser();
      const user = data.user;
      if (!user) {
        setErr("No authenticated user found. Please sign in again.");
        setSaving(false);
        return;
      }

      // Check username uniqueness
      if (form.username.trim()) {
        const { data: existing, error: lookupErr } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", form.username.trim())
          .maybeSingle();

        if (lookupErr) {
          console.warn("Username lookup failed:", lookupErr);
        } else if (existing && (existing as any).id && (existing as any).id !== user.id) {
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
        // handle missing-column error (Postgres 42703)
        if ((error as any)?.code === "42703" || /column .* does not exist/i.test(error.message || "")) {
          setErr(
            "The project database is missing expected profile columns. Run the DB migration in supabase/sql/2025-10-29_profiles_personal_info.sql and try again."
          );
        } else {
          setErr(error.message || "Failed to update profile");
        }
        setSaving(false);
        return;
      }

      // refetch profile
      const { data: newProfile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      setSaving(false);
      onDone(newProfile as Profile);
    } catch (e: any) {
      console.error("PersonalInfo save error", e);
      setErr(e?.message || String(e));
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center p-4">
      <div className="max-w-sm mx-auto w-full space-y-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 1v11m0 0a3 3 0 1 0 0 6 3 3 0 0 0 0-6z" />
            </svg>
            <h1 className="text-2xl font-bold text-foreground">VibeTune</h1>
          </div>
          <p className="text-sm text-muted-foreground">We’ll personalize your practice plan based on your details.</p>
        </div>

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

            <form
              className="space-y-4"
              onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                  e.preventDefault();
                  save();
                }}
            >
              <div>
                <Label htmlFor="full_name">Full name</Label>
                <Input
                  id="full_name"
                  value={form.full_name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, full_name: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={form.username}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, username: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="dob">Date of birth</Label>
                <Input
                  id="dob"
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={form.dob}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, dob: e.target.value })}
                />
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
      </div>
    </div>
  );
}
