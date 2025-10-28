import React, { useState, useEffect } from "react";
import { supabase, Profile } from "../services/supabaseClient";
import AuthLayout from "../components/AuthLayout";

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
      {err && <div className="text-red-400 mb-4" role="alert"><p>{err}</p></div>}

      <label className="block mb-4">
        <div className="text-sm text-neutral-300 mb-1">Full name</div>
        <input
          id="full_name"
          className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 focus:ring-2 focus:ring-white/20"
          value={form.full_name}
          onChange={(e) => setForm({ ...form, full_name: e.target.value })}
        />
      </label>

      <label className="block mb-4">
        <div className="text-sm text-neutral-300 mb-1">Username</div>
        <input
          id="username"
          className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 focus:ring-2 focus:ring-white/20"
          value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })}
        />
      </label>

      <label className="block mb-4">
        <div className="text-sm text-neutral-300 mb-1">Date of birth</div>
        <input
          id="dob"
          className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 focus:ring-2 focus:ring-white/20"
          type="date"
          max={new Date().toISOString().slice(0, 10)}
          value={form.dob}
          onChange={(e) => setForm({ ...form, dob: e.target.value })}
        />
      </label>

      <label className="block mb-4">
        <div className="text-sm text-neutral-300 mb-1">Country (optional)</div>
        <input
          className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 focus:ring-2 focus:ring-white/20"
          value={form.country}
          onChange={(e) => setForm({ ...form, country: e.target.value })}
        />
      </label>

      <label className="block mb-4">
        <div className="text-sm text-neutral-300 mb-1">Native language (optional)</div>
        <input
          className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 focus:ring-2 focus:ring-white/20"
          value={form.native_language}
          onChange={(e) => setForm({ ...form, native_language: e.target.value })}
        />
      </label>

      <label className="block mb-4">
        <div className="text-sm text-neutral-300 mb-1">Learning goal (optional)</div>
        <input
          className="w-full bg-neutral-900 border border-neutral-700 rounded-xl px-3 py-2 focus:ring-2 focus:ring-white/20"
          value={form.learning_goal}
          onChange={(e) => setForm({ ...form, learning_goal: e.target.value })}
        />
      </label>

      <label className="block mb-6">
        <div className="text-sm text-neutral-300 mb-1">Timezone</div>
        <input
          className="w-full bg-neutral-900/60 border border-neutral-700 rounded-xl px-3 py-2 text-neutral-400 cursor-not-allowed"
          value={form.timezone}
          readOnly
        />
      </label>

      <div className="flex items-center justify-between">
        <button className="btn" onClick={() => onDone(undefined)} disabled={saving}>
          <span className="text-neutral-300 hover:text-white">Skip</span>
        </button>

        <button
          onClick={save}
          disabled={saving}
          className="bg-white text-black rounded-xl px-4 py-2 hover:bg-neutral-200 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save and continue"}
        </button>
      </div>
    </AuthLayout>
  );
}
