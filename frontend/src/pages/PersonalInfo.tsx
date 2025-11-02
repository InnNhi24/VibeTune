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
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "../components/ui/select";
import { Label } from "../components/ui/label";
import { Button } from "../components/ui/button";
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
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFileName, setAvatarFileName] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

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
    <div className="min-h-screen bg-background flex flex-col justify-center p-4">
      <div className="max-w-sm mx-auto w-full space-y-6">
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

            {/* Avatar upload hint */}
            <div className="mb-4 text-center">
              <div className="mx-auto w-20 h-20 rounded-full bg-muted-light flex items-center justify-center mb-2 overflow-hidden">
                {avatarPreview ? (
                  <img src={avatarPreview} alt="avatar preview" className="w-full h-full object-cover" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 2c-4 0-7 2-7 4v1h14v-1c0-2-3-4-7-4z" />
                  </svg>
                )}
              </div>
              <div className="text-sm text-muted-foreground mb-2">Upload a photo (optional)</div>
              <div className="flex items-center justify-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const f = e.target.files && e.target.files[0];
                    if (f) {
                      setAvatarFileName(f.name);
                      const url = URL.createObjectURL(f);
                      setAvatarPreview(url);
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                  Choose photo
                </Button>
                <div className="text-sm text-muted-foreground">{avatarFileName || "No file chosen"}</div>
              </div>
            </div>

            <form
              className="space-y-4"
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
                    <Select value={form.country || ""} onValueChange={(val: string) => setForm({ ...form, country: val })}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select your country" />
                      </SelectTrigger>
                      <SelectContent>
                        {/* A concise list of commonly selected countries; add more if desired */}
                        <SelectItem value="United States">United States</SelectItem>
                        <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                        <SelectItem value="Canada">Canada</SelectItem>
                        <SelectItem value="Australia">Australia</SelectItem>
                        <SelectItem value="India">India</SelectItem>
                        <SelectItem value="Philippines">Philippines</SelectItem>
                        <SelectItem value="Singapore">Singapore</SelectItem>
                        <SelectItem value="United Arab Emirates">United Arab Emirates</SelectItem>
                        <SelectItem value="Germany">Germany</SelectItem>
                        <SelectItem value="France">France</SelectItem>
                        <SelectItem value="Spain">Spain</SelectItem>
                        <SelectItem value="Italy">Italy</SelectItem>
                        <SelectItem value="Netherlands">Netherlands</SelectItem>
                        <SelectItem value="Brazil">Brazil</SelectItem>
                        <SelectItem value="Mexico">Mexico</SelectItem>
                        <SelectItem value="Japan">Japan</SelectItem>
                        <SelectItem value="South Korea">South Korea</SelectItem>
                        <SelectItem value="China">China</SelectItem>
                        <SelectItem value="Thailand">Thailand</SelectItem>
                        <SelectItem value="Vietnam">Vietnam</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
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
