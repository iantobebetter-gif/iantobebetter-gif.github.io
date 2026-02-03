const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'app4',
  password: 'ZJ##88app4',
  database: 'lottery_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function initDB() {
  // Create a connection without database selected to create DB if not exists
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'app4',
    password: 'ZJ##88app4'
  });

  await connection.query(`CREATE DATABASE IF NOT EXISTS lottery_db DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await connection.end();

  // Now use the pool to create tables
  const p = pool;

  // Users Table
  await p.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) NOT NULL UNIQUE,
      group_name VARCHAR(50) NOT NULL,
      role VARCHAR(20) NOT NULL DEFAULT 'employee', -- 'leader' or 'employee'
      is_signed_in BOOLEAN DEFAULT FALSE,
      table_number INT DEFAULT NULL,
      seat_number INT DEFAULT NULL,
      lottery_number VARCHAR(20) DEFAULT NULL,
      seat_label VARCHAR(50) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Config Table (Singleton)
  await p.query(`
    CREATE TABLE IF NOT EXISTS config (
      id INT PRIMARY KEY,
      table_count INT DEFAULT 4,
      seats_per_table INT DEFAULT 8
    )
  `);

  // Insert default config if not exists
  await p.query(`
    INSERT IGNORE INTO config (id, table_count, seats_per_table) VALUES (1, 4, 11)
  `);
  
  // Seed initial data if empty
  const [rows] = await p.query('SELECT COUNT(*) as count FROM users');
  if (rows[0].count === 0) {
    console.log('Seeding default data...');
    const defaultLeaders = ["张总", "李总", "王总", "赵总"];
    const defaultGroup2 = ["王建国", "李建军", "张伟", "王伟", "李娜", "王芳", "李静", "王静"];
    const defaultGroup4 = ["张强", "王强", "李强", "刘伟", "刘洋", "王洋", "李洋", "张洋", "赵军", "孙军", "李军", "王军"];
    const defaultGroup5 = ["张军", "刘军", "陈军", "杨军", "赵强", "孙强", "钱伟", "周伟", "吴伟", "郑伟", "王磊", "李磊"];

    const values = [];
    defaultLeaders.forEach(n => values.push([n, '领导组', 'leader']));
    defaultGroup2.forEach(n => values.push([n, '二团', 'employee']));
    defaultGroup4.forEach(n => values.push([n, '四团', 'employee']));
    defaultGroup5.forEach(n => values.push([n, '五团', 'employee']));

    await p.query('INSERT INTO users (name, group_name, role) VALUES ?', [values]);
  }
}

module.exports = { pool, initDB };
