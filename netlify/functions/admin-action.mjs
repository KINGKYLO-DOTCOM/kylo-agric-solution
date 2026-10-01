import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

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

function getToken(event) {
  const header =
    event.headers?.authorization ||
    event.headers?.Authorization ||
    "";

  if (!header.startsWith("Bearer ")) {
    return null;
  }

  return header.substring(7).trim();
}

async function verifyAdmin(event) {

  const token = getToken(event);

  if (!token) {
    throw new Error("Authentication required.");
  }

  const {
    data: userData,
    error: userError
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !userData?.user) {
    throw new Error("Invalid or expired session.");
  }

  const {
    data: profile,
    error: profileError
  } = await supabaseAdmin
    .from("profiles")
    .select("id, role")
    .eq("id", userData.user.id)
    .single();

  if (
    profileError ||
    !profile ||
    profile.role !== "admin"
  ) {
    throw new Error("Administrator access required.");
  }

  return userData.user;
}

function cleanText(value, maxLength = 5000) {

  if (value === null || value === undefined) {
    return "";
  }

  return String(value)
    .trim()
    .slice(0, maxLength);
}

function makeSlug(name) {

  return cleanText(name, 200)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function validNumber(value, defaultValue = 0) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return defaultValue;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error("Invalid numeric value.");
  }

  return number;
}

const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "ready",
  "completed",
  "cancelled"
];

const PAYMENT_STATUSES = [
  "pending",
  "paid",
  "failed",
  "refunded"
];

const ENQUIRY_STATUSES = [
  "new",
  "contacted",
  "quoted",
  "closed"
];

async function createProduct(product) {

  const name =
    cleanText(product.name, 200);

  if (!name) {
    throw new Error("Product name is required.");
  }

  const category =
    cleanText(product.category, 100);

  if (!category) {
    throw new Error("Product category is required.");
  }

  let slug =
    cleanText(product.slug, 200) ||
    makeSlug(name);

  if (!slug) {
    throw new Error("Product slug is required.");
  }

  const price =
    product.price === null ||
    product.price === undefined ||
    product.price === ""
      ? null
      : validNumber(product.price);

  if (price !== null && price < 0) {
    throw new Error("Price cannot be negative.");
  }

  const stock =
    validNumber(product.stock_quantity, 0);

  if (stock < 0) {
    throw new Error("Stock cannot be negative.");
  }

  const payload = {
    category,

    name,

    slug,

    description:
      cleanText(product.description, 1000) ||
      null,

    long_description:
      cleanText(product.long_description, 10000) ||
      null,

    price,

    unit:
      cleanText(product.unit, 100) ||
      "unit",

    image:
      cleanText(product.image, 500) ||
      null,

    stock_quantity: stock,

    quote_only:
      Boolean(product.quote_only),

    featured:
      Boolean(product.featured),

    is_active:
      Boolean(product.is_active)
  };

  const {
    data,
    error
  } = await supabaseAdmin
    .from("products")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function updateProduct(product) {

  if (!product.id) {
    throw new Error("Product ID is required.");
  }

  const name =
    cleanText(product.name, 200);

  if (!name) {
    throw new Error("Product name is required.");
  }

  const category =
    cleanText(product.category, 100);

  if (!category) {
    throw new Error("Product category is required.");
  }

  const slug =
    cleanText(product.slug, 200) ||
    makeSlug(name);

  const price =
    product.price === null ||
    product.price === undefined ||
    product.price === ""
      ? null
      : validNumber(product.price);

  if (price !== null && price < 0) {
    throw new Error("Price cannot be negative.");
  }

  const stock =
    validNumber(product.stock_quantity, 0);

  if (stock < 0) {
    throw new Error("Stock cannot be negative.");
  }

  const payload = {

    category,

    name,

    slug,

    description:
      cleanText(product.description, 1000) ||
      null,

    long_description:
      cleanText(product.long_description, 10000) ||
      null,

    price,

    unit:
      cleanText(product.unit, 100) ||
      "unit",

    image:
      cleanText(product.image, 500) ||
      null,

    stock_quantity: stock,

    quote_only:
      Boolean(product.quote_only),

    featured:
      Boolean(product.featured),

    is_active:
      Boolean(product.is_active)
  };

  const {
    data,
    error
  } = await supabaseAdmin
    .from("products")
    .update(payload)
    .eq("id", product.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function toggleProduct(id, isActive) {

  if (!id) {
    throw new Error("Product ID is required.");
  }

  const {
    error
  } = await supabaseAdmin
    .from("products")
    .update({
      is_active: Boolean(isActive)
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

async function updateOrderStatus(id, status) {

  if (!id) {
    throw new Error("Order ID is required.");
  }

  if (!ORDER_STATUSES.includes(status)) {
    throw new Error("Invalid order status.");
  }

  const {
    error
  } = await supabaseAdmin
    .from("orders")
    .update({
      order_status: status
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

async function updatePaymentStatus(id, status) {

  if (!id) {
    throw new Error("Order ID is required.");
  }

  if (!PAYMENT_STATUSES.includes(status)) {
    throw new Error("Invalid payment status.");
  }

  const {
    error
  } = await supabaseAdmin
    .from("orders")
    .update({
      payment_status: status
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

async function updateEnquiryStatus(id, status) {

  if (!id) {
    throw new Error("Enquiry ID is required.");
  }

  if (!ENQUIRY_STATUSES.includes(status)) {
    throw new Error("Invalid enquiry status.");
  }

  const {
    error
  } = await supabaseAdmin
    .from("enquiries")
    .update({
      status
    })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }
}

export async function handler(event) {

  if (event.httpMethod !== "POST") {
    return json(405, {
      error: "Method not allowed."
    });
  }

  try {

    await verifyAdmin(event);

    let body;

    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return json(400, {
        error: "Invalid JSON request."
      });
    }

    const action =
      cleanText(body.action, 100);

    switch (action) {

      case "create_product": {

        const product =
          await createProduct(body.product || {});

        return json(200, {
          success: true,
          message: "Product created successfully.",
          product
        });
      }

      case "update_product": {

        const product =
          await updateProduct(body.product || {});

        return json(200, {
          success: true,
          message: "Product updated successfully.",
          product
        });
      }

      case "toggle_product": {

        await toggleProduct(
          body.id,
          body.is_active
        );

        return json(200, {
          success: true,
          message: "Product status updated successfully."
        });
      }

      case "update_order_status": {

        await updateOrderStatus(
          body.id,
          body.status
        );

        return json(200, {
          success: true,
          message: "Order status updated successfully."
        });
      }

      case "update_payment_status": {

        await updatePaymentStatus(
          body.id,
          body.status
        );

        return json(200, {
          success: true,
          message: "Payment status updated successfully."
        });
      }

      case "update_enquiry_status": {

        await updateEnquiryStatus(
          body.id,
          body.status
        );

        return json(200, {
          success: true,
          message: "Enquiry status updated successfully."
        });
      }

      default:

        return json(400, {
          error: "Unknown administrator action."
        });
    }

  } catch (error) {

    console.error("Admin action error:", error);

    return json(403, {
      error:
        error.message ||
        "Administrator action failed."
    });
  }
}