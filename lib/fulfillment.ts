import { db } from "./db";
import { mobileNumber, sendTemplate } from "./sms";

export async function advanceFulfillment(id: string, change: { event: "confirm" } | { event: "ship"; trackingCode: string }) {
  if (change.event === "ship" && (!change.trackingCode || change.trackingCode.length > 25)) {
    throw new Error("کد رهگیری باید بین ۱ تا ۲۵ نویسه باشد.");
  }

  const confirming = change.event === "confirm";
  const { rows: [updated] } = await db().query<{ mobile: string }>(`
    UPDATE orders SET fulfillment_status=$1, tracking_code=$2
    WHERE id=$3 AND status='paid' AND fulfillment_status=$4
    RETURNING COALESCE((SELECT mobile FROM customers WHERE customers.id=orders.customer_id), customer::jsonb->>'mobile') AS mobile
  `, [
    confirming ? "awaiting_shipment" : "shipped",
    change.event === "ship" ? change.trackingCode : null,
    id,
    confirming ? "awaiting_confirmation" : "awaiting_shipment",
  ]);
  if (!updated) return "unchanged";

  try {
    const mobile = mobileNumber(updated.mobile);
    if (change.event === "confirm") {
      await sendTemplate(mobile, 868696, [{ name: "TOKEN", value: ` شماره سفارش: ${id.slice(0,8)}` }]);
    } else {
      await sendTemplate(mobile, 841736, [{ name: "ORDERID", value: change.trackingCode }]);
    }
    return "sent";
  } catch (error) {
    console.error("Order SMS failed", { orderId: id, event: change.event, error });
    return "sms_failed";
  }
}
