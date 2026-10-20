const router = require('express').Router();

router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'harmony-api',
    message: 'API disponível.',
  });
});

module.exports = router;
