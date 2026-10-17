import "./Footer.css";
import { Link } from "react-router-dom";
import {
  FaFacebookF,
  FaInstagram,
  FaYoutube,
  FaWhatsapp,
  FaPhone,
  FaEnvelope,
  FaMapMarkerAlt,
  FaClock,
} from "react-icons/fa";
import udhayaLogo from "../../assets/udhaya-logo.png";

function Footer() {
  return (
    <footer className="footer">
      <div className="footer-container">

        {/* Brand Summary Column */}
        <div className="footer-box">
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
            <img
              src={udhayaLogo}
              alt="UDHAYA AQUATICS"
              style={{ height: "48px", width: "auto", objectFit: "contain", borderRadius: "8px", background: "white", padding: "2px" }}
            />
            <h2 style={{ margin: 0, fontSize: "1.4rem", color: "#f8fafc" }}>UDHAYA AQUATICS</h2>
          </div>
          <p className="brand-desc">
            Premium Live Ornamental Fish, Custom Glass Tanks, Live Plants,
            Quality Feeds and Aquarium Accessories.
          </p>
          <div style={{ marginTop: "12px", fontSize: "13px", color: "#94a3b8" }}>
            Proprietor: <strong>UDHAYAKUMAR</strong>
          </div>
        </div>

        {/* Quick Links Column */}
        <div className="footer-box">
          <h3>Quick Links</h3>
          <ul>
            <li><Link to="/">Home</Link></li>
            <li><Link to="/shop">Shop</Link></li>
            <li><Link to="/about">About Us</Link></li>
            <li><Link to="/contact">Contact Us</Link></li>
            <li><Link to="/wishlist">Wishlist</Link></li>
            <li><Link to="/profile">My Account / Orders</Link></li>
          </ul>
        </div>

        {/* Customer Policies & Legal Column */}
        <div className="footer-box">
          <h3>Customer Policies</h3>
          <ul>
            <li><Link to="/privacy-policy">Privacy Policy</Link></li>
            <li><Link to="/terms-and-conditions">Terms & Conditions</Link></li>
            <li><Link to="/shipping-policy">Shipping & Delivery</Link></li>
            <li><Link to="/refund-policy">Return & Refund Policy</Link></li>
            <li><Link to="/cancellation-policy">Cancellation Policy</Link></li>
            <li><Link to="/payment-policy">Payment Policy</Link></li>
          </ul>
        </div>

        {/* Contact Information Column */}
        <div className="footer-box">
          <h3>Contact Us</h3>
          
          <div className="contact-item">
            <FaPhone className="contact-icon" /> <span><a href="tel:+916381582969" style={{ color: "inherit", textDecoration: "none" }}>+91 63815 82969</a></span>
          </div>
          <div className="contact-item">
            <FaWhatsapp className="contact-icon" /> <span><a href="https://wa.me/916381582969" target="_blank" rel="noreferrer" style={{ color: "inherit", textDecoration: "none" }}>+91 63815 82969</a></span>
          </div>
          <div className="contact-item">
            <FaEnvelope className="contact-icon" /> <span><a href="mailto:udhaya.aqua.pets@gmail.com" style={{ color: "inherit", textDecoration: "none" }}>udhaya.aqua.pets@gmail.com</a></span>
          </div>
          <div className="contact-item">
            <FaMapMarkerAlt className="contact-icon" /> <span>Rajapalayam, Virudhunagar Dist, Tamil Nadu - 626117</span>
          </div>
          <div className="contact-item">
            <FaClock className="contact-icon" /> <span>Mon – Sun: 7:00 AM – 9:00 PM</span>
          </div>

          <div className="social-icons" style={{ marginTop: "15px" }}>
            <a href="https://www.facebook.com/share/1DYndWGcjC/" target="_blank" rel="noreferrer" title="Facebook"><FaFacebookF /></a>
            <a href="https://www.instagram.com/invites/contact/?utm_source=ig_contact_invite&utm_medium=copy_link&utm_content=j0ccj2u" target="_blank" rel="noreferrer" title="Instagram"><FaInstagram /></a>
            <a href="https://www.youtube.com/@Udhaya_Aquatics" target="_blank" rel="noreferrer" title="YouTube"><FaYoutube /></a>
            <a href="https://chat.whatsapp.com/Bb4FI0WOsYgBKxHoTOQ8u4" target="_blank" rel="noreferrer" title="WhatsApp Community"><FaWhatsapp /></a>
          </div>
        </div>

      </div>

      <div className="copyright">
        &copy; {new Date().getFullYear()} UDHAYA AQUATICS. All Rights Reserved. Owned and Operated by UDHAYAKUMAR.
      </div>
    </footer>
  );
}

export default Footer;