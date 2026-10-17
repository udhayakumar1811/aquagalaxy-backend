import Footer from "../../components/Footer/Footer";
import { FaFish, FaLeaf, FaShippingFast, FaHeadset, FaStore, FaAward } from "react-icons/fa";
import "./About.css";

function About() {
  return (
    <div className="about-page-wrapper">
      {/* Hero Section */}
      <section className="about-hero">
        <div className="about-hero-content">
          <h1>About UDHAYA AQUATICS</h1>
          <p>
            Dedicated to bringing healthy, vibrant ornamental fish, customized aquariums,
            and professional aquatic care products straight to hobbyists across India.
          </p>
        </div>
      </section>

      {/* Our Story Section */}
      <section className="about-section">
        <div className="about-container">
          <h2 className="section-title" style={{ textAlign: "center", marginBottom: "20px", color: "#0b1c3f", fontWeight: "800" }}>
            Our Story &amp; Heritage
          </h2>
          <p className="about-text">
            <strong>UDHAYA AQUATICS</strong> was founded by <strong>UDHAYAKUMAR</strong> in Rajapalayam, Virudhunagar District, Tamil Nadu, with a passionate mission: to provide hobbyists and beginners with authentic, healthy aquatic life and dependable aquarium supplies.
          </p>
          <p className="about-text" style={{ marginTop: "15px" }}>
            What started as a specialized aquatic breeding facility has grown into a trusted online aquarium store serving enthusiasts all across India. We personally inspect, quarantine, and pack each live specimen using breathable, oxygen-packed containers and temperature-controlled materials to ensure safe transit to your doorstep.
          </p>
        </div>
      </section>

      {/* Why Choose Us Values Section */}
      <section className="about-values-section">
        <div className="about-container">
          <h2 className="section-title" style={{ textAlign: "center", marginBottom: "35px", color: "#0b1c3f", fontWeight: "800" }}>
            Why Choose UDHAYA AQUATICS
          </h2>
          <div className="about-values-grid">
            <div className="about-value-card">
              <FaFish className="about-value-icon" />
              <h3>Healthy Livestock</h3>
              <p>Every fish is quarantined, health-checked, and conditioned before shipping.</p>
            </div>
            <div className="about-value-card">
              <FaLeaf className="about-value-icon" />
              <h3>Quality Live Plants</h3>
              <p>Fresh, snail-free aquatic plants to help your aquarium ecosystem thrive.</p>
            </div>
            <div className="about-value-card">
              <FaShippingFast className="about-value-icon" />
              <h3>Safe Transit &amp; Packaging</h3>
              <p>Specialized oxygen-filled insulated packaging to guarantee live arrival.</p>
            </div>
            <div className="about-value-card">
              <FaHeadset className="about-value-icon" />
              <h3>Direct WhatsApp Support</h3>
              <p>Expert hobbyist advice from our founder and staff during business hours.</p>
            </div>
            <div className="about-value-card">
              <FaStore className="about-value-icon" />
              <h3>Local Indian Store</h3>
              <p>Based in Rajapalayam, Virudhunagar, supporting Indian aquaculture.</p>
            </div>
            <div className="about-value-card">
              <FaAward className="about-value-icon" />
              <h3>Quality Assurance</h3>
              <p>Only authentic feeds, reliable filters, and genuine accessories sold.</p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default About;