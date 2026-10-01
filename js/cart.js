/* =========================================================
   CART
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        const container =
            document.getElementById(
                "cartItems"
            );


        if (!container) {
            return;
        }


        function renderCart() {

            const cart =
                cartGet();


            if (!cart.length) {

                container.innerHTML = `

                    <div class="dashboard-card">

                        <h2>
                            Your cart is empty
                        </h2>

                        <p>
                            Browse our agricultural products
                            and add items to your cart.
                        </p>

                        <br>

                        <a
                            href="products.html"
                            class="btn btn-primary">

                            Browse Products

                        </a>

                    </div>

                `;


                document.getElementById(
                    "cartSubtotal"
                ).textContent = money(0);


                document.getElementById(
                    "cartTotal"
                ).textContent = money(0);


                return;
            }


            container.innerHTML =
                cart.map(
                    (item, index) => `

                        <article class="cart-item">

                            <img
                                src="${escapeHTML(
                                    item.image ||
                                    "images/placeholder.svg"
                                )}"
                                alt="${escapeHTML(
                                    item.name
                                )}"
                                onerror="this.src='images/placeholder.svg'">


                            <div>

                                <h3>
                                    ${escapeHTML(
                                        item.name
                                    )}
                                </h3>

                                <p>
                                    ${money(item.price)}
                                    each
                                </p>


                                <div class="quantity-controls">

                                    <button
                                        data-action="minus"
                                        data-index="${index}">

                                        −

                                    </button>


                                    <strong>
                                        ${item.quantity}
                                    </strong>


                                    <button
                                        data-action="plus"
                                        data-index="${index}">

                                        +

                                    </button>

                                </div>

                            </div>


                            <div>

                                <strong>
                                    ${money(
                                        item.price *
                                        item.quantity
                                    )}
                                </strong>


                                <br>


                                <button
                                    class="btn btn-outline"
                                    data-action="remove"
                                    data-index="${index}">

                                    Remove

                                </button>

                            </div>

                        </article>

                    `
                )
                .join("");


            const subtotal =
                cart.reduce(
                    (sum, item) =>
                        sum +
                        Number(item.price) *
                        Number(item.quantity),
                    0
                );


            document.getElementById(
                "cartSubtotal"
            ).textContent =
                money(subtotal);


            document.getElementById(
                "cartTotal"
            ).textContent =
                money(subtotal);


            container
                .querySelectorAll(
                    "[data-action]"
                )
                .forEach(button => {

                    button.addEventListener(
                        "click",
                        () => {

                            const index =
                                Number(
                                    button.dataset.index
                                );


                            const action =
                                button.dataset.action;


                            const updated =
                                cartGet();


                            if (action === "plus") {

                                updated[index].quantity++;

                            }


                            if (action === "minus") {

                                updated[index].quantity--;

                                if (
                                    updated[index].quantity <= 0
                                ) {

                                    updated.splice(
                                        index,
                                        1
                                    );

                                }

                            }


                            if (action === "remove") {

                                updated.splice(
                                    index,
                                    1
                                );

                            }


                            cartSave(updated);

                            renderCart();

                        }
                    );

                });

        }


        renderCart();

    }
);