(function () {

    const config = window.KYLO_CONFIG || {};

    const configured =
        config.https://agbxvfdkcjkoadqpxbia.supabase.co &&
        config.sb_publishable_CrixC6qtHkPj_rHO7pYdUg_DoPE77RO &&
        !config.https://agbxvfdkcjkoadqpxbia.supabase.co.includes("YOUR-PROJECT") &&
        !config.sb_publishable_CrixC6qtHkPj_rHO7pYdUg_DoPE77RO.includes("YOUR_SUPABASE");

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
            config.https://agbxvfdkcjkoadqpxbia.supabase.co,
            config.sb_publishable_CrixC6qtHkPj_rHO7pYdUg_DoPE77RO,
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            }
        );

})();
