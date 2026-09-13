const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const Product = require('../models/Product');

// @route   GET /api/v1/reviews
// @desc    Get reviews (optional filter by productId)
router.get('/', async (req, res) => {
  try {
    const { productId } = req.query;
    const filter = {};

    if (productId) {
      filter.productId = productId;
    }

    const reviews = await Review.find(filter).sort({ createdAt: -1 });

    res.json({
      success: true,
      count: reviews.length,
      data: reviews
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// @route   POST /api/v1/reviews
// @desc    Create product review
router.post('/', async (req, res) => {
  try {
    const { productId, userName, userEmail, rating, title, comment } = req.body;

    if (!productId || !userName || !rating || !comment) {
      return res.status(400).json({ success: false, message: 'Please provide rating, review comment, and product ID' });
    }

    const review = await Review.create({
      productId,
      userName,
      userEmail: userEmail || '',
      rating: Number(rating),
      title: title || '',
      comment
    });

    // Update Product average rating & review count if product exists in MongoDB
    try {
      const allProductReviews = await Review.find({ productId });
      const avgRating = (allProductReviews.reduce((sum, r) => sum + r.rating, 0) / allProductReviews.length).toFixed(1);
      
      await Product.findByIdAndUpdate(productId, {
        rating: Number(avgRating),
        reviewsCount: allProductReviews.length
      });
    } catch (e) {
      // product update optional
    }

    res.status(201).json({
      success: true,
      message: 'Review submitted successfully!',
      data: review
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
