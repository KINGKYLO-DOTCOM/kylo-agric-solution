import { createClient } from "@supabase/supabase-js";
import { Paynow } from "paynow";

const SUPABASE_URL =
  process.env.SUPABASE_URL;

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY;

const PAYNOW_INTEGRATION_ID =
  process.env.PAYNOW_INTEGRATION_ID;

const PAYNOW_INTEGRATION_KEY =
  process.env.PAYNOW_INTEGRATION_KEY;


const admin =
  createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );


function json(
  statusCode,
  body
) {

  return {

    statusCode,

    headers: {
      "Content-Type":
        "application/json",

      "Cache-Control":
        "no-store"
    },

    body:
      JSON.stringify(body)

  };

}


export async function handler(event) {

  // ==================================================
  // METHOD
  // ==================================================

  if (
    event.httpMethod !== "POST"
  ) {

    return json(
      405,
      {
        error:
          "Method not allowed."
      }
    );

  }


  try {

    // ==================================================
    // AUTHENTICATION
    // ==================================================

    const authorization =
      event.headers.authorization ||
      event.headers.Authorization;


    if (!authorization) {

      return json(
        401,
        {
          error:
            "Authentication required."
        }
      );

    }


    const token =
      authorization.replace(
        /^Bearer\s+/i,
        ""
      );


    const {
      data: {
        user
      },
      error: authError
    } =
      await admin.auth.getUser(
        token
      );


    if (
      authError ||
      !user
    ) {

      return json(
        401,
        {
          error:
            "Invalid or expired session."
        }
      );

    }


    // ==================================================
    // REQUEST
    // ==================================================

    let body;

    try {

      body =
        JSON.parse(
          event.body || "{}"
        );

    } catch {

      return json(
        400,
        {
          error:
            "Invalid request."
        }
      );

    }


    const orderId =
      body.orderId;


    if (!orderId) {

      return json(
        400,
        {
          error:
            "Order ID is required."
        }
      );

    }


    // ==================================================
    // GET ORDER
    // ==================================================

    const {
      data: order,
      error: orderError
    } =
      await admin
        .from("orders")
        .select(`
          id,
          user_id,
          total,
          status,
          payment_status,
          paynow_reference,
          paynow_poll_url
        `)
        .eq(
          "id",
          orderId
        )
        .single();


    if (
      orderError ||
      !order
    ) {

      return json(
        404,
        {
          error:
            "Order not found."
        }
      );

    }


    // ==================================================
    // OWNERSHIP
    // ==================================================

    if (
      order.user_id !==
      user.id
    ) {

      return json(
        403,
        {
          error:
            "You are not authorised to pay for this order."
        }
      );

    }


    // ==================================================
    // ALREADY PAID
    // ==================================================

    if (
      order.payment_status ===
      "paid"
    ) {

      return json(
        400,
        {
          error:
            "This order has already been paid."
        }
      );

    }


    // ==================================================
    // GET ORDER ITEMS
    // ==================================================

    const {
      data: items,
      error: itemsError
    } =
      await admin
        .from("order_items")
        .select(`
          product_name,
          quantity,
          unit_price,
          line_total
        `)
        .eq(
          "order_id",
          order.id
        );


    if (
      itemsError ||
      !items ||
      !items.length
    ) {

      return json(
        400,
        {
          error:
            "This order has no items."
        }
      );

    }


    // ==================================================
    // RECALCULATE
    // ==================================================

    let subtotal = 0;


    for (
      const item of items
    ) {

      const quantity =
        Number(item.quantity);


      const unitPrice =
        Number(item.unit_price);


      if (
        !Number.isFinite(
          quantity
        ) ||
        quantity <= 0 ||
        !Number.isFinite(
          unitPrice
        ) ||
        unitPrice < 0
      ) {

        return json(
          400,
          {
            error:
              "Invalid order item."
          }
        );

      }


      subtotal +=
        quantity *
        unitPrice;

    }


    const storedTotal =
      Number(order.total);


    if (
      !Number.isFinite(
        storedTotal
      ) ||
      storedTotal <= 0
    ) {

      return json(
        400,
        {
          error:
            "Invalid order total."
        }
      );

    }


    /*
     * The difference between the stored
     * total and item subtotal is treated
     * as the delivery fee.
     */

    const deliveryFee =
      storedTotal -
      subtotal;


    if (
      deliveryFee < 0
    ) {

      return json(
        400,
        {
          error:
            "Invalid delivery fee."
        }
      );

    }


    const calculatedTotal =
      subtotal +
      deliveryFee;


    if (
      Math.abs(
        calculatedTotal -
        storedTotal
      ) > 0.01
    ) {

      return json(
        400,
        {
          error:
            "Order total verification failed."
        }
      );

    }


    // ==================================================
    // CHECK PAYNOW CONFIG
    // ==================================================

    if (
      !PAYNOW_INTEGRATION_ID ||
      !PAYNOW_INTEGRATION_KEY
    ) {

      console.error(
        "Paynow environment variables are missing."
      );

      return json(
        500,
        {
          error:
            "Payment system is not configured."
        }
      );

    }


    // ==================================================
    // INITIALISE PAYNOW
    // ==================================================

    const paynow =
      new Paynow(
        PAYNOW_INTEGRATION_ID,
        PAYNOW_INTEGRATION_KEY
      );


    /*
     * Netlify automatically supplies URL
     * for the deployed site.
     */

    const siteUrl =
      process.env.URL ||
      "https://kyloagricsolutions.com";


    paynow.resultUrl =
      `${siteUrl}/api/paynow-result`;


    paynow.returnUrl =
      `${siteUrl}/payment-success.html?order=${encodeURIComponent(
        order.id
      )}`;


    // ==================================================
    // CREATE PAYMENT
    // ==================================================

    const payment =
      paynow.createPayment(
        `KYLO-${order.id}`,
        user.email ||
        "customer"
      );


    payment.add(
      "KYLO Agric Solution Order",
      storedTotal
    );


    // ==================================================
    // SEND TO PAYNOW
    // ==================================================

    const result =
      await paynow.send(
        payment
      );


    if (
      !result.success
    ) {

      console.error(
        "PAYNOW ERROR:",
        result
      );

      return json(
        502,
        {
          error:
            "Paynow could not create the payment."
        }
      );

    }


    // ==================================================
    // SAVE PAYMENT REFERENCE
    // ==================================================

    const {
      error: updateError
    } =
      await admin
        .from("orders")
        .update({
          paynow_reference:
            result.reference,

          paynow_poll_url:
            result.pollUrl
        })
        .eq(
          "id",
          order.id
        );


    if (updateError) {

      console.error(
        updateError
      );

      return json(
        500,
        {
          error:
            "Payment was created but the order could not be updated."
        }
      );

    }


    // ==================================================
    // SUCCESS
    // ==================================================

    return json(
      200,
      {
        success: true,

        redirectUrl:
          result.redirectUrl,

        reference:
          result.reference
      }
    );


  } catch (error) {

    console.error(
      "PAYNOW CREATE ERROR:",
      error
    );


    return json(
      500,
      {
        error:
          "Unable to initialise payment."
      }
    );

  }

}