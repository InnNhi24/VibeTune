import React, { useState, useEffect } from "react";
import { supabase } from "../services/supabaseClient";

type Props = {
  onDone: (hasLevel: boolean) => void;
};

export default function PersonalInfo({ onDone }: Props) {
  const [form, setForm] = useState({
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

        const { data, error } = await supabase.from("profiles").select("full_name, username, dob, country, native_language, learning_goal, timezone").eq("id", user.id).single();
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
        setErr(error.message);
        setSaving(false);
        return;
      }

      // re-fetch level to decide where to navigate
      const { data: p, error: selErr } = await supabase.from("profiles").select("level").eq("id", user.id).single();
      if (selErr) {
        // if we can't read level, assume no level and send to level selection
        onDone(false);
      } else {
        onDone(!!p?.level);
      }
    } catch (e: any) {
      setErr(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-card p-6 rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-4">Tell us about you</h2>

        {err && <div className="text-destructive mb-3">{err}</div>}

        <label className="block mb-2">
          <div className="text-sm text-muted-foreground mb-1">Full name</div>
          <input className="input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </label>

        <label className="block mb-2">
          <div className="text-sm text-muted-foreground mb-1">Username</div>
          <input className="input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </label>

        <label className="block mb-2">
          <div className="text-sm text-muted-foreground mb-1">Date of birth</div>
          <input className="input" type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
        </label>

        <label className="block mb-2">
          <div className="text-sm text-muted-foreground mb-1">Country (optional)</div>
          <input className="input" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
        </label>

        <label className="block mb-2">
          <div className="text-sm text-muted-foreground mb-1">Native language (optional)</div>
          <input className="input" value={form.native_language} onChange={(e) => setForm({ ...form, native_language: e.target.value })} />
        </label>

        <label className="block mb-4">
          <div className="text-sm text-muted-foreground mb-1">Learning goal (optional)</div>
          <input className="input" value={form.learning_goal} onChange={(e) => setForm({ ...form, learning_goal: e.target.value })} />
        </label>

        <div className="flex items-center justify-between">
          <button className="btn btn-secondary" onClick={() => onDone(false)} disabled={saving}>
            Skip
          </button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save and continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
