/* =========================================================
   KYLO AGRIC SOLUTION
   Main Application JavaScript
   ========================================================= */


const demoProducts = [

    {
        id: "demo-maize",
        name: "Maize",
        slug: "maize",
        category: "Crops",
        description:
            "Quality maize production and supply solutions.",
        image: "images/maize.jpg",
        price: null,
        quote_only: true
    },

    {
        id: "demo-tomatoes",
        name: "Tomatoes",
        slug: "tomatoes",
        category: "Horticulture",
        description:
            "Fresh tomatoes for household and commercial markets.",
        image: "images/tomatoes.jpg",
        price: null,
        quote_only: true
    },

    {
        id: "demo-poultry",
        name: "Poultry",
        slug: "poultry",
        category: "Poultry",
        description:
            "Poultry production and supply solutions.",
        image: "images/poultry.jpg",
        price: null,
        quote_only: true
    },

    {
        id: "demo-cattle",
        name: "Cattle",
        slug: "cattle",
        category: "Livestock",
        description:
            "Cattle production and livestock supply.",
        image: "images/cattle.jpg",
        price: null,
        quote_only: true
    },

    {
        id: "demo-pigs",
        name: "Pigs",
        slug: "pigs",
        category: "Livestock",
        description:
            "Pig production and livestock supply.",
        image: "images/pigs.jpg",
        price: null,
        quote_only: true
    },

    {
        id: "demo-goats",
        name: "Goats",
        slug: "goats",
        category: "Livestock",
        description:
            "Goat farming and livestock supply.",
        image: "images/goats.jpg",
        price: null,
        quote_only: true
    },

    {
        id: "demo-fruits",
        name: "Fruits",
        slug: "fruits",
        category: "Fruits",
        description:
            "Fruit production and supply solutions.",
        image: "images/fruits.jpg",
        price: null,
        quote_only: true
    },

    {
        id: "demo-irrigation",
        name: "Irrigation Systems",
        slug: "irrigation-systems",
        category: "Technology",
        description:
            "Practical irrigation solutions for agricultural production.",
        image: "images/irrigation.jpg",
        price: null,
        quote_only: true
    }

];


/* =========================================================
   HELPERS
   ========================================================= */

function escapeHTML(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


function money(value) {

    const number = Number(value || 0);

    return new Intl.NumberFormat(
        "en-US",
        {
            style: "currency",
            currency: "USD"
        }
    ).format(number);
}


function slugify(value) {

    return String(value || "")
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}


function waLink(message) {

    const number =
        window.KYLO_CONFIG?.COMPANY?.whatsapp ||
        "263787470753";

    return `https://wa.me/${number}?text=${
        encodeURIComponent(message)
    }`;
}


function notify(message) {

    const toast =
        document.getElementById("toast");

    if (!toast) {
        alert(message);
        return;
    }

    toast.textContent = message;

    toast.classList.add("show");

    setTimeout(() => {

        toast.classList.remove("show");

    }, 3500);
}


/* =========================================================
   AUTH
   ========================================================= */

async function getSession() {

    if (!window.kyloSupabase) {
        return null;
    }

    const {
        data,
        error
    } =
        await window.kyloSupabase.auth.getSession();

    if (error) {
        console.error(error);
        return null;
    }

    return data.session;
}


async function requireAuth() {

    const session = await getSession();

    if (!session) {

        const next =
            encodeURIComponent(
                window.location.pathname +
                window.location.search
            );

        window.location.href =
            `auth.html?next=${next}`;

        return null;
    }

    return session;
}


/* =========================================================
   CART
   ========================================================= */

function cartGet() {

    try {

        return JSON.parse(
            localStorage.getItem("kylo_cart") ||
            "[]"
        );

    } catch (error) {

        console.error(error);

        return [];

    }
}


function cartSave(cart) {

    localStorage.setItem(
        "kylo_cart",
        JSON.stringify(cart)
    );

    updateCartCount();
}


function updateCartCount() {

    const cart = cartGet();

    const count =
        cart.reduce(
            (total, item) =>
                total + Number(item.quantity || 0),
            0
        );

    document
        .querySelectorAll("[data-cart-count]")
        .forEach(element => {

            element.textContent = count;

        });
}


function addToCart(product, quantity = 1) {

    if (
        product.quote_only ||
        product.price === null ||
        product.price === undefined
    ) {

        const message =
            `Hello KYLO Agric Solution,

I would like to enquire about:

Product: ${product.name}

Please provide availability and pricing.`;

        window.open(
            waLink(message),
            "_blank"
        );

        return;
    }


    const cart = cartGet();

    const existing =
        cart.find(
            item =>
                item.product_id === product.id
        );


    if (existing) {

        existing.quantity += quantity;

    } else {

        cart.push({

            product_id: product.id,

            name: product.name,

            price: Number(product.price),

            quantity: quantity,

            image:
                product.image ||
                "images/placeholder.svg"

        });

    }


    cartSave(cart);

    notify(
        `${product.name} added to cart.`
    );
}


/* =========================================================
   PRODUCTS
   ========================================================= */

async function fetchProducts() {

    if (!window.kyloSupabase) {

        return demoProducts;

    }


    const {
        data,
        error
    } =
        await window.kyloSupabase
            .from("products")
            .select(`
                id,
                name,
                slug,
                description,
                long_description,
                category_id,
                price,
                quote_only,
                image_url,
                is_active,
                categories (
                    name
                )
            `)
            .eq("is_active", true)
            .order("name");


    if (error) {

        console.error(
            "Product loading error:",
            error
        );

        return demoProducts;
    }


    return (data || []).map(product => ({

        ...product,

        category:
            product.categories?.name ||
            "Agriculture",

        image:
            product.image_url ||
            "images/placeholder.svg"

    }));

}


function productCard(product) {

    const category =
        product.category ||
        product.categories?.name ||
        "Agriculture";


    const isQuote =
        product.quote_only ||
        product.price === null ||
        product.price === undefined;


    const action =
        isQuote
            ? `
                <a
                    class="btn btn-outline"
                    href="enquiry.html?product=${encodeURIComponent(product.name)}">

                    Enquire

                </a>
            `
            : `
                <button
                    class="btn btn-primary add-cart-btn"
                    data-product-id="${escapeHTML(product.id)}">

                    Add to Cart

                </button>
            `;


    return `

        <article class="product-card">

            <a href="product.html?id=${encodeURIComponent(product.id)}">

                <img
                    class="product-image"
                    src="${escapeHTML(
                        product.image ||
                        "images/placeholder.svg"
                    )}"
                    alt="${escapeHTML(product.name)}"
                    onerror="this.src='images/placeholder.svg'">

            </a>


            <div class="product-content">

                <span class="product-category">
                    ${escapeHTML(category)}
                </span>


                <h3>
                    ${escapeHTML(product.name)}
                </h3>


                <p>
                    ${escapeHTML(
                        product.description ||
                        "Agricultural product from KYLO Agric Solution."
                    )}
                </p>


                <div class="product-footer">

                    <strong
                        class="product-price ${
                            isQuote ? "quote" : ""
                        }">

                        ${
                            isQuote
                                ? "Request Quote"
                                : money(product.price)
                        }

                    </strong>

                    ${action}

                </div>

            </div>

        </article>

    `;
}


async function initProductGrid() {

    const grid =
        document.getElementById(
            "productGrid"
        );

    if (!grid) {
        return;
    }


    let products =
        await fetchProducts();


    const search =
        document.getElementById(
            "productSearch"
        );


    let currentFilter = "all";


    function render() {

        const query =
            search?.value
                ?.toLowerCase()
                .trim() ||
            "";


        const filtered =
            products.filter(product => {

                const category =
                    product.category ||
                    product.categories?.name ||
                    "";


                const searchable = [

                    product.name,

                    product.description,

                    product.long_description,

                    category

                ]
                    .filter(Boolean)
                    .join(" ")
                    .toLowerCase();


                const matchesSearch =
                    !query ||
                    searchable.includes(query);


                const matchesCategory =
                    currentFilter === "all" ||
                    category.toLowerCase() ===
                    currentFilter.toLowerCase();


                return (
                    matchesSearch &&
                    matchesCategory
                );

            });


        if (!filtered.length) {

            grid.innerHTML = `

                <div class="dashboard-card">

                    <h3>
                        No products found
                    </h3>

                    <p>
                        Try another search or category.
                    </p>

                </div>

            `;

            return;
        }


        grid.innerHTML =
            filtered
                .map(productCard)
                .join("");


        bindAddButtons(products);

    }


    if (search) {

        search.addEventListener(
            "input",
            render
        );

    }


    document
        .querySelectorAll("[data-filter]")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    document
                        .querySelectorAll(
                            "[data-filter]"
                        )
                        .forEach(btn =>
                            btn.classList.remove(
                                "active"
                            )
                        );


                    button.classList.add(
                        "active"
                    );


                    currentFilter =
                        button.dataset.filter ||
                        "all";


                    render();

                }
            );

        });


    render();

}


function bindAddButtons(products) {

    document
        .querySelectorAll(".add-cart-btn")
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    const product =
                        products.find(
                            item =>
                                String(item.id) ===
                                String(
                                    button.dataset.productId
                                )
                        );


                    if (product) {

                        addToCart(product);

                    }

                }
            );

        });

}


/* =========================================================
   MOBILE MENU
   ========================================================= */

function initMenu() {

    const toggle =
        document.getElementById(
            "menuToggle"
        );

    const nav =
        document.getElementById(
            "siteNav"
        );


    if (!toggle || !nav) {
        return;
    }


    toggle.addEventListener(
        "click",
        () => {

            const open =
                nav.classList.toggle(
                    "open"
                );

            toggle.setAttribute(
                "aria-expanded",
                String(open)
            );

        }
    );

}


/* =========================================================
   AUTH STATE
   ========================================================= */

function initAuthState() {

    if (!window.kyloSupabase) {
        return;
    }


    window.kyloSupabase.auth.onAuthStateChange(
        (event, session) => {

            document
                .querySelectorAll(
                    '[data-auth="logged-in"]'
                )
                .forEach(element => {

                    element.hidden =
                        !session;

                });


            document
                .querySelectorAll(
                    '[data-auth="logged-out"]'
                )
                .forEach(element => {

                    element.hidden =
                        Boolean(session);

                });

        }
    );

}


/* =========================================================
   ENQUIRY FORM
   ========================================================= */

function initEnquiryForm() {

    const form =
        document.getElementById(
            "enquiryForm"
        );

    if (!form) {
        return;
    }


    const params =
        new URLSearchParams(
            window.location.search
        );


    const productParam =
        params.get("product");


    const productInput =
        document.getElementById(
            "product"
        );


    if (
        productParam &&
        productInput
    ) {

        productInput.value =
            productParam;

    }


    form.addEventListener(
        "submit",
        async event => {

            event.preventDefault();


            const data =
                Object.fromEntries(
                    new FormData(form)
                );


            const message = `

Hello KYLO Agric Solution,

I would like to make an enquiry.

Name: ${data.name || ""}

Phone: ${data.phone || ""}

Email: ${data.email || ""}

Product/Service: ${data.product || ""}

Quantity: ${data.quantity || ""}

Location: ${data.location || ""}

Message:
${data.message || ""}

Thank you.

            `.trim();


            /* Save enquiry to Supabase */

            if (window.kyloSupabase) {

                try {

                    const session =
                        await getSession();


                    await window.kyloSupabase
                        .from("enquiries")
                        .insert({

                            user_id:
                                session?.user?.id ||
                                null,

                            name:
                                data.name,

                            phone:
                                data.phone,

                            email:
                                data.email ||
                                null,

                            product:
                                data.product ||
                                null,

                            quantity:
                                data.quantity ||
                                null,

                            location:
                                data.location ||
                                null,

                            message:
                                data.message

                        });

                } catch (error) {

                    console.error(
                        "Could not save enquiry:",
                        error
                    );

                }

            }


            window.open(
                waLink(message),
                "_blank"
            );


            form.reset();

            notify(
                "Your enquiry has been prepared for WhatsApp."
            );

        }
    );

}


/* =========================================================
   START APPLICATION
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initMenu();

        initAuthState();

        updateCartCount();

        initEnquiryForm();

        initProductGrid();

    }
);