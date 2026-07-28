CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  barcode TEXT UNIQUE,
  category TEXT NOT NULL,
  brand TEXT,
  size TEXT,
  color TEXT,
  purchase_price REAL NOT NULL DEFAULT 0,
  selling_price REAL NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 0,
  min_stock INTEGER NOT NULL DEFAULT 0,
  supplier_id INTEGER,
  image TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  supplier_id INTEGER,
  total REAL NOT NULL DEFAULT 0,
  paid REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'paid',
  notes TEXT
);
CREATE TABLE IF NOT EXISTS purchase_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  purchase_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  price REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS sales (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  subtotal REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  total REAL NOT NULL DEFAULT 0,
  profit REAL NOT NULL DEFAULT 0,
  paid REAL NOT NULL DEFAULT 0,
  returned INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sale_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sale_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  price REAL NOT NULL,
  cost REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  category TEXT NOT NULL,
  amount REAL NOT NULL,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS supplier_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  supplier_id INTEGER NOT NULL,
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

INSERT INTO suppliers (name, phone, address)
SELECT 'مورد الأحذية الرئيسي','01000000000','القاهرة'
WHERE NOT EXISTS (SELECT 1 FROM suppliers);

INSERT INTO suppliers (name, phone, address)
SELECT 'مؤسسة الشبشب','01111111111','الإسكندرية'
WHERE (SELECT COUNT(*) FROM suppliers) < 2;

INSERT INTO products (name,barcode,category,brand,size,color,purchase_price,selling_price,quantity,min_stock,supplier_id)
SELECT 'حذاء نايك رياضي','1001','shoes','Nike','42','أسود',600,900,15,5,1
WHERE NOT EXISTS (SELECT 1 FROM products);

INSERT INTO products (name,barcode,category,brand,size,color,purchase_price,selling_price,quantity,min_stock,supplier_id)
SELECT 'حذاء أديداس','1002','shoes','Adidas','41','أبيض',550,850,8,5,1
WHERE (SELECT COUNT(*) FROM products) < 2;

INSERT INTO products (name,barcode,category,brand,size,color,purchase_price,selling_price,quantity,min_stock,supplier_id)
SELECT 'شبشب صيفي','2001','slippers','Local','40','بني',40,80,30,10,2
WHERE (SELECT COUNT(*) FROM products) < 3;

INSERT INTO products (name,barcode,category,brand,size,color,purchase_price,selling_price,quantity,min_stock,supplier_id)
SELECT 'حزام جلد كلاسيك','3001','slippers','Local','M','أسود',60,150,20,5,2
WHERE (SELECT COUNT(*) FROM products) < 4;
