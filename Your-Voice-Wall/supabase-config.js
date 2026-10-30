const SUPABASE_URL = "https://azxridpzafotjvyacamr.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_YUQS1DVkAlffI1rAcRJknw_BTdHWTix";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

console.log("Your Voice Wall connected to Supabase!");