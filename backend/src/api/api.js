const router = require('express').Router();

const authRoutes = require('../routes/auth.routes');
const privateRoutes = require('../routes/private.routes');

router.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'API funcionando!',
    });
});

router.use('/auth', authRoutes);
router.use('/private', privateRoutes);

module.exports = router;