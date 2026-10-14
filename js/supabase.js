
(function () {
    const config = window.KYLO_CONFIG || {};

    const url = config.SUPABASE_URL;
    const key = config.SUPABASE_ANON_KEY;

    const configured =
        typeof url === "string" &&
        /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) &&
        typeof key === "string" &&
        key.length > 20 &&
        !url.includes("YOUR-PROJECT-REF") &&
        !key.includes("YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY");

    if (!configured) {
        window.kyloSupabase = null;
        console.error(
            "KYLO: Supabase configuration is missing or contains placeholders."
        );
        return;
    }

    if (
        !window.supabase ||
        typeof window.supabase.createClient !== "function"
    ) {
        window.kyloSupabase = null;
        console.error(
            "KYLO: Supabase library was not loaded. Check the script imports."
        );
        return;
    }

    window.kyloSupabase = window.supabase.createClient(url, key, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    });

    console.log("KYLO: Supabase client initialized.");
})();
