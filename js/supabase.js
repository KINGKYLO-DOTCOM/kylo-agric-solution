(function () {

    const config = window.KYLO_CONFIG || {};

    const configured =
        config.SUPABASE_URL &&
        config.SUPABASE_ANON_KEY &&
        !config.SUPABASE_URL.includes("YOUR-PROJECT") &&
        !config.SUPABASE_ANON_KEY.includes("YOUR_SUPABASE");

    if (!configured) {

        window.kyloSupabase = null;

        console.warn(
            "KYLO Supabase is not configured yet."
        );

        return;
    }

    if (!window.supabase) {

        console.error(
            "Supabase library was not loaded."
        );

        window.kyloSupabase = null;

        return;
    }

    window.kyloSupabase =
        window.supabase.createClient(
            config.SUPABASE_URL,
            config.SUPABASE_ANON_KEY,
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            }
        );

})();