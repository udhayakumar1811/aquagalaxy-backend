import { useContext, useState, useEffect, useRef } from "react";
import "./Navbar.css";
import {
  FaSearch,
  FaHeart,
  FaShoppingCart,
  FaUser,
  FaSignOutAlt,
  FaUserShield,
  FaBars,
  FaTimes,
  FaHome,
  FaStore,
  FaInfoCircle,
  FaEnvelope,
  FaMoon,
  FaSun,
} from "react-icons/fa";
import { NavLink, useNavigate, Link, useLocation } from "react-router-dom";
import { CartContext } from "../../context/CartContext";
import { ThemeContext } from "../../context/ThemeContext";
import { getWishlist, WISHLIST_UPDATED_EVENT } from "../../utils/wishlist";
import { ADMIN_TIER_ROLES } from "../../constants/roles";
import udhayaLogo from "../../assets/udhaya-logo.png";

function Navbar() {
  const { cart } = useContext(CartContext);
  const { theme, toggleTheme } = useContext(ThemeContext);
  const location = useLocation();
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem("user");
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });
  const [showDropdown, setShowDropdown] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [wishlistCount, setWishlistCount] = useState(() => getWishlist().length);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleStorage = () => {
      try {
        const saved = localStorage.getItem("user");
        setUser(saved ? JSON.parse(saved) : null);
      } catch {
        setUser(null);
      }
    };

    const updateWishlistCount = () => {
      setWishlistCount(getWishlist().length);
    };

    updateWishlistCount();

    window.addEventListener("storage", handleStorage);
    window.addEventListener("storage", updateWishlistCount);
    window.addEventListener(WISHLIST_UPDATED_EVENT, updateWishlistCount);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("storage", updateWishlistCount);
      window.removeEventListener(WISHLIST_UPDATED_EVENT, updateWishlistCount);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  // Close drawer on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape" && menuOpen) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  // Auto-close mobile drawer if window resized to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768 && menuOpen) {
        setMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [menuOpen]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setUser(null);
    setShowDropdown(false);
    setMenuOpen(false);
    navigate("/login");
    window.location.reload();
  };

  // Do not mount consumer store Navbar on /admin — the admin dashboard has its own dedicated enterprise layout
  if (location.pathname.startsWith("/admin")) {
    return null;
  }

  return (
    <>
      <nav className="navbar">
        <div className="container">
          <div className="logo">
            <Link
              to="/"
              className="brand-logo-link"
              style={{
                textDecoration: "none",
                color: "inherit",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <img
                src={udhayaLogo}
                alt="UDHAYA AQUATICS"
                className="brand-logo-img"
                style={{
                  height: "42px",
                  width: "auto",
                  objectFit: "contain",
                  borderRadius: "6px",
                }}
              />
              <span
                className="brand-title"
                style={{
                  fontSize: "1.25rem",
                  fontWeight: "800",
                  letterSpacing: "0.5px",
                }}
              >
                UDHAYA AQUATICS
              </span>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <ul className="desktop-menu">
            <li>
              <NavLink to="/">Home</NavLink>
            </li>
            <li>
              <NavLink to="/shop">Shop</NavLink>
            </li>
            <li>
              <NavLink to="/about">About</NavLink>
            </li>
            <li>
              <NavLink to="/contact">Contact</NavLink>
            </li>
          </ul>

          <div className="icons">
            <button
              onClick={toggleTheme}
              className="icon-link"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
              }}
              title={theme === "light" ? "Switch to dark mode" : "Switch to light mode"}
              aria-label="Toggle dark mode"
            >
              {theme === "light" ? <FaMoon /> : <FaSun />}
            </button>

            <NavLink to="/search" className="icon-link" title="Search">
              <FaSearch />
            </NavLink>

            {/* Wishlist Link with Badge */}
            <NavLink
              to="/wishlist"
              className="icon-link"
              style={{ position: "relative" }}
              title="Wishlist"
            >
              <FaHeart />
              {wishlistCount > 0 && (
                <span className="cart-badge">{wishlistCount}</span>
              )}
            </NavLink>

            {/* Cart Link with Badge */}
            <NavLink
              to="/cart"
              className="icon-link"
              style={{ position: "relative" }}
              title="Shopping Cart"
            >
              <FaShoppingCart />
              {cart && cart.length > 0 && (
                <span className="cart-badge">{cart.length}</span>
              )}
            </NavLink>

            <div className="profile-wrapper" ref={dropdownRef}>
              <button
                className="profile-icon-btn"
                onClick={() => setShowDropdown(!showDropdown)}
                title="Profile"
              >
                <FaUser />
              </button>

              {showDropdown && (
                <div className="profile-dropdown">
                  {user ? (
                    <>
                      <div className="dropdown-user-info">
                        Hi, {user?.name ? user.name.split(" ")[0] : "User"}
                      </div>
                      <hr />

                      {ADMIN_TIER_ROLES.includes(user?.role) && (
                        <Link
                          to="/admin"
                          className="dropdown-item"
                          onClick={() => setShowDropdown(false)}
                          style={{ color: "#0099cc", fontWeight: "bold" }}
                        >
                          <FaUserShield style={{ marginRight: "8px" }} /> Admin Panel
                        </Link>
                      )}

                      <Link
                        to="/profile"
                        className="dropdown-item"
                        onClick={() => setShowDropdown(false)}
                      >
                        My Profile
                      </Link>
                      <button
                        onClick={handleLogout}
                        className="dropdown-item logout-btn"
                      >
                        <FaSignOutAlt style={{ marginRight: "8px" }} /> Logout
                      </button>
                    </>
                  ) : (
                    <>
                      <Link
                        to="/login"
                        className="dropdown-item"
                        onClick={() => setShowDropdown(false)}
                      >
                        Login
                      </Link>
                      <Link
                        to="/signup"
                        className="dropdown-item"
                        onClick={() => setShowDropdown(false)}
                      >
                        Register
                      </Link>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Mobile Hamburger Toggle */}
            <button
              className="hamburger-btn"
              onClick={() => setMenuOpen(true)}
              aria-label="Open navigation menu"
            >
              <FaBars />
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Navigation Drawer Backdrop */}
      <div
        className={`mobile-drawer-backdrop ${menuOpen ? "open" : ""}`}
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
      />

      {/* Mobile Navigation Drawer */}
      <aside
        className={`mobile-nav-drawer ${menuOpen ? "open" : ""}`}
        aria-label="Mobile Navigation"
      >
        {/* Drawer Header */}
        <div className="drawer-header">
          <Link
            to="/"
            className="drawer-brand"
            onClick={() => setMenuOpen(false)}
          >
            <img
              src={udhayaLogo}
              alt="UDHAYA AQUATICS"
              className="drawer-logo-img"
            />
            <div className="drawer-brand-text">
              <span className="drawer-title">UDHAYA AQUATICS</span>
              <span className="drawer-subtitle">Aquarium & Pet Studio</span>
            </div>
          </Link>
          <button
            className="drawer-close-btn"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation menu"
          >
            <FaTimes />
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="drawer-content">
          <div className="drawer-section-label">Navigation</div>
          <nav className="drawer-nav">
            <NavLink
              to="/"
              className={({ isActive }) =>
                `drawer-nav-item ${isActive ? "active" : ""}`
              }
              onClick={() => setMenuOpen(false)}
            >
              <FaHome className="drawer-nav-icon" />
              <span>Home</span>
            </NavLink>
            <NavLink
              to="/shop"
              className={({ isActive }) =>
                `drawer-nav-item ${isActive ? "active" : ""}`
              }
              onClick={() => setMenuOpen(false)}
            >
              <FaStore className="drawer-nav-icon" />
              <span>Shop</span>
            </NavLink>
            <NavLink
              to="/about"
              className={({ isActive }) =>
                `drawer-nav-item ${isActive ? "active" : ""}`
              }
              onClick={() => setMenuOpen(false)}
            >
              <FaInfoCircle className="drawer-nav-icon" />
              <span>About</span>
            </NavLink>
            <NavLink
              to="/contact"
              className={({ isActive }) =>
                `drawer-nav-item ${isActive ? "active" : ""}`
              }
              onClick={() => setMenuOpen(false)}
            >
              <FaEnvelope className="drawer-nav-icon" />
              <span>Contact</span>
            </NavLink>
          </nav>

          <div className="drawer-divider" />

          {/* User Account / Admin Section */}
          <div className="drawer-section-label">Account</div>
          {user ? (
            <div className="drawer-user-section">
              <div className="drawer-user-badge-card">
                <div className="drawer-user-avatar">
                  <FaUser />
                </div>
                <div className="drawer-user-info">
                  <span className="drawer-user-name">
                    {user?.name || "Customer"}
                  </span>
                  <span className="drawer-user-role">
                    {ADMIN_TIER_ROLES.includes(user?.role)
                      ? "Administrator"
                      : "Customer"}
                  </span>
                </div>
              </div>

              <div className="drawer-nav drawer-user-links">
                {ADMIN_TIER_ROLES.includes(user?.role) && (
                  <NavLink
                    to="/admin"
                    className="drawer-nav-item admin-link"
                    onClick={() => setMenuOpen(false)}
                  >
                    <FaUserShield className="drawer-nav-icon" />
                    <span>Admin Panel</span>
                  </NavLink>
                )}

                <NavLink
                  to="/profile"
                  className={({ isActive }) =>
                    `drawer-nav-item ${isActive ? "active" : ""}`
                  }
                  onClick={() => setMenuOpen(false)}
                >
                  <FaUser className="drawer-nav-icon" />
                  <span>My Profile</span>
                </NavLink>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="drawer-nav-item drawer-logout-btn"
                >
                  <FaSignOutAlt className="drawer-nav-icon" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="drawer-auth-box">
              <Link
                to="/login"
                className="drawer-auth-link login"
                onClick={() => setMenuOpen(false)}
              >
                <FaUser className="drawer-nav-icon" />
                <span>Login</span>
              </Link>
              <Link
                to="/signup"
                className="drawer-auth-link signup"
                onClick={() => setMenuOpen(false)}
              >
                <span>Register</span>
              </Link>
            </div>
          )}
        </div>

        {/* Drawer Bottom Footer */}
        <div className="drawer-footer">
          <button
            type="button"
            className="drawer-theme-toggle"
            onClick={toggleTheme}
            aria-label="Toggle dark mode"
          >
            {theme === "light" ? (
              <>
                <FaMoon className="drawer-theme-icon" />
                <span>Switch to Dark Mode</span>
              </>
            ) : (
              <>
                <FaSun className="drawer-theme-icon" />
                <span>Switch to Light Mode</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}

export default Navbar;