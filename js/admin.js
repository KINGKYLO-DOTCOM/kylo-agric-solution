let adminState = {
  products: [],
  categories: [],
  orders: [],
  enquiries: [],
  customers: [],
  editingProductId: null
};

async function getAdminToken() {
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  if (error || !session) {
    throw new Error("Your session has expired. Please log in again.");
  }

  return session.access_token;
}

async function adminRequest(action, payload = {}) {
  const token = await getAdminToken();

  const response = await fetch("/api/admin-api", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token}`
    },
    body: JSON.stringify({
      action,
      ...payload
    })
  });

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error("The server returned an invalid response.");
  }

  if (!response.ok || !result.success) {
    throw new Error(
      result.error || "Administrator request failed."
    );
  }

  return result.data;
}

/* ----------------------------- ACCESS ----------------------------- */

async function checkAdminAccess() {
  const {
    data: { session }
  } = await supabase.auth.getSession();

  if (!session) {
    window.location.href = "auth.html?redirect=admin.html";
    return false;
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", session.user.id)
    .single();

  if (error || !profile || profile.role !== "admin") {
    alert("Administrator access required.");
    window.location.href = "index.html";
    return false;
  }

  const adminName =
    document.getElementById("adminName");

  if (adminName) {
    adminName.textContent =
      profile.full_name ||
      session.user.email ||
      "Administrator";
  }

  return true;
}

/* ----------------------------- DASHBOARD ----------------------------- */

async function loadDashboardStats() {
  const stats = await adminRequest("dashboard");

  setText("totalProducts", stats.totalProducts);
  setText("activeProducts", stats.activeProducts);
  setText("totalOrders", stats.totalOrders);
  setText("pendingOrders", stats.pendingOrders);
  setText("totalEnquiries", stats.enquiries);
  setText("pendingEnquiries", stats.pendingEnquiries);
  setText("totalCustomers", stats.customers);
  setText("lowStock", stats.lowStock);
}

function setText(id, value) {
  const element = document.getElementById(id);

  if (element) {
    element.textContent = value ?? 0;
  }
}

/* ----------------------------- CATEGORIES ----------------------------- */

async function loadCategories() {
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, slug")
    .order("name");

  if (error) {
    console.error(error);
    return;
  }

  adminState.categories = data || [];

  const select =
    document.getElementById("productCategory");

  if (!select) return;

  select.innerHTML =
    `<option value="">Select category</option>`;

  adminState.categories.forEach(category => {
    const option =
      document.createElement("option");

    option.value = category.id;
    option.textContent = category.name;

    select.appendChild(option);
  });
}

/* ----------------------------- PRODUCTS ----------------------------- */

async function loadProducts() {
  const products =
    await adminRequest("get_products");

  adminState.products = products || [];

  renderProducts();
}

function renderProducts() {
  const tbody =
    document.getElementById("productsTableBody");

  if (!tbody) return;

  const search =
    (document.getElementById("productSearch")?.value || "")
      .toLowerCase()
      .trim();

  const filtered =
    adminState.products.filter(product => {
      const text = [
        product.name,
        product.sku,
        product.description,
        product.categories?.name
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(search);
    });

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          No products found.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(product => `
    <tr>
      <td>
        <strong>${escapeHtml(product.name)}</strong>
        <small>${escapeHtml(product.sku || "")}</small>
      </td>

      <td>
        ${escapeHtml(product.categories?.name || "—")}
      </td>

      <td>
        ${
          product.quote_only
            ? "Quote"
            : formatCurrency(product.price)
        }
      </td>

      <td>
        ${Number(product.stock_quantity || 0)}
      </td>

      <td>
        ${
          product.is_active
            ? `<span class="status active">Active</span>`
            : `<span class="status inactive">Inactive</span>`
        }
      </td>

      <td>
        ${product.unit || "—"}
      </td>

      <td>
        ${formatDate(product.created_at)}
      </td>

      <td>
        <div class="admin-actions">
          <button
            class="btn btn-small"
            onclick="editProduct('${product.id}')"
          >
            Edit
          </button>

          <button
            class="btn btn-small ${
              product.is_active
                ? "btn-danger"
                : "btn-success"
            }"
            onclick="toggleProduct(
              '${product.id}',
              ${!product.is_active}
            )"
          >
            ${
              product.is_active
                ? "Disable"
                : "Enable"
            }
          </button>
        </div>
      </td>
    </tr>
  `).join("");
}

function resetProductForm() {
  adminState.editingProductId = null;

  const form =
    document.getElementById("productForm");

  if (form) {
    form.reset();
  }

  const active =
    document.getElementById("productActive");

  const quoteOnly =
    document.getElementById("productQuoteOnly");

  if (active) {
    active.checked = true;
  }

  if (quoteOnly) {
    quoteOnly.checked = true;
  }

  const title =
    document.getElementById("productFormTitle");

  if (title) {
    title.textContent = "Add Product";
  }

  const submit =
    document.querySelector(
      "#productForm button[type='submit']"
    );

  if (submit) {
    submit.textContent = "Save Product";
  }
}

function editProduct(id) {
  const product =
    adminState.products.find(
      item => item.id === id
    );

  if (!product) {
    return;
  }

  adminState.editingProductId = id;

  setInputValue("productName", product.name);
  setInputValue("productCategory", product.category_id);
  setInputValue("productDescription", product.description);
  setInputValue("productPrice", product.price ?? "");
  setInputValue("productUnit", product.unit);
  setInputValue(
    "productStock",
    product.stock_quantity ?? 0
  );
  setInputValue("productImage", product.image_url);
  setInputValue("productSku", product.sku);

  const quoteOnly =
    document.getElementById("productQuoteOnly");

  const active =
    document.getElementById("productActive");

  if (quoteOnly) {
    quoteOnly.checked =
      Boolean(product.quote_only);
  }

  if (active) {
    active.checked =
      Boolean(product.is_active);
  }

  const title =
    document.getElementById("productFormTitle");

  if (title) {
    title.textContent = "Edit Product";
  }

  const submit =
    document.querySelector(
      "#productForm button[type='submit']"
    );

  if (submit) {
    submit.textContent = "Update Product";
  }

  document
    .getElementById("productForm")
    ?.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
}

function setInputValue(id, value) {
  const element =
    document.getElementById(id);

  if (element) {
    element.value = value ?? "";
  }
}

async function saveProduct(event) {
  event.preventDefault();

  const product = {
    name:
      document.getElementById("productName")?.value || "",

    category_id:
      document.getElementById("productCategory")?.value || "",

    description:
      document.getElementById("productDescription")?.value || "",

    price:
      document.getElementById("productPrice")?.value || "",

    unit:
      document.getElementById("productUnit")?.value || "",

    stock_quantity:
      document.getElementById("productStock")?.value || 0,

    image_url:
      document.getElementById("productImage")?.value || "",

    sku:
      document.getElementById("productSku")?.value || "",

    quote_only:
      document.getElementById("productQuoteOnly")?.checked ?? true,

    is_active:
      document.getElementById("productActive")?.checked ?? true
  };

  try {
    const button =
      event.target.querySelector(
        "button[type='submit']"
      );

    if (button) {
      button.disabled = true;
      button.textContent = "Saving...";
    }

    if (adminState.editingProductId) {
      product.id =
        adminState.editingProductId;

      await adminRequest(
        "update_product",
        { product }
      );

      alert("Product updated successfully.");
    } else {
      await adminRequest(
        "create_product",
        { product }
      );

      alert("Product created successfully.");
    }

    resetProductForm();
    await loadProducts();
    await loadDashboardStats();

  } catch (error) {
    console.error(error);
    alert(error.message);
  } finally {
    const button =
      event.target.querySelector(
        "button[type='submit']"
      );

    if (button) {
      button.disabled = false;
      button.textContent =
        adminState.editingProductId
          ? "Update Product"
          : "Save Product";
    }
  }
}

async function toggleProduct(id, isActive) {
  const action =
    isActive ? "enable" : "disable";

  if (
    !confirm(
      `Are you sure you want to ${action} this product?`
    )
  ) {
    return;
  }

  try {
    await adminRequest(
      "toggle_product",
      {
        product: {
          id,
          is_active: isActive
        }
      }
    );

    await loadProducts();
    await loadDashboardStats();

  } catch (error) {
    console.error(error);
    alert(error.message);
  }
}

/* ----------------------------- ORDERS ----------------------------- */

async function loadOrders() {
  const orders =
    await adminRequest("get_orders");

  adminState.orders = orders || [];

  renderOrders();
}

function renderOrders() {
  const tbody =
    document.getElementById("ordersTableBody");

  if (!tbody) return;

  const search =
    (document.getElementById("orderSearch")?.value || "")
      .toLowerCase()
      .trim();

  const statusFilter =
    document.getElementById("orderStatusFilter")?.value || "";

  const filtered =
    adminState.orders.filter(order => {
      const searchText = [
        order.id,
        order.user_id,
        order.fulfilment_method,
        order.customer_note
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        searchText.includes(search);

      const matchesStatus =
        !statusFilter ||
        order.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          No orders found.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(order => `
    <tr>
      <td>
        <strong>${escapeHtml(
          String(order.id).slice(0, 8)
        )}</strong>
      </td>

      <td>
        ${formatCurrency(order.total)}
      </td>

      <td>
        ${escapeHtml(
          order.fulfilment_method || "collection"
        )}
      </td>

      <td>
        ${escapeHtml(
          order.payment_status || "pending"
        )}
      </td>

      <td>
        <select
          onchange="changeOrderStatus(
            '${order.id}',
            this.value
          )"
        >
          ${orderStatusOptions(order.status)}
        </select>
      </td>

      <td>
        ${formatDate(order.created_at)}
      </td>

      <td>
        ${order.order_items?.length || 0}
      </td>

      <td>
        ${escapeHtml(
          order.customer_note || "—"
        )}
      </td>
    </tr>
  `).join("");
}

function orderStatusOptions(current) {
  const statuses = [
    "pending",
    "confirmed",
    "processing",
    "ready",
    "completed",
    "cancelled"
  ];

  return statuses.map(status => `
    <option
      value="${status}"
      ${status === current ? "selected" : ""}
    >
      ${capitalize(status)}
    </option>
  `).join("");
}

async function changeOrderStatus(id, status) {
  try {
    await adminRequest(
      "update_order_status",
      {
        order: {
          id,
          status
        }
      }
    );

    await loadOrders();
    await loadDashboardStats();

  } catch (error) {
    console.error(error);
    alert(error.message);
    await loadOrders();
  }
}

/* ----------------------------- ENQUIRIES ----------------------------- */

async function loadEnquiries() {
  const enquiries =
    await adminRequest("get_enquiries");

  adminState.enquiries =
    enquiries || [];

  renderEnquiries();
}

function renderEnquiries() {
  const tbody =
    document.getElementById(
      "enquiriesTableBody"
    );

  if (!tbody) return;

  const search =
    (
      document.getElementById(
        "enquirySearch"
      )?.value || ""
    )
      .toLowerCase()
      .trim();

  const statusFilter =
    document.getElementById(
      "enquiryStatusFilter"
    )?.value || "";

  const filtered =
    adminState.enquiries.filter(enquiry => {
      const searchText = [
        enquiry.name,
        enquiry.email,
        enquiry.phone,
        enquiry.product,
        enquiry.location,
        enquiry.message
      ]
        .join(" ")
        .toLowerCase();

      return (
        searchText.includes(search) &&
        (
          !statusFilter ||
          enquiry.status === statusFilter
        )
      );
    });

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8">
          No enquiries found.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(enquiry => `
    <tr>
      <td>
        <strong>
          ${escapeHtml(enquiry.name || "—")}
        </strong>
      </td>

      <td>
        ${escapeHtml(enquiry.phone || "—")}
      </td>

      <td>
        ${escapeHtml(enquiry.email || "—")}
      </td>

      <td>
        ${escapeHtml(enquiry.product || "—")}
      </td>

      <td>
        ${escapeHtml(enquiry.quantity || "—")}
      </td>

      <td>
        <select
          onchange="changeEnquiryStatus(
            '${enquiry.id}',
            this.value
          )"
        >
          ${enquiryStatusOptions(enquiry.status)}
        </select>
      </td>

      <td>
        ${formatDate(enquiry.created_at)}
      </td>

      <td>
        ${escapeHtml(enquiry.message || "—")}
      </td>
    </tr>
  `).join("");
}

function enquiryStatusOptions(current) {
  const statuses = [
    "new",
    "contacted",
    "quoted",
    "converted",
    "closed"
  ];

  return statuses.map(status => `
    <option
      value="${status}"
      ${status === current ? "selected" : ""}
    >
      ${capitalize(status)}
    </option>
  `).join("");
}

async function changeEnquiryStatus(id, status) {
  try {
    await adminRequest(
      "update_enquiry_status",
      {
        enquiry: {
          id,
          status
        }
      }
    );

    await loadEnquiries();
    await loadDashboardStats();

  } catch (error) {
    console.error(error);
    alert(error.message);
    await loadEnquiries();
  }
}

/* ----------------------------- CUSTOMERS ----------------------------- */

async function loadCustomers() {
  const customers =
    await adminRequest("get_customers");

  adminState.customers =
    customers || [];

  renderCustomers();
}

function renderCustomers() {
  const tbody =
    document.getElementById(
      "customersTableBody"
    );

  if (!tbody) return;

  const search =
    (
      document.getElementById(
        "customerSearch"
      )?.value || ""
    )
      .toLowerCase()
      .trim();

  const filtered =
    adminState.customers.filter(customer => {
      const text = [
        customer.full_name,
        customer.email,
        customer.phone
      ]
        .join(" ")
        .toLowerCase();

      return text.includes(search);
    });

  if (!filtered.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6">
          No customers found.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(customer => `
    <tr>
      <td>
        ${escapeHtml(
          customer.full_name || "—"
        )}
      </td>

      <td>
        ${escapeHtml(
          customer.email || "—"
        )}
      </td>

      <td>
        ${escapeHtml(
          customer.phone || "—"
        )}
      </td>

      <td>
        ${escapeHtml(
          customer.role || "customer"
        )}
      </td>

      <td>
        ${formatDate(customer.created_at)}
      </td>

      <td>
        ${escapeHtml(customer.id)}
      </td>
    </tr>
  `).join("");
}

/* ----------------------------- UTILITIES ----------------------------- */

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function capitalize(value) {
  if (!value) return "";

  return String(value)
    .charAt(0)
    .toUpperCase() +
    String(value).slice(1);
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(
    "en-ZW",
    {
      year: "numeric",
      month: "short",
      day: "numeric"
    }
  );
}

function formatCurrency(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "Quote";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "Quote";
  }

  return `$${number.toFixed(2)}`;
}

/* ----------------------------- EVENTS ----------------------------- */

function setupAdminEvents() {
  const productForm =
    document.getElementById("productForm");

  if (productForm) {
    productForm.addEventListener(
      "submit",
      saveProduct
    );
  }

  document
    .getElementById("productSearch")
    ?.addEventListener(
      "input",
      renderProducts
    );

  document
    .getElementById("orderSearch")
    ?.addEventListener(
      "input",
      renderOrders
    );

  document
    .getElementById("orderStatusFilter")
    ?.addEventListener(
      "change",
      renderOrders
    );

  document
    .getElementById("enquirySearch")
    ?.addEventListener(
      "input",
      renderEnquiries
    );

  document
    .getElementById("enquiryStatusFilter")
    ?.addEventListener(
      "change",
      renderEnquiries
    );

  document
    .getElementById("customerSearch")
    ?.addEventListener(
      "input",
      renderCustomers
    );

  document
    .getElementById("resetProductButton")
    ?.addEventListener(
      "click",
      resetProductForm
    );

  document
    .getElementById("logoutButton")
    ?.addEventListener(
      "click",
      logoutAdmin
    );
}

async function logoutAdmin() {
  await supabase.auth.signOut();

  window.location.href = "auth.html";
}

/* ----------------------------- INITIALIZATION ----------------------------- */

async function initAdmin() {
  try {
    const allowed =
      await checkAdminAccess();

    if (!allowed) {
      return;
    }

    setupAdminEvents();

    await Promise.all([
      loadCategories(),
      loadProducts(),
      loadOrders(),
      loadEnquiries(),
      loadCustomers(),
      loadDashboardStats()
    ]);

  } catch (error) {
    console.error("Admin initialization error:", error);

    alert(
      error.message ||
      "Unable to load administrator dashboard."
    );
  }
}

document.addEventListener(
  "DOMContentLoaded",
  initAdmin
);