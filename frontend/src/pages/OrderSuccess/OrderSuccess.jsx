import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { FaCheckCircle, FaWhatsapp } from "react-icons/fa";
import { API_URL } from "../../config";
import Footer from "../../components/Footer/Footer";
import "./OrderSuccess.css";

function OrderSuccess() {
  const location = useLocation();
  const order = location.state?.order; // Checkout-ல் இருந்து வரும் டேட்டா
  const [whatsappNumber, setWhatsappNumber] = useState(null);

  useEffect(() => {
    // The admin WhatsApp number is configurable via Settings — never
    // hardcoded here (Section 25/58 of the spec).
    fetch(`${API_URL}/api/settings/public`)
      .then((res) => res.json())
      .then((data) => setWhatsappNumber(data?.whatsapp?.adminNumber || null))
      .catch(() => setWhatsappNumber(null));
  }, []);

  const sendToWhatsApp = () => {
    if (!order) {
      alert("Order details not found!");
      return;
    }
    if (!whatsappNumber) {
      alert("WhatsApp number is not configured yet. Please contact us directly.");
      return;
    }

    const orderIdStr = order.orderNumber || `#${order._id?.substring(order._id.length - 6).toUpperCase()}`;
    let message = `Hello UDHAYA AQUATICS! 🐟\n\nI have successfully placed an order.\n\n`;
    message += `*Order ID:* ${orderIdStr}\n`;
    message += `*Total Amount:* ₹${order.pricing?.totalPrice ?? order.totalPrice}\n`;
    message += `*Payment Method:* ${order.paymentMethod}\n`;

    const utr = order.paymentDetails?.utr || order.upiTransactionId;
    if (utr) {
      message += `*UTR Number:* ${utr}\n`;
    }

    message += `\nPlease process my order soon. Thank you!`;

    const whatsappUrl = `https://wa.me/${whatsappNumber.replace(/\D/g, "")}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };

  return (
    <>
    <div className="order-success-container">
      <div className="order-success-card">
        <FaCheckCircle className="success-icon" />
        <h1>Order Placed Successfully!</h1>
        <p>
          Thank you for shopping with UDHAYA AQUATICS.{" "}
          {order?.paymentMethod === "Razorpay" || order?.paymentStatus === "Verified"
            ? "Your payment is verified and your order is confirmed!"
            : "Your order is received and pending verification — we'll confirm it once your payment receipt/UTR is checked."}
        </p>

        {order?.orderNumber && (
          <p style={{ fontWeight: "700", color: "#0b1c3f" }}>Order ID: {order.orderNumber}</p>
        )}

        {order && (
          <div className="whatsapp-prompt">
            <p>Notify us on WhatsApp for faster processing!</p>
            <button onClick={sendToWhatsApp} className="btn-whatsapp">
              <FaWhatsapp style={{ fontSize: "20px" }} /> Send to WhatsApp
            </button>
          </div>
        )}

        <div className="success-actions">
          <Link to="/shop" className="btn-shop">Continue Shopping</Link>
          <Link to="/profile" className="btn-home">Track Order</Link>
        </div>
      </div>
    </div>
    <Footer />
    </>
  );
}

export default OrderSuccess;