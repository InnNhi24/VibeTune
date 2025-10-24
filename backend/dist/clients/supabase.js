"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServiceRoleClient = exports.supabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseAnonKey);
/**
 * Create a server-side Supabase client that uses the service role key.
 * This factory throws if the service role key is missing to avoid accidental
 * creation of an elevated client without credentials.
 */
const createServiceRoleClient = () => {
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseServiceRoleKey) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set; cannot create service-role client');
    }
    return (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceRoleKey);
};
exports.createServiceRoleClient = createServiceRoleClient;
//# sourceMappingURL=supabase.js.map