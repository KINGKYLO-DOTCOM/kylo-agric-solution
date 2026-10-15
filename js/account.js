
document.addEventListener("DOMContentLoaded", async () => {
  const supabase = window.kyloSupabase;

  const heading = document.getElementById("accountTitle");
  const emailEl = document.getElementById("accountEmail");
  const nameEl = document.getElementById("accountName");
  const phoneEl = document.getElementById("accountPhone");
  const ordersMount = document.getElementById("ordersMount");
  const adminLink = document.getElementById("adminLink");

  function showError(message) {
    if (ordersMount) {
      ordersMount.textContent = message;
    }
    console.error("KYLO account:", message);
  }

  if (!supabase) {
    showError("Supabase did not initialise. Check js/config.js and js/supabase.js.");
    return;
  }

  try {
    const {
      data: { session },
      error: sessionError
    } = await supabase.auth.getSession();

    if (sessionError) throw sessionError;

    if (!session) {
      location.href = "auth.html?next=account.html";
      return;
    }

    if (emailEl) {
      emailEl.textContent = session.user.email || "";
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, phone, role")
      .eq("id", session.user.id)
      .maybeSingle();

    if (profileError) {
      console.error("KYLO profile query failed:", profileError);
      showError(
        "Could not read your profile. Check the profiles table permissions and Row Level Security."
      );
      return;
    }

    if (!profile) {
      showError(
        "No profile row matches your signed-in user ID. Check public.profiles against Authentication → Users."
      );
      return;
    }

    const isAdmin = profile.role === "admin";

    if (heading) {
      heading.textContent = isAdmin
        ? "Administrator dashboard"
        : "Customer dashboard";
    }

    if (nameEl) {
      nameEl.textContent =
        profile.full_name ||
        session.user.user_metadata?.full_name ||
        "Account holder";
    }

    if (phoneEl) {
      phoneEl.textContent =
        profile.phone ||
        session.user.user_metadata?.phone ||
        "";
    }

    if (adminLink) {
      adminLink.hidden = !isAdmin;
      adminLink.textContent = "Open Admin Dashboard";
    }

    const { data: orders, error: ordersError } = await supabase
      .from("orders")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    if (ordersError) {
      console.error("KYLO orders query failed:", ordersError);
      if (ordersMount) {
        ordersMount.textContent =
          "Your profile loaded, but orders could not be loaded.";
      }
      return;
    }

    if (ordersMount) {
      ordersMount.innerHTML = orders?.length
        ? orders.map(order => `
            <div class="order-card">
              <div>
                <strong>Order ${String(order.id).slice(0, 8).toUpperCase()}</strong>
                <span>${order.created_at
                  ? new Date(order.created_at).toLocaleDateString()
                  : ""}</span>
              </div>
              <div>
                <span>Status</span>
                <strong>${escapeHTML(order.order_status || "Pending")}</strong>
              </div>
              <div>
                <span>Payment</span>
                <strong>${escapeHTML(order.payment_status || "Pending")}</strong>
              </div>
              <div>
                <span>Total</span>
                <strong>${money(order.total)}</strong>
              </div>
            </div>
          `).join("")
        : `<div class="empty-state">
             <h3>No orders yet</h3>
             <p>Your orders will appear here.</p>
           </div>`;
    }

    console.info("KYLO account loaded. Role:", profile.role);
  } catch (error) {
    console.error("KYLO account initialisation failed:", error);
    showError(error?.message || "An unexpected account error occurred.");
  }
});
