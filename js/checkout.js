document.addEventListener(
  "DOMContentLoaded",
  async () => {

    const supabase =
      window.kyloSupabase;

    if (!supabase) {
      console.error(
        "Supabase is not configured."
      );
      return;
    }

    const cart =
      JSON.parse(
        localStorage.getItem("kylo_cart") || "[]"
      );

    const container =
      document.getElementById(
        "checkoutItems"
      );

    const subtotalElement =
      document.getElementById(
        "checkoutSubtotal"
      );

    const deliveryElement =
      document.getElementById(
        "checkoutDelivery"
      );

    const totalElement =
      document.getElementById(
        "checkoutTotal"
      );

    const checkoutForm =
      document.getElementById(
        "checkoutForm"
      );

    // ==================================================
    // AUTHENTICATION
    // ==================================================

    const {
      data: {
        session
      }
    } = await supabase.auth.getSession();

    if (!session) {

      window.location.href =
        `auth.html?redirect=${encodeURIComponent(
          "checkout.html"
        )}`;

      return;
    }

    // ==================================================
    // EMPTY CART
    // ==================================================

    if (!cart.length) {

      if (container) {

        container.innerHTML = `
          <div class="empty-state">

            <h3>Your cart is empty</h3>

            <p>
              Add products before continuing
              to checkout.
            </p>

            <a
              href="products.html"
              class="btn btn-primary"
            >
              Browse Products
            </a>

          </div>
        `;
      }

      if (checkoutForm) {
        checkoutForm.style.display =
          "none";
      }

      return;
    }

    // ==================================================
    // GET CURRENT PRODUCTS
    // ==================================================

    const productIds =
      cart.map(item => item.id);

    const {
      data: products,
      error
    } = await supabase
      .from("products")
      .select(`
        id,
        name,
        price,
        unit,
        quote_only,
        is_active
      `)
      .in("id", productIds);

    if (error) {

      console.error(error);

      if (container) {
        container.innerHTML = `
          <div class="alert error">
            Unable to load your cart.
          </div>
        `;
      }

      return;
    }

    // ==================================================
    // DISPLAY CART
    // ==================================================

    let subtotal = 0;

    if (container) {
      container.innerHTML = "";
    }

    cart.forEach(cartItem => {

      const product =
        products.find(
          p => p.id === cartItem.id
        );

      if (!product) {
        return;
      }

      if (
        product.quote_only ||
        product.price === null ||
        product.is_active !== true
      ) {
        return;
      }

      const quantity =
        Math.max(
          1,
          Number(cartItem.quantity || 1)
        );

      const lineTotal =
        Number(product.price) *
        quantity;

      subtotal += lineTotal;

      if (!container) {
        return;
      }

      const row =
        document.createElement("div");

      row.className =
        "checkout-item";

      row.innerHTML = `

        <div>

          <strong>
            ${escapeHTML(product.name)}
          </strong>

          <small>
            ${quantity} ×
            ${money(product.price)}

            ${
              product.unit
                ? ` / ${escapeHTML(
                    product.unit
                  )}`
                : ""
            }

          </small>

        </div>

        <strong>
          ${money(lineTotal)}
        </strong>

      `;

      container.appendChild(row);

    });

    // ==================================================
    // SUMMARY
    // ==================================================

    if (subtotalElement) {
      subtotalElement.textContent =
        money(subtotal);
    }

    if (deliveryElement) {
      deliveryElement.textContent =
        money(0);
    }

    if (totalElement) {
      totalElement.textContent =
        money(subtotal);
    }

    // ==================================================
    // FULFILMENT
    // ==================================================

    const fulfilmentInputs =
      document.querySelectorAll(
        'input[name="fulfilment_method"]'
      );

    fulfilmentInputs.forEach(input => {

      input.addEventListener(
        "change",
        () => {

          /*
           * Delivery fee is currently zero.
           * Admin-controlled delivery pricing
           * will be added later.
           */

          const delivery = 0;

          if (deliveryElement) {
            deliveryElement.textContent =
              money(delivery);
          }

          if (totalElement) {
            totalElement.textContent =
              money(
                subtotal + delivery
              );
          }

        }
      );

    });

    // ==================================================
    // SUBMIT ORDER
    // ==================================================

    if (!checkoutForm) {
      return;
    }

    checkoutForm.addEventListener(
      "submit",
      async event => {

        event.preventDefault();

        const submitButton =
          checkoutForm.querySelector(
            'button[type="submit"]'
          );

        if (submitButton) {

          submitButton.disabled =
            true;

          submitButton.textContent =
            "Creating Order...";
        }

        try {

          // --------------------------------------------
          // REFRESH SESSION
          // --------------------------------------------

          const {
            data: {
              session
            }
          } =
            await supabase.auth.getSession();

          if (!session) {

            throw new Error(
              "Your session has expired. Please sign in again."
            );

          }

          // --------------------------------------------
          // PREPARE CART
          // --------------------------------------------

          const items =
            cart.map(item => ({
              product_id: item.id,
              quantity:
                Number(item.quantity || 1)
            }));

          // --------------------------------------------
          // FULFILMENT
          // --------------------------------------------

          const fulfilmentInput =
            document.querySelector(
              'input[name="fulfilment_method"]:checked'
            );

          const fulfilmentMethod =
            fulfilmentInput
              ? fulfilmentInput.value
              : "collection";

          // --------------------------------------------
          // NOTE
          // --------------------------------------------

          const customerNote =
            document.getElementById(
              "customerNote"
            )?.value
              ?.trim() || "";

          // --------------------------------------------
          // SERVER ORDER CREATION
          // --------------------------------------------

          const response =
            await fetch(
              "/api/create-order",
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json",

                  "Authorization":
                    `Bearer ${session.access_token}`
                },

                body: JSON.stringify({
                  items,
                  fulfilment_method:
                    fulfilmentMethod,
                  customer_note:
                    customerNote
                })
              }
            );

          const result =
            await response.json();

          if (!response.ok) {

            throw new Error(
              result.error ||
              "Unable to create order."
            );

          }

          if (
            !result.order ||
            !result.order.id
          ) {

            throw new Error(
              "The server did not return an order number."
            );

          }

          // --------------------------------------------
          // SAVE LAST ORDER
          // --------------------------------------------

          localStorage.setItem(
            "kylo_last_order_id",
            result.order.id
          );

          // --------------------------------------------
          // CLEAR CART
          // --------------------------------------------

          localStorage.removeItem(
            "kylo_cart"
          );

          // --------------------------------------------
          // PAYMENT PAGE
          // --------------------------------------------

          window.location.href =
            `payment.html?order=${encodeURIComponent(
              result.order.id
            )}`;

        } catch (error) {

          console.error(error);

          if (
            typeof notify ===
            "function"
          ) {

            notify(
              error.message ||
              "Unable to create order."
            );

          } else {

            alert(
              error.message ||
              "Unable to create order."
            );

          }

          if (submitButton) {

            submitButton.disabled =
              false;

            submitButton.textContent =
              "Place Order";
          }

        }

      }
    );

  }
);