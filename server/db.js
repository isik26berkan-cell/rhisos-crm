const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const { randomUUID } = require("crypto");

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4",
});

const nowIso = () => new Date().toISOString();
const newId = () => randomUUID();

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    created_at VARCHAR(50)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    company VARCHAR(255) DEFAULT '',
    email VARCHAR(255) DEFAULT '',
    phone VARCHAR(100) DEFAULT '',
    address TEXT,
    notes TEXT,
    created_at VARCHAR(50)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS quotes (
    id VARCHAR(36) PRIMARY KEY,
    quote_number VARCHAR(50),
    customer_id VARCHAR(36),
    customer_name VARCHAR(255),
    title VARCHAR(255),
    currency VARCHAR(10) DEFAULT 'TRY',
    notes TEXT,
    valid_until VARCHAR(20) DEFAULT '',
    status VARCHAR(20) DEFAULT 'pending',
    subtotal DOUBLE DEFAULT 0,
    vat_total DOUBLE DEFAULT 0,
    discount DOUBLE DEFAULT 0,
    grand_total DOUBLE DEFAULT 0,
    paid_total DOUBLE DEFAULT 0,
    created_at VARCHAR(50),
    created_by VARCHAR(255),
    emailed_at VARCHAR(50) NULL,
    emailed_to VARCHAR(255) NULL,
    INDEX idx_quotes_customer (customer_id),
    CONSTRAINT fk_quote_customer FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS quote_items (
    id VARCHAR(36) PRIMARY KEY,
    quote_id VARCHAR(36) NOT NULL,
    description TEXT,
    quantity DOUBLE DEFAULT 1,
    unit_price DOUBLE DEFAULT 0,
    vat_rate DOUBLE DEFAULT 20,
    position INT DEFAULT 0,
    INDEX idx_items_quote (quote_id),
    CONSTRAINT fk_item_quote FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(36) PRIMARY KEY,
    quote_id VARCHAR(36) NOT NULL,
    amount DOUBLE DEFAULT 0,
    date VARCHAR(20),
    method VARCHAR(20) DEFAULT 'cash',
    note TEXT,
    INDEX idx_pay_quote (quote_id),
    CONSTRAINT fk_pay_quote FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS transactions (
    id VARCHAR(36) PRIMARY KEY,
    type VARCHAR(20),
    amount DOUBLE DEFAULT 0,
    category VARCHAR(255),
    payment_method VARCHAR(20) DEFAULT 'cash',
    description TEXT,
    date VARCHAR(20),
    currency VARCHAR(10) DEFAULT 'TRY',
    quote_id VARCHAR(36) NULL,
    payment_id VARCHAR(36) NULL,
    auto TINYINT(1) DEFAULT 0,
    created_at VARCHAR(50),
    INDEX idx_txn_type (type),
    INDEX idx_txn_date (date),
    INDEX idx_txn_quote (quote_id),
    INDEX idx_txn_payment (payment_id),
    CONSTRAINT fk_txn_quote FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS settings (
    \`key\` VARCHAR(50) PRIMARY KEY,
    company_name VARCHAR(255) DEFAULT 'Rhisos Mobilya',
    tagline VARCHAR(255) DEFAULT '',
    address TEXT,
    phone VARCHAR(100) DEFAULT '',
    email VARCHAR(255) DEFAULT '',
    website VARCHAR(255) DEFAULT '',
    tax_office VARCHAR(255) DEFAULT '',
    tax_number VARCHAR(100) DEFAULT '',
    logo LONGTEXT
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,

  `CREATE TABLE IF NOT EXISTS login_attempts (
    identifier VARCHAR(255) PRIMARY KEY,
    count INT DEFAULT 0,
    locked_until VARCHAR(50) NULL
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
];

async function seedAdmin() {
  const email = (process.env.ADMIN_EMAIL || "admin@example.com").toLowerCase();
  const pw = process.env.ADMIN_PASSWORD || "admin123";
  const [rows] = await pool.query("SELECT id, password_hash FROM users WHERE email=?", [email]);
  if (rows.length === 0) {
    await pool.query(
      "INSERT INTO users (id,email,password_hash,name,role,created_at) VALUES (?,?,?,?,?,?)",
      [newId(), email, bcrypt.hashSync(pw, 10), "Rhisos Admin", "admin", nowIso()]
    );
    console.log("Admin seeded:", email);
  } else if (!bcrypt.compareSync(pw, rows[0].password_hash)) {
    await pool.query("UPDATE users SET password_hash=? WHERE email=?", [bcrypt.hashSync(pw, 10), email]);
    console.log("Admin password updated:", email);
  }
}

async function initDb() {
  for (const stmt of SCHEMA) {
    await pool.query(stmt);
  }
  await seedAdmin();
  console.log("Database initialized (MySQL/MariaDB).");
}

module.exports = { pool, initDb, nowIso, newId };
