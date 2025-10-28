import React, { useState, useEffect } from "react";
import { supabase, Profile } from "../services/supabaseClient";

type Props = {
  onDone: (updatedProfile?: Profile | null) => void;
  onBack?: () => void;
};

export default function PersonalInfo({ onDone, onBack }: Props) {
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
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white p-6 rounded-xl shadow-xl">
        <div className="flex items-center mb-6">
          <button className="text-gray-500 hover:text-gray-700 mr-4" onClick={() => onBack?.()}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </button>
          <h2 className="text-xl font-bold text-gray-800">Tell us about you</h2>
          
        </div>

        {err && <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 mb-4 rounded-r-lg" role="alert"><p>{err}</p></div>}

        <label className="block mb-2">
          <div className="text-sm font-medium text-gray-600 mb-1">Full name</div>
          <input className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
        </label>

        <label className="block mb-2">
          <div className="text-sm font-medium text-gray-600 mb-1">Username</div>
          <input className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        </label>

        <label className="block mb-2">
          <div className="text-sm font-medium text-gray-600 mb-1">Date of birth</div>
          <input className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500" type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
        </label>

        <label className="block mb-2">
          <div className="text-sm font-medium text-gray-600 mb-1">Country (optional)</div>
          <input className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
        </label>

        <label className="block mb-2">
          <div className="text-sm font-medium text-gray-600 mb-1">Native language (optional)</div>
          <input className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500" value={form.native_language} onChange={(e) => setForm({ ...form, native_language: e.target.value })} />
        </label>

        <label className="block mb-4">
          <div className="text-sm font-medium text-gray-600 mb-1">Learning goal (optional)</div>
          <input className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-purple-500 focus:border-purple-500" value={form.learning_goal} onChange={(e) => setForm({ ...form, learning_goal: e.target.value })} />
        </label>

        <div className="mt-6">
          <button className="w-full px-6 py-3 text-white font-semibold bg-purple-600 rounded-lg shadow-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save and continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
