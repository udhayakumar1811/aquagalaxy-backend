import { useState, useEffect } from "react";
import Footer from "../../components/Footer/Footer";
import Seo from "../../components/Seo/Seo";
import { Link, useLocation } from "react-router-dom";
import { API_URL, getImageUrl } from "../../config";
import { FaHeart } from "react-icons/fa"; // 👈 Wishlist Heart Icon
import { getWishlist, setWishlist as saveWishlist } from "../../utils/wishlist";
import './Shop.css'

const sortParamMap = {
  default: undefined,
  "low-to-high": "price_asc",
  "high-to-low": "price_desc",
  "name-az": "name_asc",
};

function Shop() {
  const [products, setProducts] = useState([]);
  const [sortOption, setSortOption] = useState("default"); // 👈 Sorting State
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [wishlist, setWishlist] = useState(() => getWishlist()); // 👈 Wishlist State
  const [message, setMessage] = useState(""); // 👈 Notification Message

  // Real server-side pagination (Priority 6) — replaces the previous
  // "fetch up to 200 products and hope that's everything" approach, which
  // doesn't scale to a large catalog.
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const PAGE_SIZE = 24;

  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const selectedCategory = queryParams.get("category");

  const [prevCategory, setPrevCategory] = useState(selectedCategory);
  if (prevCategory !== selectedCategory) {
    setPrevCategory(selectedCategory);
    setPage(1);
  }

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
        if (selectedCategory) params.set("category", selectedCategory);
        const sortParam = sortParamMap[sortOption];
        if (sortParam) params.set("sort", sortParam);

        const res = await fetch(`${API_URL}/api/products?${params}`);

        if (!res.ok) {
          throw new Error("Failed to fetch products");
        }

        const data = await res.json();
        const productList = Array.isArray(data) ? data : data.products || [];

        setProducts(productList);
        setTotalPages(Array.isArray(data) ? 1 : (data.pages || 1));
      } catch (err) {
        console.error(err);
        setError("Failed to load products. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [selectedCategory, page, sortOption]);

  const handleSortChange = (e) => {
    setSortOption(e.target.value);
    setPage(1);
  };

  const filteredProducts = products; // kept name for minimal render-code changes below

  // 👈 Toggle Wishlist Handler
  const toggleWishlist = (product) => {
    let updatedWishlist = [...wishlist];
    const productId = product._id || product.id;
    const exists = updatedWishlist.some((item) => (item._id || item.id) === productId);

    if (exists) {
      updatedWishlist = updatedWishlist.filter((item) => (item._id || item.id) !== productId);
      showNotification("❌ Removed from Wishlist");
    } else {
      updatedWishlist.push(product);
      showNotification("❤️ Added to Wishlist Successfully!");
    }

    setWishlist(updatedWishlist);
    saveWishlist(updatedWishlist);
  };

  // 👈 Notification Toast Helper
  const showNotification = (msg) => {
    setMessage(msg);
    setTimeout(() => setMessage(""), 2500);
  };

  return (
    <>
      <Seo
        title="Shop Aquarium Fish & Accessories | AquaGalaxy"
        description="Browse our full range of aquarium fish, tanks, filters, plants, food and accessories."
        canonical={window.location.origin + "/shop"}
      />
      <div className="shop-container">
        
        {/* Header and Sorting Controls */}
        <div className="shop-header-flex" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "15px", marginBottom: "25px" }}>
          <h1 className="shop-title" style={{ margin: 0 }}>
            {selectedCategory ? "Filtered Products" : "All Products"}
          </h1>

          {/* 👈 Price Sorting Dropdown */}
          <div className="sort-dropdown-container">
            <select 
              value={sortOption} 
              onChange={handleSortChange}
              style={{
                padding: "10px 15px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                color: "#334155",
                fontSize: "14px",
                fontWeight: "600",
                cursor: "pointer",
                outline: "none"
              }}
            >
              <option value="default">Sort by: Featured</option>
              <option value="low-to-high">Price: Low to High</option>
              <option value="high-to-low">Price: High to Low</option>
              <option value="name-az">Name: A to Z</option>
            </select>
          </div>
        </div>

        {/* Floating Notification Toast */}
        {message && (
          <div style={{
            position: "fixed", bottom: "20px", right: "20px", background: "#0b1c3f", color: "#fff",
            padding: "12px 20px", borderRadius: "8px", zIndex: 1000, boxShadow: "0 4px 12px rgba(0,0,0,0.15)", fontWeight: "600"
          }}>
            {message}
          </div>
        )}

        {selectedCategory && (
          <div style={{ textAlign: "left", marginBottom: "20px" }}>
            <Link
              to="/shop"
              style={{
                color: "#ff6b00",
                textDecoration: "underline",
                fontWeight: "bold",
              }}
            >
              ← Show All Products
            </Link>
          </div>
        )}

        {loading && (
          <h2 style={{ textAlign: "center", margin: "40px 0" }}>
            Loading Products...
          </h2>
        )}

        {error && (
          <h2 style={{ textAlign: "center", color: "red", margin: "40px 0" }}>
            {error}
          </h2>
        )}

        {!loading && !error && filteredProducts.length === 0 && (
          <div style={{ textAlign: "center", margin: "50px 0" }}>
            <h2>No products found!</h2>
            <p style={{ marginTop: "10px" }}>
              Try selecting another category or view all products.
            </p>
          </div>
        )}

        {!loading && !error && filteredProducts.length > 0 && (
          <div className="products-grid">
            {filteredProducts.map((product) => {
              const productId = product._id || product.id;
              const isWishlisted = wishlist.some((w) => (w._id || w.id) === productId);

              return (
                <div key={productId} className="product-card" style={{ position: "relative" }}>
                  
                  {/* Wishlist Heart Button */}
                  <button
                    onClick={() => toggleWishlist(product)}
                    style={{
                      position: "absolute",
                      top: "12px",
                      right: "12px",
                      background: "#ffffff",
                      border: "none",
                      width: "35px",
                      height: "35px",
                      borderRadius: "50%",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                      color: isWishlisted ? "#ef4444" : "#cbd5e1",
                      zIndex: 2,
                      transition: "color 0.2s, transform 0.2s"
                    }}
                    title={isWishlisted ? "Remove from Wishlist" : "Add to Wishlist"}
                  >
                    <FaHeart size={16} />
                  </button>

                  <div style={{ width: "100%", height: "220px", overflow: "hidden", borderRadius: "8px", position: "relative" }}>
                    <img
                      src={getImageUrl(product.image)}
                      alt={product.name}
                      loading="lazy"
                      style={{ width: "100%", height: "100%", objectFit: "cover", opacity: product.qnt <= 0 ? 0.5 : 1 }}
                    />
                    {product.qnt <= 0 && (
                      <span style={{
                        position: "absolute", top: "10px", left: "10px", background: "#dc2626", color: "#fff",
                        fontSize: "11px", fontWeight: "700", padding: "4px 8px", borderRadius: "4px"
                      }}>
                        OUT OF STOCK
                      </span>
                    )}
                  </div>

                  <h3>{product.name}</h3>

                  <p className="product-price">
                    {product.discountPrice != null && product.discountPrice < product.price ? (
                      <>
                        <span style={{ fontWeight: "700", color: "#ff6b00" }}>₹{product.discountPrice}</span>{" "}
                        <span style={{ textDecoration: "line-through", color: "#94a3b8", fontSize: "13px", marginLeft: "6px" }}>₹{product.price}</span>
                      </>
                    ) : (
                      `₹${product.price}`
                    )}
                  </p>

                  <Link
                    to={`/shop/${product._id}`}
                    className="view-btn"
                  >
                    View Details
                  </Link>
                </div>
              );
            })}
          </div>
        )}

        {!loading && !error && filteredProducts.length > 0 && totalPages > 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "16px", margin: "36px 0" }}>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              style={{ padding: "8px 18px", borderRadius: "8px", border: "1px solid #cbd5e1", background: page <= 1 ? "#f1f5f9" : "#fff", cursor: page <= 1 ? "not-allowed" : "pointer", fontWeight: "600" }}
            >
              ← Previous
            </button>
            <span style={{ fontWeight: "600", color: "#475569" }}>Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              style={{ padding: "8px 18px", borderRadius: "8px", border: "1px solid #cbd5e1", background: page >= totalPages ? "#f1f5f9" : "#fff", cursor: page >= totalPages ? "not-allowed" : "pointer", fontWeight: "600" }}
            >
              Next →
            </button>
          </div>
        )}
      </div>

      <Footer />
    </>
  );
}

export default Shop;