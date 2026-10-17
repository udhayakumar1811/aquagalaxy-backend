import { useState } from "react";
import Footer from "../../components/Footer/Footer";
import { FaMapMarkerAlt, FaPhoneAlt, FaEnvelope, FaWhatsapp, FaClock, FaUserTie } from "react-icons/fa";
import { API_URL } from "../../config";
import "./Contact.css";

function Contact() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/api/contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to send message");
      }

      setSubmitted(true);
      setForm({ name: "", email: "", phone: "", message: "" });
      
      setTimeout(() => {
        setSubmitted(false);
      }, 4000);
    } catch (err) {
      console.error("Contact form error:", err);
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="contact-page">
        <h1 className="section-title">Get In Touch</h1>
        <p style={{ textAlign: "center", color: "#64748b", maxWidth: "600px", margin: "-10px auto 30px" }}>
          Have questions about fish health, aquarium setups, or shipping? Reach out to us directly or fill in the form below.
        </p>

        <div className="contact-wrapper">
          {/* Left side business info panel */}
          <div className="contact-info-panel">
            <div className="contact-info-item">
              <FaUserTie className="contact-info-icon" />
              <div>
                <h4>Business &amp; Proprietor</h4>
                <p><strong>UDHAYA AQUATICS</strong></p>
                <p style={{ fontSize: "13px", color: "#64748b" }}>Proprietor: UDHAYAKUMAR</p>
              </div>
            </div>

            <div className="contact-info-item">
              <FaMapMarkerAlt className="contact-info-icon" />
              <div>
                <h4>Store Location</h4>
                <p>Rajapalayam, Virudhunagar District</p>
                <p style={{ fontSize: "13px", color: "#64748b" }}>Tamil Nadu, India - 626117</p>
              </div>
            </div>

            <div className="contact-info-item">
              <FaPhoneAlt className="contact-info-icon" />
              <div>
                <h4>Phone Support</h4>
                <p>
                  <a href="tel:6381582969" style={{ color: "inherit", textDecoration: "none" }}>
                    +91 63815 82969
                  </a>
                </p>
              </div>
            </div>

            <div className="contact-info-item">
              <FaWhatsapp className="contact-info-icon" style={{ color: "#25D366" }} />
              <div>
                <h4>WhatsApp Support</h4>
                <p>
                  <a
                    href="https://wa.me/916381582969?text=Hello%20UDHAYA%20AQUATICS%2C%20I%20have%20an%20enquiry"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#16a34a", fontWeight: "600", textDecoration: "none" }}
                  >
                    +91 63815 82969 (Chat Now)
                  </a>
                </p>
              </div>
            </div>

            <div className="contact-info-item">
              <FaEnvelope className="contact-info-icon" />
              <div>
                <h4>Email Support</h4>
                <p>
                  <a href="mailto:udhaya.aqua.pets@gmail.com" style={{ color: "inherit", textDecoration: "none" }}>
                    udhaya.aqua.pets@gmail.com
                  </a>
                </p>
              </div>
            </div>

            <div className="contact-info-item">
              <FaClock className="contact-info-icon" />
              <div>
                <h4>Business Hours</h4>
                <p>7:00 AM – 9:00 PM</p>
                <p style={{ fontSize: "13px", color: "#64748b" }}>Monday – Sunday (All 7 Days)</p>
              </div>
            </div>
          </div>

          {/* Right side form */}
          <form className="contact-form" onSubmit={handleSubmit}>
            {submitted && (
              <p className="contact-success-msg" style={{ color: "#16a34a", fontWeight: "600", marginBottom: "15px" }}>
                Thanks for reaching out! We'll get back to you soon.
              </p>
            )}

            {error && (
              <p style={{ color: "#dc2626", fontWeight: "600", marginBottom: "15px" }}>
                {error}
              </p>
            )}

            <div className="contact-form-group">
              <label>Name</label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
              />
            </div>
            <div className="contact-form-group">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
              />
            </div>
            <div className="contact-form-group">
              <label>Phone Number</label>
              <input
                type="text"
                name="phone"
                value={form.phone}
                onChange={handleChange}
              />
            </div>
            <div className="contact-form-group">
              <label>Message</label>
              <textarea
                name="message"
                rows="5"
                value={form.message}
                onChange={handleChange}
                required
              ></textarea>
            </div>
            <button type="submit" className="contact-submit-btn" disabled={loading}>
              {loading ? "Sending..." : "Send Message"}
            </button>
          </form>
        </div>
      </div>

      <Footer />
    </>
  );
}

export default Contact;