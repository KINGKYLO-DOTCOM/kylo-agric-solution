/* =========================================================
   CUSTOMER ACCOUNT
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        const session =
            await requireAuth();


        if (!session) {
            return;
        }


        if (!window.kyloSupabase) {
            return;
        }


        const profileBox =
            document.getElementById(
                "profileBox"
            );


        const ordersBox =
            document.getElementById(
                "ordersBox"
            );


        /* =================================================
           PROFILE
           ================================================= */

        const {
            data: profile,
            error: profileError
        } =
            await window.kyloSupabase
                .from("profiles")
                .select("*")
                .eq(
                    "id",
                    session.user.id
                )
                .maybeSingle();


        if (profileError) {

            console.error(
                profileError
            );

        }


        if (profileBox) {

            profileBox.innerHTML = `

                <div class="profile-row">

                    <strong>
                        Name
                    </strong>

                    <span>
                        ${escapeHTML(
                            profile?.full_name ||
                            session.user.user_metadata?.full_name ||
                            "Not provided"
                        )}
                    </span>

                </div>


                <div class="profile-row">

                    <strong>
                        Email
                    </strong>

                    <span>
                        ${escapeHTML(
                            session.user.email
                        )}
                    </span>

                </div>


                <div class="profile-row">

                    <strong>
                        Phone
                    </strong>

                    <span>
                        ${escapeHTML(
                            profile?.phone ||
                            session.user.user_metadata?.phone ||
                            "Not provided"
                        )}
                    </span>

                </div>

            `;

        }


        /* =================================================
           ORDERS
           ================================================= */

        const {
            data: orders,
            error: ordersError
        } =
            await window.kyloSupabase
                .from("orders")
                .select("*")
                .eq(
                    "user_id",
                    session.user.id
                )
                .order(
                    "created_at",
                    {
                        ascending: false
                    }
                );


        if (ordersError) {

            console.error(
                ordersError
            );


            if (ordersBox) {

                ordersBox.innerHTML =
                    "Could not load orders.";

            }

            return;
        }


        if (!orders?.length) {

            ordersBox.innerHTML = `

                <p>
                    You have not placed any orders yet.
                </p>

                <br>

                <a
                    href="products.html"
                    class="btn btn-primary">

                    Browse Products

                </a>

            `;

            return;
        }


        ordersBox.innerHTML = `

            <div class="table-wrapper">

                <table>

                    <thead>

                        <tr>

                            <th>
                                Order
                            </th>

                            <th>
                                Date
                            </th>

                            <th>
                                Total
                            </th>

                            <th>
                                Status
                            </th>

                            <th>
                                Payment
                            </th>

                        </tr>

                    </thead>


                    <tbody>

                        ${orders.map(
                            order => `

                                <tr>

                                    <td>
                                        ${escapeHTML(
                                            order.id.slice(0,8)
                                        )}
                                    </td>

                                    <td>
                                        ${new Date(
                                            order.created_at
                                        ).toLocaleDateString()}
                                    </td>

                                    <td>
                                        ${money(
                                            order.total
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHTML(
                                            order.status ||
                                            "pending"
                                        )}
                                    </td>

                                    <td>
                                        ${escapeHTML(
                                            order.payment_status ||
                                            "pending"
                                        )}
                                    </td>

                                </tr>

                            `
                        ).join("")}

                    </tbody>

                </table>

            </div>

        `;


        const signOut =
            document.getElementById(
                "signOutBtn"
            );


        if (signOut) {

            signOut.addEventListener(
                "click",
                async () => {

                    await window.kyloSupabase
                        .auth
                        .signOut();

                    window.location.href =
                        "index.html";

                }
            );

        }

    }
);