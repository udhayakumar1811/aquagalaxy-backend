const Order = require("../models/orderModel");
const User = require("../models/userModel");
const Product = require("../models/productModel");

// Resolves a named or custom date range into { from, to } Date objects.
function resolveDateRange({ range, from, to }) {
  const now = new Date();
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  switch (range) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now) };
    case "yesterday": {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      return { from: startOfDay(y), to: endOfDay(y) };
    }
    case "7d": {
      const start = new Date(now); start.setDate(start.getDate() - 6);
      return { from: startOfDay(start), to: endOfDay(now) };
    }
    case "30d": {
      const start = new Date(now); start.setDate(start.getDate() - 29);
      return { from: startOfDay(start), to: endOfDay(now) };
    }
    case "month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) };
    case "custom":
      return { from: from ? new Date(from) : startOfDay(now), to: to ? endOfDay(new Date(to)) : endOfDay(now) };
    default: // default to last 30 days
      { const start = new Date(now); start.setDate(start.getDate() - 29); return { from: startOfDay(start), to: endOfDay(now) }; }
  }
}

// @desc    Admin analytics dashboard data (Section 30)
// @route   GET /api/admin/analytics?range=today|yesterday|7d|30d|month|custom&from=&to=
// @access  Private/Admin
const getAnalytics = async (req, res) => {
  try {
    const { range, from, to } = req.query;
    const { from: fromDate, to: toDate } = resolveDateRange({ range, from, to });
    const dateFilter = { createdAt: { $gte: fromDate, $lte: toDate } };

    const [
      totalOrders,
      paidOrders,
      pendingPayments,
      cancelledOrders,
      deliveredOrders,
      revenueAgg,
      totalCustomers,
      newCustomers,
      lowStockProducts,
      topSellingAgg,
      revenueByDateAgg,
      revenueByCategoryAgg,
      statusDistributionAgg,
      paymentMethodAgg,
    ] = await Promise.all([
      Order.countDocuments(dateFilter),
      Order.countDocuments({ ...dateFilter, paymentStatus: "Verified" }),
      Order.countDocuments({ ...dateFilter, paymentStatus: "Pending Verification" }),
      Order.countDocuments({ ...dateFilter, status: "Cancelled" }),
      Order.countDocuments({ ...dateFilter, status: "Delivered" }),
      Order.aggregate([
        { $match: { ...dateFilter, paymentStatus: "Verified" } },
        { $group: { _id: null, total: { $sum: "$pricing.totalPrice" } } },
      ]),
      User.countDocuments({ role: "user" }),
      User.countDocuments({ role: "user", createdAt: { $gte: fromDate, $lte: toDate } }),
      Product.find({ qnt: { $lte: 5 }, isActive: true }).select("name qnt").limit(20),
      Order.aggregate([
        { $match: { ...dateFilter, paymentStatus: "Verified" } },
        { $unwind: "$orderItems" },
        { $group: { _id: "$orderItems.name", quantitySold: { $sum: "$orderItems.quantity" } } },
        { $sort: { quantitySold: -1 } },
        { $limit: 10 },
      ]),
      Order.aggregate([
        { $match: { ...dateFilter, paymentStatus: "Verified" } },
        { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, revenue: { $sum: "$pricing.totalPrice" } } },
        { $sort: { _id: 1 } },
      ]),
      Order.aggregate([
        { $match: { ...dateFilter, paymentStatus: "Verified" } },
        { $unwind: "$orderItems" },
        { $lookup: { from: "products", localField: "orderItems.product", foreignField: "_id", as: "productDoc" } },
        { $unwind: { path: "$productDoc", preserveNullAndEmptyArrays: true } },
        { $lookup: { from: "categories", localField: "productDoc.category_id", foreignField: "_id", as: "categoryDoc" } },
        { $unwind: { path: "$categoryDoc", preserveNullAndEmptyArrays: true } },
        {
          $group: {
            _id: { $ifNull: ["$categoryDoc.name", "Uncategorized"] },
            revenue: { $sum: { $multiply: ["$orderItems.quantity", { $ifNull: ["$orderItems.discountPrice", "$orderItems.price"] }] } },
          },
        },
        { $sort: { revenue: -1 } },
      ]),
      Order.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Order.aggregate([
        { $match: dateFilter },
        { $group: { _id: "$paymentMethod", count: { $sum: 1 } } },
      ]),
    ]);

    res.json({
      range: { from: fromDate, to: toDate },
      totals: {
        totalOrders,
        paidOrders,
        pendingPayments,
        cancelledOrders,
        deliveredOrders,
        totalRevenue: revenueAgg[0]?.total || 0,
        totalCustomers,
        newCustomers,
      },
      lowStockProducts,
      topSellingProducts: topSellingAgg.map((p) => ({ name: p._id, quantitySold: p.quantitySold })),
      revenueByDate: revenueByDateAgg.map((r) => ({ date: r._id, revenue: r.revenue })),
      revenueByCategory: revenueByCategoryAgg.map((r) => ({ category: r._id, revenue: r.revenue })),
      statusDistribution: statusDistributionAgg.map((s) => ({ status: s._id, count: s.count })),
      paymentMethodStats: paymentMethodAgg.map((p) => ({ method: p._id, count: p.count })),
    });
  } catch (error) {
    console.error("Analytics Error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { getAnalytics };
