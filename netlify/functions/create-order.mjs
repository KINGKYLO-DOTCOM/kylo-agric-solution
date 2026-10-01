import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const admin = createClient(
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

export async function handler(event) {

  if (event.httpMethod !== "POST") {
    return json(405, {
      error: "Method not allowed."
    });
  }

  try {

    // ==================================================
    // AUTHENTICATION
    // ==================================================

    const authorization =
      event.headers.authorization ||
      event.headers.Authorization;

    if (!authorization) {
      return json(401, {
        error: "Authentication required."
      });
    }

    const token = authorization.replace(
      /^Bearer\s+/i,
      ""
    );

    if (!token) {
      return json(401, {
        error: "Invalid authentication token."
      });
    }

    const {
      data: { user },
      error: userError
    } = await admin.auth.getUser(token);

    if (userError || !user) {
      return json(401, {
        error: "Your session is invalid or has expired."
      });
    }

    // ==================================================
    // READ REQUEST
    // ==================================================

    let body;

    try {
      body = JSON.parse(event.body || "{}");
    } catch {
      return json(400, {
        error: "Invalid request."
      });
    }

    const items = Array.isArray(body.items)
      ? body.items
      : [];

    const fulfilmentMethod =
      body.fulfilment_method || "collection";

    const customerNote =
      typeof body.customer_note === "string"
        ? body.customer_note.trim().slice(0, 1000)
        : "";

    if (!items.length) {
      return json(400, {
        error: "Your cart is empty."
      });
    }

    // ==================================================
    // FULFILMENT VALIDATION
    // ==================================================

    if (
      !["collection", "delivery"].includes(
        fulfilmentMethod
      )
    ) {
      return json(400, {
        error: "Invalid fulfilment method."
      });
    }

    // ==================================================
    // CLEAN CART
    // ==================================================

    const quantityMap = new Map();

    for (const item of items) {

      const productId =
        String(item.product_id || "").trim();

      const quantity =
        Number(item.quantity);

      if (
        !productId ||
        !Number.isInteger(quantity) ||
        quantity <= 0 ||
        quantity > 10000
      ) {
        return json(400, {
          error: "Invalid cart item."
        });
      }

      const previous =
        quantityMap.get(productId) || 0;

      quantityMap.set(
        productId,
        previous + quantity
      );
    }

    const productIds =
      Array.from(quantityMap.keys());

    // ==================================================
    // GET PRODUCTS FROM SUPABASE
    // ==================================================

    const {
      data: products,
      error: productError
    } = await admin
      .from("products")
      .select(`
        id,
        name,
        slug,
        price,
        unit,
        stock_quantity,
        is_active,
        quote_only
      `)
      .in("id", productIds);

    if (productError) {
      console.error(productError);

      return json(500, {
        error: "Unable to verify products."
      });
    }

    if (
      !products ||
      products.length !== productIds.length
    ) {
      return json(400, {
        error:
          "One or more products are no longer available."
      });
    }

    // ==================================================
    // CALCULATE ORDER
    // ==================================================

    let subtotal = 0;

    const orderItems = [];

    for (const product of products) {

      const quantity =
        quantityMap.get(product.id);

      if (product.is_active !== true) {
        return json(400, {
          error:
            `${product.name} is currently unavailable.`
        });
      }

      if (
        product.quote_only === true ||
        product.price === null ||
        product.price === undefined
      ) {
        return json(400, {
          error:
            `${product.name} requires a quotation.`
        });
      }

      if (
        product.stock_quantity !== null &&
        quantity > Number(product.stock_quantity)
      ) {
        return json(400, {
          error:
            `Only ${product.stock_quantity} units of ${product.name} are available.`
        });
      }

      const unitPrice =
        Number(product.price);

      if (
        !Number.isFinite(unitPrice) ||
        unitPrice < 0
      ) {
        return json(400, {
          error:
            `Invalid price for ${product.name}.`
        });
      }

      const lineTotal =
        unitPrice * quantity;

      subtotal += lineTotal;

      orderItems.push({
        product_id: product.id,
        product_name: product.name,
        unit_price: unitPrice,
        quantity,
        line_total: lineTotal
      });
    }

    // ==================================================
    // DELIVERY
    // ==================================================

    /*
     * Delivery is currently manually calculated.
     *
     * Until an administrator assigns a delivery charge,
     * the initial order is created with a zero delivery fee.
     */

    const deliveryFee = 0;

    const total =
      subtotal + deliveryFee;

    // ==================================================
    // CREATE ORDER
    // ==================================================

    const {
      data: order,
      error: orderError
    } = await admin
      .from("orders")
      .insert({
        user_id: user.id,
        status: "pending",
        payment_status: "pending",
        subtotal,
        delivery_fee: deliveryFee,
        total,
        fulfilment_method: fulfilmentMethod,
        customer_note:
          customerNote || null
      })
      .select()
      .single();

    if (orderError) {
      console.error(orderError);

      return json(500, {
        error:
          "Unable to create your order."
      });
    }

    // ==================================================
    // CREATE ORDER ITEMS
    // ==================================================

    const databaseItems =
      orderItems.map(item => ({
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.product_name,
        unit_price: item.unit_price,
        quantity: item.quantity,
        line_total: item.line_total
      }));

    const {
      error: orderItemsError
    } = await admin
      .from("order_items")
      .insert(databaseItems);

    if (orderItemsError) {

      console.error(orderItemsError);

      await admin
        .from("orders")
        .delete()
        .eq("id", order.id);

      return json(500, {
        error:
          "Unable to save your order items."
      });
    }

    // ==================================================
    // SUCCESS
    // ==================================================

    return json(200, {
      success: true,

      order: {
        id: order.id,
        subtotal,
        delivery_fee: deliveryFee,
        total,
        fulfilment_method:
          fulfilmentMethod
      }
    });

  } catch (error) {

    console.error(
      "CREATE ORDER ERROR:",
      error
    );

    return json(500, {
      error:
        "An unexpected server error occurred."
    });
  }
}