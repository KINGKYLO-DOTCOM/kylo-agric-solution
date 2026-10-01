import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "ready",
  "completed",
  "cancelled"
];

const ENQUIRY_STATUSES = [
  "new",
  "contacted",
  "quoted",
  "converted",
  "closed"
];

function json(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    },
    body: JSON.stringify(body)
  };
}

function getBearerToken(event) {
  const header =
    event.headers?.authorization ||
    event.headers?.Authorization ||
    "";

  if (!header.startsWith("Bearer ")) {
    return null;
  }

  return header.substring(7).trim();
}

async function getAuthenticatedAdmin(event) {
  const token = getBearerToken(event);

  if (!token) {
    throw new Error("Missing authentication token.");
  }

  const {
    data: { user },
    error: userError
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    throw new Error("Invalid or expired authentication session.");
  }

  const { data: profile, error: profileError } =
    await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone, role")
      .eq("id", user.id)
      .single();

  if (profileError || !profile) {
    throw new Error("Administrator profile was not found.");
  }

  if (profile.role !== "admin") {
    throw new Error("Administrator access required.");
  }

  return {
    user,
    profile
  };
}

function cleanString(value, maxLength = 5000) {
  if (value === undefined || value === null) {
    return "";
  }

  return String(value).trim().slice(0, maxLength);
}

function cleanNumber(value, fallback = null) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return number;
}

function cleanBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "true" || value === 1 || value === "1") {
    return true;
  }

  if (value === "false" || value === 0 || value === "0") {
    return false;
  }

  return fallback;
}

function validateProductInput(input) {
  const name = cleanString(input.name, 150);

  if (!name) {
    throw new Error("Product name is required.");
  }

  const price =
    input.price === "" ||
    input.price === null ||
    input.price === undefined
      ? null
      : cleanNumber(input.price);

  if (price !== null && price < 0) {
    throw new Error("Product price cannot be negative.");
  }

  const stockQuantity = cleanNumber(
    input.stock_quantity,
    0
  );

  if (stockQuantity < 0) {
    throw new Error("Stock quantity cannot be negative.");
  }

  return {
    name,
    category_id: cleanString(input.category_id, 100) || null,
    description: cleanString(input.description, 5000),
    price,
    unit: cleanString(input.unit, 100),
    stock_quantity: stockQuantity,
    image_url: cleanString(input.image_url, 1000),
    sku: cleanString(input.sku, 100),
    quote_only: cleanBoolean(input.quote_only, true),
    is_active: cleanBoolean(input.is_active, true)
  };
}

/* ----------------------------- DASHBOARD ----------------------------- */

async function dashboard() {
  const [
    productsResult,
    activeProductsResult,
    ordersResult,
    pendingOrdersResult,
    enquiriesResult,
    pendingEnquiriesResult,
    customersResult
  ] = await Promise.all([
    supabaseAdmin
      .from("products")
      .select("id", { count: "exact", head: true }),

    supabaseAdmin
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true),

    supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true }),

    supabaseAdmin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),

    supabaseAdmin
      .from("enquiries")
      .select("id", { count: "exact", head: true }),

    supabaseAdmin
      .from("enquiries")
      .select("id", { count: "exact", head: true })
      .in("status", ["new", "contacted"]),

    supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("role", "customer")
  ]);

  const errors = [
    productsResult.error,
    activeProductsResult.error,
    ordersResult.error,
    pendingOrdersResult.error,
    enquiriesResult.error,
    pendingEnquiriesResult.error,
    customersResult.error
  ].filter(Boolean);

  if (errors.length) {
    throw new Error(errors[0].message);
  }

  const { count: lowStockCount, error: lowStockError } =
    await supabaseAdmin
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true)
      .lte("stock_quantity", 10);

  if (lowStockError) {
    throw new Error(lowStockError.message);
  }

  return {
    totalProducts: productsResult.count || 0,
    activeProducts: activeProductsResult.count || 0,
    totalOrders: ordersResult.count || 0,
    pendingOrders: pendingOrdersResult.count || 0,
    enquiries: enquiriesResult.count || 0,
    pendingEnquiries: pendingEnquiriesResult.count || 0,
    customers: customersResult.count || 0,
    lowStock: lowStockCount || 0
  };
}

/* ----------------------------- PRODUCTS ----------------------------- */

async function getProducts() {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select(`
      *,
      categories (
        id,
        name,
        slug
      )
    `)
    .order("created_at", {
      ascending: false
    });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

async function createProduct(input) {
  const product = validateProductInput(input);

  const { data, error } = await supabaseAdmin
    .from("products")
    .insert(product)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function updateProduct(input) {
  const id = cleanString(input.id, 100);

  if (!id) {
    throw new Error("Product ID is required.");
  }

  const product = validateProductInput(input);

  const { data, error } = await supabaseAdmin
    .from("products")
    .update(product)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function toggleProduct(input) {
  const id = cleanString(input.id, 100);

  if (!id) {
    throw new Error("Product ID is required.");
  }

  const isActive = cleanBoolean(
    input.is_active,
    false
  );

  const { data, error } = await supabaseAdmin
    .from("products")
    .update({
      is_active: isActive
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/* ----------------------------- ORDERS ----------------------------- */

async function getOrders() {
  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(`
      *,
      order_items (
        id,
        product_id,
        quantity,
        unit_price,
        line_total,
        products (
          id,
          name,
          sku
        )
      )
    `)
    .order("created_at", {
      ascending: false
    });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

async function updateOrderStatus(input) {
  const id = cleanString(input.id, 100);
  const status = cleanString(input.status, 50);

  if (!id) {
    throw new Error("Order ID is required.");
  }

  if (!ORDER_STATUSES.includes(status)) {
    throw new Error("Invalid order status.");
  }

  const { data, error } = await supabaseAdmin
    .from("orders")
    .update({
      status
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/* ----------------------------- ENQUIRIES ----------------------------- */

async function getEnquiries() {
  const { data, error } = await supabaseAdmin
    .from("enquiries")
    .select("*")
    .order("created_at", {
      ascending: false
    });

  if (error) {
    throw new Error(error.message);
  }

  return data || [];
}

async function updateEnquiryStatus(input) {
  const id = cleanString(input.id, 100);
  const status = cleanString(input.status, 50);

  if (!id) {
    throw new Error("Enquiry ID is required.");
  }

  if (!ENQUIRY_STATUSES.includes(status)) {
    throw new Error("Invalid enquiry status.");
  }

  const { data, error } = await supabaseAdmin
    .from("enquiries")
    .update({
      status
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

/* ----------------------------- CUSTOMERS ----------------------------- */

async function getAllAuthUsers() {
  const users = [];
  let page = 1;

  while (true) {
    const {
      data,
      error
    } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage: 1000
    });

    if (error) {
      throw new Error(error.message);
    }

    const batch = data?.users || [];

    users.push(...batch);

    if (batch.length < 1000) {
      break;
    }

    page++;
  }

  return users;
}

async function getCustomers() {
  const [
    authUsers,
    profilesResult
  ] = await Promise.all([
    getAllAuthUsers(),

    supabaseAdmin
      .from("profiles")
      .select(`
        id,
        full_name,
        phone,
        role,
        created_at
      `)
      .order("created_at", {
        ascending: false
      })
  ]);

  if (profilesResult.error) {
    throw new Error(profilesResult.error.message);
  }

  const profileMap = new Map(
    (profilesResult.data || []).map(profile => [
      profile.id,
      profile
    ])
  );

  return authUsers
    .map(user => {
      const profile = profileMap.get(user.id);

      return {
        id: user.id,
        email: user.email || "",
        full_name: profile?.full_name || "",
        phone: profile?.phone || "",
        role: profile?.role || "customer",
        created_at:
          profile?.created_at ||
          user.created_at
      };
    })
    .filter(customer => customer.role === "customer");
}

/* ----------------------------- MAIN HANDLER ----------------------------- */

export const handler = async event => {
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Cache-Control": "no-store"
      },
      body: ""
    };
  }

  if (event.httpMethod !== "POST") {
    return json(405, {
      success: false,
      error: "Method not allowed."
    });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(500, {
      success: false,
      error: "Server configuration is incomplete."
    });
  }

  try {
    await getAuthenticatedAdmin(event);

    let body = {};

    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return json(400, {
        success: false,
        error: "Invalid JSON request."
      });
    }

    const action = cleanString(body.action, 100);

    if (!action) {
      return json(400, {
        success: false,
        error: "No admin action was supplied."
      });
    }

    let result;

    switch (action) {
      case "dashboard":
        result = await dashboard();
        break;

      case "get_products":
        result = await getProducts();
        break;

      case "create_product":
        result = await createProduct(body.product || {});
        break;

      case "update_product":
        result = await updateProduct(body.product || {});
        break;

      case "toggle_product":
        result = await toggleProduct(body.product || {});
        break;

      case "get_orders":
        result = await getOrders();
        break;

      case "update_order_status":
        result = await updateOrderStatus(body.order || {});
        break;

      case "get_enquiries":
        result = await getEnquiries();
        break;

      case "update_enquiry_status":
        result = await updateEnquiryStatus(body.enquiry || {});
        break;

      case "get_customers":
        result = await getCustomers();
        break;

      default:
        return json(400, {
          success: false,
          error: "Unknown admin action."
        });
    }

    return json(200, {
      success: true,
      data: result
    });

  } catch (error) {
    console.error("Admin API error:", error);

    const message =
      error?.message ||
      "An unexpected server error occurred.";

    if (
      message.includes("Administrator access required") ||
      message.includes("Invalid or expired") ||
      message.includes("Missing authentication")
    ) {
      return json(401, {
        success: false,
        error: message
      });
    }

    return json(400, {
      success: false,
      error: message
    });
  }
};