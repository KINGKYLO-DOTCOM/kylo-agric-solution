/* =========================================================
   KYLO AUTHENTICATION
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const loginForm =
            document.getElementById(
                "loginForm"
            );

        const registerForm =
            document.getElementById(
                "registerForm"
            );


        if (!window.kyloSupabase) {

            if (
                loginForm ||
                registerForm
            ) {

                notify(
                    "Supabase is not configured yet."
                );

            }

            return;
        }


        /* =================================================
           LOGIN
           ================================================= */

        if (loginForm) {

            loginForm.addEventListener(
                "submit",
                async event => {

                    event.preventDefault();


                    const email =
                        document.getElementById(
                            "loginEmail"
                        ).value.trim();


                    const password =
                        document.getElementById(
                            "loginPassword"
                        ).value;


                    const {
                        error
                    } =
                        await window.kyloSupabase.auth
                            .signInWithPassword({

                                email,
                                password

                            });


                    if (error) {

                        notify(
                            error.message
                        );

                        return;
                    }


                    notify(
                        "Login successful."
                    );


                    const params =
                        new URLSearchParams(
                            window.location.search
                        );


                    const next =
                        params.get("next");


                    setTimeout(
                        () => {

                            window.location.href =
                                next ||
                                "account.html";

                        },
                        700
                    );

                }
            );

        }


        /* =================================================
           REGISTER
           ================================================= */

        if (registerForm) {

            registerForm.addEventListener(
                "submit",
                async event => {

                    event.preventDefault();


                    const name =
                        document.getElementById(
                            "registerName"
                        ).value.trim();


                    const phone =
                        document.getElementById(
                            "registerPhone"
                        ).value.trim();


                    const email =
                        document.getElementById(
                            "registerEmail"
                        ).value.trim();


                    const password =
                        document.getElementById(
                            "registerPassword"
                        ).value;


                    const {
                        data,
                        error
                    } =
                        await window.kyloSupabase.auth
                            .signUp({

                                email,

                                password,

                                options: {

                                    data: {

                                        full_name:
                                            name,

                                        phone:
                                            phone

                                    }

                                }

                            });


                    if (error) {

                        notify(
                            error.message
                        );

                        return;
                    }


                    if (data.session) {

                        notify(
                            "Account created successfully."
                        );

                        setTimeout(
                            () => {

                                window.location.href =
                                    "account.html";

                            },
                            700
                        );

                    } else {

                        notify(
                            "Account created. Check your email to confirm your account."
                        );

                    }

                }
            );

        }


        /* =================================================
           SIGN OUT
           ================================================= */

        document
            .querySelectorAll(
                "#signOutBtn, [data-signout]"
            )
            .forEach(button => {

                button.addEventListener(
                    "click",
                    async () => {

                        const {
                            error
                        } =
                            await window.kyloSupabase.auth
                                .signOut();


                        if (error) {

                            notify(
                                error.message
                            );

                            return;
                        }


                        window.location.href =
                            "index.html";

                    }
                );

            });

    }
);