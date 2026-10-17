const Product = require("../models/productModel");
const Category = require("../models/categoryModel");

// @desc    Dynamically generated XML sitemap, including every active
//          product and category — a static file can't reflect a live
//          product catalog, so this is generated fresh on each request
//          from the database.
// @route   GET /sitemap.xml
// @access  Public
const getSitemap = async (req, res) => {
  try {
    // FRONTEND_URL must be set to the real production frontend domain for
    // these URLs to be correct — see .env.example.
    const baseUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/$/, "");

    const [products, categories] = await Promise.all([
      Product.find({ isActive: true }).select("slug _id updatedAt"),
      Category.find({}).select("_id"),
    ]);

    const staticUrls = [
      "/",
      "/shop",
      "/about",
      "/contact",
      "/privacy-policy",
      "/terms-and-conditions",
      "/shipping-policy",
      "/refund-policy",
      "/cancellation-policy",
      "/payment-policy",
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    for (const path of staticUrls) {
      xml += `  <url><loc>${baseUrl}${path}</loc><changefreq>daily</changefreq></url>\n`;
    }

    for (const product of products) {
      const slugOrId = product.slug || product._id;
      xml += `  <url><loc>${baseUrl}/shop/${slugOrId}</loc><lastmod>${product.updatedAt.toISOString().split("T")[0]}</lastmod><changefreq>weekly</changefreq></url>\n`;
    }

    for (const category of categories) {
      xml += `  <url><loc>${baseUrl}/shop?category=${category._id}</loc><changefreq>weekly</changefreq></url>\n`;
    }

    xml += `</urlset>`;

    res.header("Content-Type", "application/xml");
    res.send(xml);
  } catch (error) {
    console.error("Sitemap generation error:", error);
    res.status(500).send("Could not generate sitemap");
  }
};

module.exports = { getSitemap };
