// AL SHIMY POS — SQLite (sql.js) with IndexedDB persistence via localforage.
// Fully offline. Same code runs inside Electron.
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import localforage from "localforage";

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;
let ready: Promise<Database> | null = null;
const listeners = new Set<() => void>();

const STORAGE_KEY = "alshimy-db-v1";

localforage.config({ name: "alshimy-pos", storeName: "sqlite" });

const SCHEMA = `
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
`;

async function persist() {
  if (!db) return;
  const bytes = db.export();
  await localforage.setItem(STORAGE_KEY, bytes);
  listeners.forEach((l) => l());
}

export async function getDb(): Promise<Database> {
  if (db) return db;
  if (ready) return ready;
  ready = (async () => {
    SQL = await initSqlJs({ locateFile: () => "/sql-wasm.wasm" });
    const saved = await localforage.getItem<Uint8Array>(STORAGE_KEY);
    db = saved ? new SQL.Database(new Uint8Array(saved)) : new SQL.Database();
    db.run(SCHEMA);
    // seed a demo product if empty
    const r = db.exec("SELECT COUNT(*) as c FROM products");
    const count = (r[0]?.values?.[0]?.[0] as number) ?? 0;
    if (count === 0) {
      db.run(
        `INSERT INTO suppliers (name, phone, address) VALUES
          ('مورد الأحذية الرئيسي','01000000000','القاهرة'),
          ('مؤسسة الشبشب','01111111111','الإسكندرية');`
      );
      db.run(
        `INSERT INTO products (name,barcode,category,brand,size,color,purchase_price,selling_price,quantity,min_stock,supplier_id) VALUES
          ('حذاء نايك رياضي','1001','shoes','Nike','42','أسود',600,900,15,5,1),
          ('حذاء أديداس','1002','shoes','Adidas','41','أبيض',550,850,8,5,1),
          ('شبشب صيفي','2001','slippers','Local','40','بني',40,80,30,10,2),
          ('حزام جلد كلاسيك','3001','slippers','Local','M','أسود',60,150,20,5,2);`
      );
      await persist();
    }
    return db;
  })();
  return ready;
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export async function exec(sql: string, params: unknown[] = []) {
  const d = await getDb();
  d.run(sql, params as never);
  await persist();
}

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const d = await getDb();
  const stmt = d.prepare(sql);
  stmt.bind(params as never);
  const rows: T[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as T);
  stmt.free();
  return rows;
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | undefined> {
  const r = await query<T>(sql, params);
  return r[0];
}

export async function exportBackup(): Promise<Uint8Array> {
  const d = await getDb();
  return d.export();
}

export async function restoreBackup(bytes: Uint8Array) {
  if (!SQL) SQL = await initSqlJs({ locateFile: () => "/sql-wasm.wasm" });
  db = new SQL.Database(new Uint8Array(bytes));
  await persist();
}

export async function resetDb() {
  await localforage.removeItem(STORAGE_KEY);
  db = null;
  ready = null;
  await getDb();
}
