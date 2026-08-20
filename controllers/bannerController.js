const Banner = require("../models/bannerModel");

// @desc    Get banner details
// @route   GET /api/banner
// @access  Public
const getBanner = async (req, res) => {
  try {
    let banner = await Banner.findOne();
    if (!banner) {
      // முதல்முறை டேட்டா இல்லை என்றால் இயல்புநிலை (Default) டேட்டாவை உருவாக்குகிறது
      banner = await Banner.create({
        title: "50% OFF",
        subtitle: "Premium Aquarium Fish",
        description: "Get healthy and beautiful aquarium fish at the best price.",
        image: "/uploads/default-fish.jpg",
        endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
      });
    }
    res.json(banner);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update banner details (Admin)
// @route   PUT /api/banner
// @access  Private/Admin
const updateBanner = async (req, res) => {
  try {
    const { title, subtitle, description, image, endDate } = req.body;

    let banner = await Banner.findOne();

    if (banner) {
      banner.title = title || banner.title;
      banner.subtitle = subtitle || banner.subtitle;
      banner.description = description || banner.description;
      banner.image = image || banner.image;
      banner.endDate = endDate || banner.endDate;

      const updatedBanner = await banner.save();
      res.json(updatedBanner);
    } else {
      const newBanner = await Banner.create({
        title,
        subtitle,
        description,
        image,
        endDate,
      });
      res.status(201).json(newBanner);
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getBanner, updateBanner };