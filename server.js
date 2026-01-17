require('dotenv').config();
const app = require('./src/app');
const emailRoutes = require('./src/routes/emailRoutes');

app.use('/api/email', emailRoutes);

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  console.log(🚀 Server running on port ${PORT});
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err.message);
  server.close(() => process.exit(1));
});
