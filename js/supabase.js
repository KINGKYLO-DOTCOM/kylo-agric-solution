(function () {

    const config = window.KYLO_CONFIG || {};

    const configured =
        config.SUPABASE_URL &&
        config.SUPABASE_ANON_KEY &&
        !config.SUPABASE_URL.includes("https://agbxvfdkcjkoadqpxbia.supabase.co") &&
        !config.SUPABASE_ANON_KEY.includes("sb_publishable_CrixC6qtHkPj_rHO7pYdUg_DoPE77RO");

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
