// src/config/database.js
const mysql = require('mysql2');

const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'paynroll',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 2, // Changed from 5 to 2
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

const promisePool = pool.promise();

// Test connection with proper cleanup
const testConnection = async () => {
  let connection;
  try {
    connection = await promisePool.getConnection();
    await connection.query('SELECT 1');
    console.log('✅ MySQL Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    // Don't exit immediately in production, allow retries
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  } finally {
    if (connection) connection.release();
  }
};

testConnection();

// Graceful shutdown
process.on('SIGINT', () => {
  pool.end((err) => {
    if (err) {
      console.error('Error closing database pool:', err);
    } else {
      console.log('Database pool closed');
    }
    process.exit(err ? 1 : 0);
  });
});

module.exports = promisePool;
