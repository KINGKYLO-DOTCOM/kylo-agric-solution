import { createClient } from "@supabase/supabase-js";
import Paynow from "paynow";


const supabaseAdmin =
  createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );


export const handler = async (event) => {

  try {

    if (
      event.httpMethod !== "POST" &&
      event.httpMethod !== "GET"
    ) {

      return {
        statusCode: 405,
        body: "Method not allowed"
      };

    }


    let values = {};


    if (event.httpMethod === "POST") {

      const params =
        new URLSearchParams(
          event.body || ""
        );


      for (const [
        key,
        value
      ] of params.entries()) {

        values[key] = value;

      }

    } else {

      values = event.queryStringParameters || {};

    }


    console.log(
      "Paynow result received:",
      values
    );


    const reference =
      values.reference ||
      values.Reference ||
      "";


    if (!reference) {

      return {
        statusCode: 400,
        body: "Missing payment reference."
      };

    }


    const {
      data: order,
      error: orderError
    } = await supabaseAdmin

      .from("orders")

      .select("*")

      .eq("paynow_reference", reference)

      .single();


    if (orderError || !order) {

      return {
        statusCode: 404,
        body: "Order not found."
      };

    }


    const status =
      (
        values.status ||
        values.Status ||
        ""
      ).toString().toLowerCase();


    let paymentStatus =
      "pending";


    let orderStatus =
      "pending";


    if (
      status === "paid" ||
      status === "delivered"
    ) {

      paymentStatus =
        "paid";

      orderStatus =
        "confirmed";

    }


    else if (
      status === "cancelled" ||
      status === "cancelled by user"
    ) {

      paymentStatus =
        "cancelled";

    }


    else if (
      status === "failed"
    ) {

      paymentStatus =
        "failed";

    }


    await supabaseAdmin

      .from("orders")

      .update({

        payment_status:
          paymentStatus,

        status:
          orderStatus

      })

      .eq("id", order.id);


    return {

      statusCode: 200,

      body: "OK"

    };


  } catch (error) {

    console.error(
      "Paynow result error:",
      error
    );


    return {

      statusCode: 500,

      body: "Server error"

    };

  }

};