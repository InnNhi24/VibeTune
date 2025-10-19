"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseServiceRole = exports.supabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseAnonKey);
exports.supabaseServiceRole = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceRoleKey);
//# sourceMappingURL=supabase.js.map