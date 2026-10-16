
/* =========================================================
   KYLO AGRIC SOLUTION — ADMIN DASHBOARD
   Phase 4: Products and Category Management
   ========================================================= */

const adminState = {
  products: [],
  categories: [],
  orders: [],
  enquiries: [],
  customers: [],
  editingProductId: null,
  editingCategoryId: null
};

function getSupabaseClient() {
  const client = window.kyloSupabase || window.supabaseClient || window.supabase;

  if (!client || typeof client.auth?.getSession !== "function") {
    throw new Error("Supabase is not ready. Check the script loading order.");
  }

  return client;
}

async function getAdminToken() {
  const { data: { session }, error } =
    await getSupabaseClient().auth.getSession();

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
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ action, ...payload })
  });

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error("The server returned an invalid response.");
  }

  if (!response.ok || !result.success) {
    throw new Error(result.error || "Administrator request failed.");
  }

  return result.data;
}

/* ---------------- ACCESS ---------------- */

async function checkAdminAccess() {
  const client = getSupabaseClient();
  const { data: { session }, error: sessionError } =
    await client.auth.getSession();

  if (sessionError) throw sessionError;

  if (!session) {
    window.location.href = "auth.html?redirect=admin.html";
    return false;
  }

  const { data: profile, error } = await client
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", session.user.id)
    .single();

  if (error || !profile || profile.role !== "admin") {
    alert("Administrator access required.");
    window.location.href = "index.html";
    return false;
  }

  const name = document.getElementById("adminName");
  if (name) {
    name.textContent = profile.full_name || session.user.email || "Administrator";
  }

  return true;
}

/* ---------------- UTILITIES ---------------- */

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value ?? 0;
}

function setInputValue(id, value) {
  const element = document.getElementById(id);
  if (element) element.value = value ?? "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function capitalize(value) {
  const text = String(value ?? "");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleDateString("en-ZW", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") {
    return "Quote";
  }

  const number = Number(value);
  return Number.isFinite(number) ? `$${number.toFixed(2)}` : "Quote";
}

function showAdminMessage(message, isError = false) {
  let element = document.getElementById("adminPhase4Message");

  if (!element) {
    element = document.createElement("div");
    element.id = "adminPhase4Message";
    element.setAttribute("role", "status");
    element.style.cssText =
      "margin:12px 0;padding:12px;border-radius:8px;border:1px solid #ccc;";
    const main = document.querySelector("main") || document.body;
    main.prepend(element);
  }

  element.textContent = message;
  element.style.color = isError ? "#b42318" : "inherit";
}

/* ---------------- DASHBOARD STATS ---------------- */

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

/* ---------------- CATEGORIES ---------------- */

async function loadCategories() {
  const data = await adminRequest("get_categories");
  adminState.categories = Array.isArray(data) ? data : [];

  renderCategorySelect();
  renderCategoryManager();
}

function renderCategorySelect() {
  const select = document.getElementById("productCategory");
  if (!select) return;

  const previousValue = select.value;
  select.replaceChildren();

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Select category";
  select.appendChild(placeholder);

  adminState.categories
    .filter(category => category.is_active || category.id === previousValue)
    .forEach(category => {
      const option = document.createElement("option");
      option.value = category.id;
      option.textContent = category.name;
      select.appendChild(option);
    });

  if (previousValue) select.value = previousValue;
}

function ensureCategoryManager() {
  let panel = document.getElementById("categoryManager");
  if (panel) return panel;

  panel = document.createElement("section");
  panel.id = "categoryManager";
  panel.className = "dashboard-card";
  panel.style.marginTop = "24px";
  panel.innerHTML = `
    <h2>Category Management</h2>
    <p>Add or update categories used by your product catalogue.</p>
    <form id="categoryForm">
      <label for="categoryName">Category name</label>
      <input id="categoryName" maxlength="150" required
        placeholder="e.g. Poultry Production">

      <label for="categoryDescription">Description</label>
      <textarea id="categoryDescription" maxlength="2000"
        placeholder="Describe this category"></textarea>

      <label for="categoryImage">Image URL (optional)</label>
      <input id="categoryImage" type="url" maxlength="1000"
        placeholder="https://...">

      <label>
        <input id="categoryActive" type="checkbox" checked>
        Category is active
      </label>

      <div class="admin-actions">
        <button id="saveCategoryButton" class="btn" type="submit">
          Save Category
        </button>
        <button id="resetCategoryButton" class="btn btn-outline" type="button">
          Clear
        </button>
      </div>
    </form>
    <div style="overflow-x:auto;margin-top:20px">
      <table>
        <thead>
          <tr><th>Name</th><th>Slug</th><th>Status</th><th>Actions</th></tr>
        </thead>
        <tbody id="categoriesTableBody">
          <tr><td colspan="4">Loading categories...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  const productForm = document.getElementById("productForm");
  const parent = productForm?.parentElement ||
    document.querySelector("main") || document.body;

  parent.appendChild(panel);

  panel.querySelector("#categoryForm").addEventListener(
    "submit",
    saveCategory
  );

  panel.querySelector("#resetCategoryButton").addEventListener(
    "click",
    resetCategoryForm
  );

  return panel;
}

function renderCategoryManager() {
  ensureCategoryManager();

  const tbody = document.getElementById("categoriesTableBody");
  if (!tbody) return;

  if (!adminState.categories.length) {
    tbody.innerHTML = `<tr><td colspan="4">No categories yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = adminState.categories.map(category => `
    <tr>
      <td>${escapeHtml(category.name)}</td>
      <td>${escapeHtml(category.slug)}</td>
      <td>${category.is_active ? "Active" : "Inactive"}</td>
      <td>
        <button type="button" class="btn btn-small"
          data-edit-category="${escapeHtml(category.id)}">
          Edit
        </button>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll("[data-edit-category]").forEach(button => {
    button.addEventListener("click", () => {
      editCategory(button.dataset.editCategory);
    });
  });
}

function resetCategoryForm() {
  adminState.editingCategoryId = null;

  document.getElementById("categoryForm")?.reset();

  const active = document.getElementById("categoryActive");
  if (active) active.checked = true;

  const button = document.getElementById("saveCategoryButton");
  if (button) button.textContent = "Save Category";
}

function editCategory(id) {
  const category = adminState.categories.find(item => item.id === id);
  if (!category) return;

  adminState.editingCategoryId = id;
  setInputValue("categoryName", category.name);
  setInputValue("categoryDescription", category.description);
  setInputValue("categoryImage", category.image_url);

  const active = document.getElementById("categoryActive");
  if (active) active.checked = Boolean(category.is_active);

  const button = document.getElementById("saveCategoryButton");
  if (button) button.textContent = "Update Category";

  document.getElementById("categoryManager")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

async function saveCategory(event) {
  event.preventDefault();

  const button = document.getElementById("saveCategoryButton");
  if (button) {
    button.disabled = true;
    button.textContent = "Saving...";
  }

  try {
    const category = {
      id: adminState.editingCategoryId || undefined,
      name: document.getElementById("categoryName").value.trim(),
      description: document.getElementById("categoryDescription").value.trim(),
      image_url: document.getElementById("categoryImage").value.trim(),
      is_active: document.getElementById("categoryActive").checked
    };

    await adminRequest(
      adminState.editingCategoryId ? "update_category" : "create_category",
      { category }
    );

    await loadCategories();
    resetCategoryForm();
    showAdminMessage("Category saved successfully.");
  } catch (error) {
    console.error("Category save failed:", error);
    showAdminMessage(error.message, true);
  } finally {
    if (button) button.disabled = false;
    if (button && !adminState.editingCategoryId) {
      button.textContent = "Save Category";
    }
  }
}

/* ---------------- PRODUCTS ---------------- */

async function loadProducts() {
  const data = await adminRequest("get_products");
  adminState.products = Array.isArray(data) ? data : [];
  renderProducts();
}

function renderProducts() {
  const tbody = document.getElementById("productsTableBody");
  if (!tbody) return;

  const search = (
    document.getElementById("productSearch")?.value || ""
  ).toLowerCase().trim();

  const filtered = adminState.products.filter(product => {
    const text = [
      product.name,
      product.slug,
      product.description,
      product.short_description,
      product.categories?.name
    ].join(" ").toLowerCase();

    return text.includes(search);
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8">No products found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(product => `
    <tr>
      <td>
        <strong>${escapeHtml(product.name)}</strong>
        <small>${escapeHtml(product.slug || "")}</small>
      </td>
      <td>${escapeHtml(product.categories?.name || "—")}</td>
      <td>${product.quote_only ? "Quote" : formatCurrency(product.price)}</td>
      <td>${Number(product.stock_quantity || 0)}</td>
      <td>${product.is_active ? "Active" : "Inactive"}</td>
      <td>${escapeHtml(product.unit || "—")}</td>
      <td>${formatDate(product.created_at)}</td>
      <td>
        <div class="admin-actions">
          <button type="button" class="btn btn-small"
            data-edit-product="${escapeHtml(product.id)}">Edit</button>
          <button type="button" class="btn btn-small"
            data-toggle-product="${escapeHtml(product.id)}"
            data-next-active="${String(!product.is_active)}">
            ${product.is_active ? "Disable" : "Enable"}
          </button>
        </div>
      </td>
    </tr>
  `).join("");

  tbody.querySelectorAll("[data-edit-product]").forEach(button => {
    button.addEventListener("click", () => editProduct(button.dataset.editProduct));
  });

  tbody.querySelectorAll("[data-toggle-product]").forEach(button => {
    button.addEventListener("click", () => {
      toggleProduct(
        button.dataset.toggleProduct,
        button.dataset.nextActive === "true"
      );
    });
  });
}

function resetProductForm() {
  adminState.editingProductId = null;
  document.getElementById("productForm")?.reset();

  const active = document.getElementById("productActive");
  if (active) active.checked = true;

  const quote = document.getElementById("productQuoteOnly");
  if (quote) quote.checked = true;

  const title = document.getElementById("productFormTitle");
  if (title) title.textContent = "Add Product";

  const button = document.querySelector("#productForm button[type='submit']");
  if (button) button.textContent = "Save Product";

  const sku = document.getElementById("productSku");
  if (sku) {
    const label = sku.closest("label");
    if (label) label.hidden = true;
    sku.hidden = true;
    sku.disabled = true;
  }
}

function editProduct(id) {
  const product = adminState.products.find(item => item.id === id);
  if (!product) return;

  adminState.editingProductId = id;

  setInputValue("productName", product.name);
  setInputValue("productCategory", product.category_id);
  setInputValue("productDescription", product.description);
  setInputValue("productPrice", product.price ?? "");
  setInputValue("productUnit", product.unit);
  setInputValue("productStock", product.stock_quantity ?? 0);
  setInputValue("productImage", product.image_url);

  const quote = document.getElementById("productQuoteOnly");
  if (quote) quote.checked = Boolean(product.quote_only);

  const active = document.getElementById("productActive");
  if (active) active.checked = Boolean(product.is_active);

  const title = document.getElementById("productFormTitle");
  if (title) title.textContent = "Edit Product";

  const button = document.querySelector("#productForm button[type='submit']");
  if (button) button.textContent = "Update Product";

  document.getElementById("productForm")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

async function saveProduct(event) {
  event.preventDefault();

  const button = document.querySelector("#productForm button[type='submit']");
  if (button) {
    button.disabled = true;
    button.textContent = "Saving...";
  }

  try {
    const name = document.getElementById("productName")?.value.trim() || "";
    const priceInput = document.getElementById("productPrice")?.value ?? "";
    const stockInput = document.getElementById("productStock")?.value ?? "0";

    const product = {
      name,
      category_id: document.getElementById("productCategory")?.value || null,
      short_description: "",
      description: document.getElementById("productDescription")?.value.trim() || "",
      price: priceInput === "" ? null : Number(priceInput),
      unit: document.getElementById("productUnit")?.value.trim() || "",
      stock_quantity: Number(stockInput),
      image_url: document.getElementById("productImage")?.value.trim() || "",
      quote_only: document.getElementById("productQuoteOnly")?.checked ?? true,
      is_active: document.getElementById("productActive")?.checked ?? true
    };

    if (!product.name) throw new Error("Product name is required.");
    if (priceInput !== "" && (!Number.isFinite(product.price) || product.price < 0)) {
      throw new Error("Enter a valid non-negative price.");
    }
    if (!Number.isInteger(product.stock_quantity) || product.stock_quantity < 0) {
      throw new Error("Stock must be a non-negative whole number.");
    }
    if (!product.quote_only && product.price === null) {
      throw new Error("Enter a price or enable quotation-only mode.");
    }

    if (adminState.editingProductId) {
      product.id = adminState.editingProductId;
      await adminRequest("update_product", { product });
    } else {
      await adminRequest("create_product", { product });
    }

    resetProductForm();
    await Promise.all([loadProducts(), loadDashboardStats()]);
    showAdminMessage("Product saved successfully.");
  } catch (error) {
    console.error("Product save failed:", error);
    showAdminMessage(error.message, true);
  } finally {
    if (button) button.disabled = false;
    if (button) {
      button.textContent = adminState.editingProductId
        ? "Update Product"
        : "Save Product";
    }
  }
}

async function toggleProduct(id, isActive) {
  const action = isActive ? "enable" : "disable";

  if (!confirm(`Are you sure you want to ${action} this product?`)) return;

  try {
    await adminRequest("toggle_product", {
      product: { id, is_active: isActive }
    });

    await Promise.all([loadProducts(), loadDashboardStats()]);
    showAdminMessage(`Product ${isActive ? "enabled" : "disabled"}.`);
  } catch (error) {
    console.error(error);
    showAdminMessage(error.message, true);
  }
}

/* ---------------- ORDERS ---------------- */

async function loadOrders() {
  adminState.orders = await adminRequest("get_orders") || [];
  renderOrders();
}

function orderStatusOptions(current) {
  return ["pending", "confirmed", "processing", "ready", "completed", "cancelled"]
    .map(status => `<option value="${status}" ${status === current ? "selected" : ""}>${capitalize(status)}</option>`)
    .join("");
}

function renderOrders() {
  const tbody = document.getElementById("ordersTableBody");
  if (!tbody) return;

  const search = (document.getElementById("orderSearch")?.value || "").toLowerCase().trim();
  const statusFilter = document.getElementById("orderStatusFilter")?.value || "";

  const filtered = adminState.orders.filter(order => {
    const text = [order.id, order.user_id, order.fulfilment_method, order.customer_note]
      .join(" ").toLowerCase();

    return text.includes(search) && (!statusFilter || order.status === statusFilter);
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8">No orders found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(order => `
    <tr>
      <td><strong>${escapeHtml(String(order.id).slice(0, 8))}</strong></td>
      <td>${formatCurrency(order.total)}</td>
      <td>${escapeHtml(order.fulfilment_method || "collection")}</td>
      <td>${escapeHtml(order.payment_status || "pending")}</td>
      <td><select data-order-status="${escapeHtml(order.id)}">${orderStatusOptions(order.status)}</select></td>
      <td>${formatDate(order.created_at)}</td>
      <td>${order.order_items?.length || 0}</td>
      <td>${escapeHtml(order.customer_note || "—")}</td>
    </tr>
  `).join("");

  tbody.querySelectorAll("[data-order-status]").forEach(select => {
    select.addEventListener("change", () => {
      changeOrderStatus(select.dataset.orderStatus, select.value);
    });
  });
}

async function changeOrderStatus(id, status) {
  try {
    await adminRequest("update_order_status", { order: { id, status } });
    await Promise.all([loadOrders(), loadDashboardStats()]);
  } catch (error) {
    showAdminMessage(error.message, true);
    await loadOrders();
  }
}

/* ---------------- ENQUIRIES ---------------- */

async function loadEnquiries() {
  adminState.enquiries = await adminRequest("get_enquiries") || [];
  renderEnquiries();
}

function enquiryStatusOptions(current) {
  return ["new", "contacted", "quoted", "converted", "closed"]
    .map(status => `<option value="${status}" ${status === current ? "selected" : ""}>${capitalize(status)}</option>`)
    .join("");
}

function renderEnquiries() {
  const tbody = document.getElementById("enquiriesTableBody");
  if (!tbody) return;

  const search = (document.getElementById("enquirySearch")?.value || "").toLowerCase().trim();
  const statusFilter = document.getElementById("enquiryStatusFilter")?.value || "";

  const filtered = adminState.enquiries.filter(enquiry => {
    const text = [enquiry.name, enquiry.email, enquiry.phone, enquiry.product, enquiry.location, enquiry.message]
      .join(" ").toLowerCase();

    return text.includes(search) && (!statusFilter || enquiry.status === statusFilter);
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8">No enquiries found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(enquiry => `
    <tr>
      <td>${escapeHtml(enquiry.name || "—")}</td>
      <td>${escapeHtml(enquiry.phone || "—")}</td>
      <td>${escapeHtml(enquiry.email || "—")}</td>
      <td>${escapeHtml(enquiry.product || "—")}</td>
      <td>${escapeHtml(enquiry.quantity || "—")}</td>
      <td><select data-enquiry-status="${escapeHtml(enquiry.id)}">${enquiryStatusOptions(enquiry.status)}</select></td>
      <td>${formatDate(enquiry.created_at)}</td>
      <td>${escapeHtml(enquiry.message || "—")}</td>
    </tr>
  `).join("");

  tbody.querySelectorAll("[data-enquiry-status]").forEach(select => {
    select.addEventListener("change", () => {
      changeEnquiryStatus(select.dataset.enquiryStatus, select.value);
    });
  });
}

async function changeEnquiryStatus(id, status) {
  try {
    await adminRequest("update_enquiry_status", { enquiry: { id, status } });
    await Promise.all([loadEnquiries(), loadDashboardStats()]);
  } catch (error) {
    showAdminMessage(error.message, true);
    await loadEnquiries();
  }
}

/* ---------------- CUSTOMERS ---------------- */

async function loadCustomers() {
  adminState.customers = await adminRequest("get_customers") || [];
  renderCustomers();
}

function renderCustomers() {
  const tbody = document.getElementById("customersTableBody");
  if (!tbody) return;

  const search = (document.getElementById("customerSearch")?.value || "").toLowerCase().trim();

  const filtered = adminState.customers.filter(customer =>
    [customer.full_name, customer.email, customer.phone].join(" ").toLowerCase().includes(search)
  );

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="6">No customers found.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(customer => `
    <tr>
      <td>${escapeHtml(customer.full_name || "—")}</td>
      <td>${escapeHtml(customer.email || "—")}</td>
      <td>${escapeHtml(customer.phone || "—")}</td>
      <td>${escapeHtml(customer.role || "customer")}</td>
      <td>${formatDate(customer.created_at)}</td>
      <td>${escapeHtml(customer.id)}</td>
    </tr>
  `).join("");
}

/* ---------------- EVENTS AND INITIALIZATION ---------------- */

function setupAdminEvents() {
  document.getElementById("productForm")?.addEventListener("submit", saveProduct);
  document.getElementById("productSearch")?.addEventListener("input", renderProducts);
  document.getElementById("orderSearch")?.addEventListener("input", renderOrders);
  document.getElementById("orderStatusFilter")?.addEventListener("change", renderOrders);
  document.getElementById("enquirySearch")?.addEventListener("input", renderEnquiries);
  document.getElementById("enquiryStatusFilter")?.addEventListener("change", renderEnquiries);
  document.getElementById("customerSearch")?.addEventListener("input", renderCustomers);
  document.getElementById("resetProductButton")?.addEventListener("click", resetProductForm);
  document.getElementById("logoutButton")?.addEventListener("click", logoutAdmin);

  const quote = document.getElementById("productQuoteOnly");
  const price = document.getElementById("productPrice");

  quote?.addEventListener("change", () => {
    if (price) {
      price.required = !quote.checked;
      price.disabled = quote.checked;
      if (quote.checked) price.value = "";
    }
  });
}

async function logoutAdmin() {
  await getSupabaseClient().auth.signOut();
  window.location.href = "auth.html";
}

async function initAdmin() {
  try {
    const allowed = await checkAdminAccess();
    if (!allowed) return;

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
    showAdminMessage(error.message || "Unable to load the administrator dashboard.", true);
  }
}

document.addEventListener("DOMContentLoaded", initAdmin);
