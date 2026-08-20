const mongoose = require("mongoose");
const Order = require("../models/orderModel");
const Product = require("../models/productModel");

// @desc    Create new order
// @route   POST /api/orders
// @access  Public / Private
// NOTE: orderItems' prices and the final totalPrice are ALWAYS recalculated
// from the database here — the client-submitted price/totalPrice values are
// never trusted, to prevent price tampering. Stock is validated and
// decremented atomically so products cannot be oversold.
const addOrderItems = async (req, res) => {
  try {
    const { orderItems, shippingAddress, paymentMethod, upiTransactionId } = req.body;

    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json({ message: "No order items found" });
    }

    if (
      paymentMethod === "Online UPI Payment" &&
      (!upiTransactionId || !upiTransactionId.trim())
    ) {
      return res
        .status(400)
        .json({ message: "UPI Transaction ID / UTR number is required for online payments" });
    }

    // Look up every product referenced in the cart in one query
    const productIds = orderItems.map((item) => item.product);
    const products = await Product.find({ _id: { $in: productIds } });
    const productMap = new Map(products.map((p) => [String(p._id), p]));

    let totalPrice = 0;
    const verifiedItems = [];

    for (const item of orderItems) {
      const dbProduct = productMap.get(String(item.product));

      if (!dbProduct) {
        return res.status(400).json({ message: `Product not found: ${item.name || item.product}` });
      }

      const quantity = Number(item.quantity) || 1;

      if (quantity < 1) {
        return res.status(400).json({ message: `Invalid quantity for ${dbProduct.name}` });
      }

      if (dbProduct.qnt < quantity) {
        return res.status(400).json({
          message: `Insufficient stock for "${dbProduct.name}". Only ${dbProduct.qnt} left.`,
        });
      }

      // Price and name/image are taken from the DB record, NOT the client payload
      totalPrice += dbProduct.price * quantity;

      verifiedItems.push({
        name: dbProduct.name,
        quantity,
        image: dbProduct.image,
        price: dbProduct.price,
        product: dbProduct._id,
      });
    }

    // Decrement stock for each product (best-effort transaction; falls back
    // gracefully on standalone MongoDB instances that don't support sessions)
    const session = await mongoose.startSession().catch(() => null);
    try {
      if (session) session.startTransaction();

      for (const item of verifiedItems) {
        const updateResult = await Product.updateOne(
          { _id: item.product, qnt: { $gte: item.quantity } },
          { $inc: { qnt: -item.quantity } },
          session ? { session } : {}
        );

        if (updateResult.matchedCount === 0) {
          throw new Error(`Insufficient stock for "${item.name}". Please refresh your cart.`);
        }
      }

      const order = new Order({
        user: req.user ? req.user._id : null,
        orderItems: verifiedItems,
        shippingAddress,
        paymentMethod: paymentMethod || "Cash on Delivery",
        upiTransactionId: upiTransactionId || null,
        totalPrice,
        status: "Pending",
      });

      const createdOrder = session
        ? (await order.save({ session }))
        : await order.save();

      if (session) {
        await session.commitTransaction();
        session.endSession();
      }

      res.status(201).json(createdOrder);
    } catch (innerErr) {
      if (session) {
        await session.abortTransaction();
        session.endSession();
      }
      throw innerErr;
    }
  } catch (error) {
    console.error("Order Creation Error:", error);
    res.status(400).json({ message: error.message || "Server Error" });
  }
};

// @desc    Get all orders for Admin
// @route   GET /api/orders
// @access  Private/Admin
const getOrders = async (req, res) => {
  try {
    const orders = await Order.find({}).sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    console.error("Fetch Orders Error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// @desc    Update order status
// @route   PUT /api/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowedStatuses = ["Pending", "Packing", "Shipping", "Delivered", "Cancelled"];

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const order = await Order.findById(req.params.id);

    if (order) {
      // If cancelling an order that hadn't been cancelled before, restock items
      if (status === "Cancelled" && order.status !== "Cancelled") {
        for (const item of order.orderItems) {
          await Product.updateOne(
            { _id: item.product },
            { $inc: { qnt: item.quantity } }
          );
        }
      }

      order.status = status;
      order.isDelivered = status === "Delivered";

      const updatedOrder = await order.save();
      res.json(updatedOrder);
    } else {
      res.status(404).json({ message: "Order not found" });
    }
  } catch (error) {
    console.error("Update Order Status Error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// @desc    Get logged in user orders
// @route   GET /api/orders/myorders
// @access  Private
const getMyOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user._id }).sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (error) {
    console.error("Fetch My Orders Error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

// @desc    Cancel own order (only if not already shipped/delivered)
// @route   PUT /api/orders/:id/cancel
// @access  Private
const cancelMyOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (String(order.user) !== String(req.user._id)) {
      return res.status(403).json({ message: "Not authorized to cancel this order" });
    }

    if (["Shipping", "Delivered", "Cancelled"].includes(order.status)) {
      return res.status(400).json({
        message: `Order cannot be cancelled once it is ${order.status}.`,
      });
    }

    // Restock items
    for (const item of order.orderItems) {
      await Product.updateOne(
        { _id: item.product },
        { $inc: { qnt: item.quantity } }
      );
    }

    order.status = "Cancelled";
    const updatedOrder = await order.save();
    res.json(updatedOrder);
  } catch (error) {
    console.error("Cancel Order Error:", error);
    res.status(500).json({ message: "Server Error", error: error.message });
  }
};

module.exports = {
  addOrderItems,
  getOrders,
  updateOrderStatus,
  getMyOrders,
  cancelMyOrder,
};
