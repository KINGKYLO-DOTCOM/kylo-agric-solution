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

export async function handler(event) {

  if (event.httpMethod !== "GET") {
    return json(405, {
      error: "Method not allowed."
    });
  }

  try {

    const user = await verifyAdmin(event);

    const [
      productsResult,
      ordersResult,
      enquiriesResult,
      customersResult
    ] = await Promise.all([

      supabaseAdmin
        .from("products")
        .select("*")
        .order("name", { ascending: true }),

      supabaseAdmin
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),

      supabaseAdmin
        .from("enquiries")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),

      supabaseAdmin
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500)

    ]);

    if (productsResult.error) {
      throw new Error(
        `Products: ${productsResult.error.message}`
      );
    }

    if (ordersResult.error) {
      throw new Error(
        `Orders: ${ordersResult.error.message}`
      );
    }

    if (enquiriesResult.error) {
      throw new Error(
        `Enquiries: ${enquiriesResult.error.message}`
      );
    }

    if (customersResult.error) {
      throw new Error(
        `Customers: ${customersResult.error.message}`
      );
    }

    const products =
      productsResult.data || [];

    const orders =
      ordersResult.data || [];

    const enquiries =
      enquiriesResult.data || [];

    const customers =
      customersResult.data || [];

    /*
     * Retrieve order items separately.
     * This avoids relying on a particular
     * PostgREST relationship name.
     */

    let orderItems = [];

    const orderIds =
      orders.map(order => order.id);

    if (orderIds.length > 0) {

      const {
        data,
        error
      } = await supabaseAdmin
        .from("order_items")
        .select("*")
        .in("order_id", orderIds);

      if (error) {
        throw new Error(
          `Order items: ${error.message}`
        );
      }

      orderItems = data || [];
    }

    const itemsByOrder = {};

    for (const item of orderItems) {

      if (!itemsByOrder[item.order_id]) {
        itemsByOrder[item.order_id] = [];
      }

      itemsByOrder[item.order_id].push(item);
    }

    const ordersWithItems =
      orders.map(order => ({
        ...order,
        items:
          itemsByOrder[order.id] || []
      }));

    const statistics = {
      products: products.length,

      activeProducts:
        products.filter(
          product => product.is_active
        ).length,

      customers:
        customers.filter(
          customer => customer.role === "customer"
        ).length,

      orders: orders.length,

      pendingOrders:
        orders.filter(
          order => order.order_status === "pending"
        ).length,

      paidOrders:
        orders.filter(
          order => order.payment_status === "paid"
        ).length,

      enquiries: enquiries.length,

      newEnquiries:
        enquiries.filter(
          enquiry => enquiry.status === "new"
        ).length
    };

    return json(200, {
      success: true,

      admin: {
        id: user.id,
        email: user.email
      },

      statistics,

      products,

      orders: ordersWithItems,

      customers,

      enquiries
    });

  } catch (error) {

    console.error("Admin data error:", error);

    return json(403, {
      error:
        error.message ||
        "Unable to load administrator data."
    });
  }
}