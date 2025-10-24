export declare const supabase: import("@supabase/supabase-js").SupabaseClient<any, "public", "public", any, any>;
/**
 * Create a server-side Supabase client that uses the service role key.
 * This factory throws if the service role key is missing to avoid accidental
 * creation of an elevated client without credentials.
 */
export declare const createServiceRoleClient: () => import("@supabase/supabase-js").SupabaseClient<any, "public", "public", any, any>;
//# sourceMappingURL=supabase.d.ts.map