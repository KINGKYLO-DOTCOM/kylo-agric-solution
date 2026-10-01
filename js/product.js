/* =========================================================
   PRODUCT DETAIL
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    async () => {

        const container =
            document.getElementById(
                "productDetail"
            );


        if (!container) {
            return;
        }


        const params =
            new URLSearchParams(
                window.location.search
            );


        const id =
            params.get("id");


        if (!id) {

            container.innerHTML = `

                <div class="dashboard-card">

                    <h2>
                        Product not found
                    </h2>

                    <p>
                        No product was selected.
                    </p>

                    <br>

                    <a
                        href="products.html"
                        class="btn btn-primary">

                        View Products

                    </a>

                </div>

            `;

            return;
        }


        let product = null;


        if (window.kyloSupabase) {

            const {
                data,
                error
            } =
                await window.kyloSupabase
                    .from("products")
                    .select(`
                        *,
                        categories (
                            name
                        )
                    `)
                    .eq("is_active", true)
                    .or(
                        `id.eq.${id},slug.eq.${id}`
                    )
                    .maybeSingle();


            if (!error) {
                product = data;
            }

        }


        if (!product) {

            product =
                demoProducts.find(
                    item =>
                        String(item.id) ===
                            String(id) ||
                        item.slug === id
                );

        }


        if (!product) {

            container.innerHTML = `

                <div class="dashboard-card">

                    <h2>
                        Product not found
                    </h2>

                    <p>
                        This product could not be found.
                    </p>

                </div>

            `;

            return;
        }


        const category =
            product.categories?.name ||
            product.category ||
            "Agriculture";


        const image =
            product.image_url ||
            product.image ||
            "images/placeholder.svg";


        const isQuote =
            product.quote_only ||
            product.price === null ||
            product.price === undefined;


        const actionHTML =
            isQuote

                ? `

                    <a
                        href="enquiry.html?product=${encodeURIComponent(product.name)}"
                        class="btn btn-primary">

                        Request a Quote

                    </a>

                `

                : `

                    <button
                        id="detailAddCart"
                        class="btn btn-primary">

                        Add to Cart

                    </button>

                `;


        container.innerHTML = `

            <div>

                <img
                    class="product-detail-image"
                    src="${escapeHTML(image)}"
                    alt="${escapeHTML(product.name)}"
                    onerror="this.src='images/placeholder.svg'">

            </div>


            <div class="product-detail-content">

                <span class="eyebrow">
                    ${escapeHTML(category)}
                </span>


                <h1>
                    ${escapeHTML(product.name)}
                </h1>


                <p>
                    ${escapeHTML(
                        product.description ||
                        ""
                    )}
                </p>


                ${
                    product.long_description

                    ? `

                        <p>
                            ${escapeHTML(
                                product.long_description
                            )}
                        </p>

                    `

                    : ""
                }


                <div class="product-detail-price">

                    ${
                        isQuote
                            ? "Price on Request"
                            : money(product.price)
                    }

                </div>


                <div class="product-actions">

                    ${actionHTML}

                    <a
                        href="products.html"
                        class="btn btn-outline">

                        Back to Products

                    </a>

                </div>

            </div>

        `;


        const addButton =
            document.getElementById(
                "detailAddCart"
            );


        if (addButton) {

            addButton.addEventListener(
                "click",
                () => {

                    addToCart(product);

                }
            );

        }

    }
);