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
    
    // 真实名单兜底
    const defaultLeaders = ["王总", "卢总", "寿总", "黄总"];
    
    const defaultGroup2 = [
      "倪丹", "鲁栋栋", "吴斐斐", "宋柯佳", "周华康", "张健", "周楚明", 
      "李永富", "厉阳", "张伟", "龙志文", "栾明学", "康怿涵", "闫胜元"
    ];
    
    const defaultGroup4 = [
      "潘琰", "孔祥福", "陈骏宇", "傅承雄", "何林飞", "宋荣", "李泽州", 
      "郑力玮", "贺思", "徐俊超", "王宇涵", "董银燕", "许忆恩"
    ];
    
    const defaultGroup5 = [
      "李杰", "罗进珮", "高燕煦", "金戈愉", "许楷文", "刘景力", "汪新涛", 
      "李乐天", "马奕骏"
    ];

    const defaultGuests = ["叶剑", "郭凡玉", "孔冷", "陈峰"];

    const values = [];
    defaultLeaders.forEach(n => values.push([n, '领导组', 'leader']));
    defaultGroup2.forEach(n => values.push([n, '二团', 'employee']));
    defaultGroup4.forEach(n => values.push([n, '四团', 'employee']));
    defaultGroup5.forEach(n => values.push([n, '五团', 'employee']));
    defaultGuests.forEach(n => values.push([n, '特邀嘉宾', 'employee']));

    await p.query('INSERT INTO users (name, group_name, role) VALUES ?', [values]);
  }
}

module.exports = { pool, initDB };
