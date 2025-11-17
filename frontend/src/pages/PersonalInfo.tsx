import React, { useEffect, useState, useRef } from "react";
import { supabase, Profile } from "../services/supabaseClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from "../components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
  CommandGroup,
} from "../components/ui/command";
import { Label } from "../components/ui/label";
import CountryCombobox from "../components/CountryCombobox";
import { Button } from "../components/ui/button";
import { InlineAvatarCrop } from "../components/InlineAvatarCrop";
import { Mic, Mail, User, MapPin, Globe, Book } from "lucide-react";

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
    timezone: "",
  });

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [countryOpen, setCountryOpen] = useState(false);
  const commandInputRef = useRef<HTMLInputElement | null>(null);
  const commandListRef = useRef<HTMLElement | null>(null);

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

  // Focus and scroll management for the country combobox
  useEffect(() => {
    if (!countryOpen) return;

    // When opened, try to focus the command input and reset list scroll
    const focusTimeout = setTimeout(() => {
      const input = commandInputRef.current;
      const list = commandListRef.current;

      if (input) {
        try {
          input.focus({ preventScroll: true });
        } catch (e) {
          input.focus();
        }
      }

      if (list) {
        list.scrollTop = 0;
      }

      // when typing, keep the list scrolled to top so filtered results appear from the top
      const onInput = () => {
        if (list) list.scrollTop = 0;
      };

      input?.addEventListener("input", onInput);

      // observe selection changes and scroll the selected item into view
      const mo = new MutationObserver(() => {
        if (!list) return;
        const sel = list.querySelector('[data-selected="true"]') as HTMLElement | null;
        if (sel) sel.scrollIntoView({ block: "nearest" });
      });

      if (list) mo.observe(list, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-selected"] });

      return () => {
        input?.removeEventListener("input", onInput);
        mo.disconnect();
      };
    }, 0);

    return () => clearTimeout(focusTimeout);
  }, [countryOpen]);

  const handleAvatarChange = (croppedImageUrl: string, croppedFile: File) => {
    setAvatarFile(croppedFile);
    console.log('Avatar ready for upload:', croppedFile);
  };

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

        // Block if the authenticated user doesn't have an email address.
        // The `profiles.email` column is NOT NULL in the DB; sending null will cause a 23502 error.
        if (!user.email) {
          setErr(
            "Your account does not have an email address. Please sign in with an email provider or add an email to your account before saving your profile."
          );
          setSaving(false);
          return;
        }

      // Try to read existing profile email from DB (use it if present). This
      // handles cases where the auth user object has no email but the profiles
      // table already contains a verified email (e.g., created during signup).
      let existingProfileEmail: string | null = null;
      try {
        const { data: existing, error: fetchErr } = await supabase
          .from('profiles')
          .select('email')
          .eq('id', user.id)
          .maybeSingle();

        if (!fetchErr && existing && (existing as any).email) {
          existingProfileEmail = (existing as any).email as string;
        }
      } catch (e) {
        // ignore - we'll fall back to user.email below
      }

      // Use upsert so that first-time saves create a profile row if missing.
      const payload = {
        id: user.id,
        // prefer the email already stored in profiles, otherwise use the auth user email
        email: existingProfileEmail || (user.email as string) || null,
        full_name: form.full_name.trim(),
        username: form.username.trim(),
        dob: form.dob,
        country: form.country || null,
        native_language: form.native_language || null,
        learning_goal: form.learning_goal || null,
        timezone: form.timezone || null,
      };

      // Clear previous username error
      setUsernameError(null);

      const { data: upserted, error } = await supabase
        .from('profiles')
        .upsert(payload, { onConflict: 'id', returning: 'representation' })
        .select()
        .maybeSingle();

      if (error) {
        // handle missing-column error (Postgres 42703)
        if ((error as any)?.code === '42703' || /column .* does not exist/i.test(error.message || '')) {
          setErr(
            'The project database is missing expected profile columns. Run the DB migration in supabase/sql/2025-10-29_profiles_personal_info.sql and try again.'
          );
        } else if ((error as any)?.code === '23502' || /null value in column .* violates not-null constraint/i.test(error.message || '')) {
          // not-null violation (e.g. email column required)
          setErr('A required profile field is missing (for example: email). Please ensure your account has an email address and try again.');
        } else if ((error as any)?.code === '23505' || /unique/i.test(error.message || '')) {
          // unique_violation on username
          setUsernameError('Username is already taken. Please choose a different one.');
        } else {
          setErr(error.message || 'Failed to update profile');
        }
        setSaving(false);
        return;
      }

      // upsert returned representation when using returning: 'representation'
      setSaving(false);
      onDone((upserted as Profile) || undefined);
    } catch (e: any) {
      console.error("PersonalInfo save error", e);
      setErr(e?.message || String(e));
      setSaving(false);
    }
  };

  return (
    <div className="bg-background min-h-screen p-4 py-6">
      <div className="max-w-sm mx-auto w-full space-y-4 pb-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Mic className="w-8 h-8 text-accent" />
            <h1 className="text-2xl font-bold text-foreground">VibeTune</h1>
          </div>
          <p className="text-sm text-muted-foreground">Quick setup - tell us a few details so we can personalize your plan.</p>
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

            {/* Inline Avatar Crop */}
            <div className="mb-6 text-center">
              <InlineAvatarCrop 
                onImageChange={handleAvatarChange}
                size={100}
              />
              <div className="text-sm text-muted-foreground mt-2">Upload a photo (optional)</div>
            </div>

            <form
              className="space-y-3"
              onSubmit={(e: React.FormEvent<HTMLFormElement>) => {
                e.preventDefault();
                save();
              }}
            >
              <div className="space-y-2">
                <Label htmlFor="full_name">Full name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="full_name"
                    placeholder="Your full name"
                    value={form.full_name}
                    className="pl-10"
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, full_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="username"
                      placeholder="e.g. your-username"
                      value={form.username}
                      className="pl-10"
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, username: e.target.value })}
                    />
                  </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="dob">Date of birth</Label>
                <Input
                  id="dob"
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  value={form.dob}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, dob: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="country">Country (optional)</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <div className="pl-10">
                    {/* Combobox: Popover + Command implementation (CountryCombobox) */}
                    <CountryCombobox
                      value={form.country}
                      onChange={(v: string) => setForm({ ...form, country: v })}
                      placeholder="Select or type your country"
                      allowCustom={true}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="native_language">Native language (optional)</Label>
                <div className="relative">
                  <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="native_language" placeholder="e.g. English" className="pl-10" value={form.native_language} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, native_language: e.target.value })} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="learning_goal">Learning goal (optional)</Label>
                <div className="relative">
                  <Book className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input id="learning_goal" placeholder="e.g. improve clarity and rhythm" className="pl-10" value={form.learning_goal} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, learning_goal: e.target.value })} />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  variant="link"
                  type="button"
                  onClick={() => (onBack ? onBack() : onDone(undefined))}
                  disabled={saving}
                  className="text-accent"
                >
                  Back
                </Button>

                <Button type="submit" className="bg-accent hover:bg-accent/90 text-accent-foreground" disabled={saving}>
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
