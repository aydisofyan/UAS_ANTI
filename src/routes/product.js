const express = require('express');
const {
  createProduct,
  getAllProducts,
  getProductsByFarmer,
  updateProduct,
  deleteProduct,
} = require('../controllers/product');
const authenticateJWT = require('../middleware/auth');
const authorize = require('../middleware/rbac');

const router = express.Router();

// All routes here require JWT authentication
router.use(authenticateJWT);

// Publicly viewable products by any authenticated user (Farmers, Pengepul, Pabrik, Kurir, Admin)
router.get('/', getAllProducts);

// Specific farmer's own products list (Farmer only)
router.get('/farmer', authorize('Petani'), getProductsByFarmer);

// Product creation (Farmer only)
router.post('/', authorize('Petani'), createProduct);

// Product update & delete (Farmer only, owner-scoped checks inside controller)
router.put('/:id', authorize('Petani'), updateProduct);
router.delete('/:id', authorize('Petani'), deleteProduct);

module.exports = router;
