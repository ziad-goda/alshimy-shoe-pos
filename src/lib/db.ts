// AL SHIMY POS — Database layer.
// Dual runtime:
//   * In the browser (Lovable web preview): sql.js + IndexedDB (localforage).
//   * Inside Tauri v2 desktop build: @tauri-apps/plugin-sql (native SQLite).
// The exported API (getDb, query, queryOne, exec, subscribe, exportBackup,
// restoreBackup, resetDb) is identical in both runtimes so the rest of the
// application does not change.

import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic } from "sql.js";
import localforage from "localforage";

// ---------------------------------------------------------------------------
// Runtime detection
// ---------------------------------------------------------------------------
const isTauri = typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;

// Shared change-notification bus (same for both runtimes)
const listeners = new Set<() => void>();
export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function notify() {
  listeners.forEach((l) => l());
}

// ---------------------------------------------------------------------------
// Schema (identical in both runtimes)
// ---------------------------------------------------------------------------
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

const SEED_SUPPLIERS = `INSERT INTO suppliers (name, phone, address) VALUES
  ('مورد الأحذية الرئيسي','01000000000','القاهرة'),
  ('مؤسسة الشبشب','01111111111','الإسكندرية');`;

const SEED_PRODUCTS = `INSERT INTO products (name,barcode,category,brand,size,color,purchase_price,selling_price,quantity,min_stock,supplier_id) VALUES
  ('حذاء نايك رياضي','1001','shoes','Nike','42','أسود',600,900,15,5,1),
  ('حذاء أديداس','1002','shoes','Adidas','41','أبيض',550,850,8,5,1),
  ('شبشب صيفي','2001','slippers','Local','40','بني',40,80,30,10,2),
  ('حزام جلد كلاسيك','3001','slippers','Local','M','أسود',60,150,20,5,2);`;

// Split a multi-statement SQL string into individual statements (naive but
// sufficient for our schema — no semicolons inside string literals).
function splitStatements(sql: string): string[] {
  return sql
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ===========================================================================
// TAURI RUNTIME (native SQLite via @tauri-apps/plugin-sql)
// ===========================================================================
type TauriDb = {
  execute: (query: string, bindValues?: unknown[]) => Promise<{ rowsAffected: number; lastInsertId?: number }>;
  select: <T = unknown>(query: string, bindValues?: unknown[]) => Promise<T[]>;
  close: () => Promise<boolean>;
};

const TAURI_DB_URL = "sqlite:alshimy.db";
let tauriDb: TauriDb | null = null;
let tauriReady: Promise<TauriDb> | null = null;

async function initTauri(): Promise<TauriDb> {
  if (tauriDb) return tauriDb;
  if (tauriReady) return tauriReady;
  tauriReady = (async () => {
    // @ts-ignore — resolved at runtime inside the Tauri build only
    const mod = await import(/* @vite-ignore */ "@tauri-apps/plugin-sql");
    const Database = (mod as any).default;
    const d = (await Database.load(TAURI_DB_URL)) as unknown as TauriDb;

    // Apply schema
    for (const stmt of splitStatements(SCHEMA)) {
      await d.execute(stmt);
    }
    // Seed if empty
    const rows = await d.select<{ c: number }>("SELECT COUNT(*) AS c FROM products");
    if ((rows[0]?.c ?? 0) === 0) {
      for (const stmt of splitStatements(SEED_SUPPLIERS)) await d.execute(stmt);
      for (const stmt of splitStatements(SEED_PRODUCTS)) await d.execute(stmt);
    }
    tauriDb = d;
    return d;
  })();
  return tauriReady;
}

// ===========================================================================
// WEB RUNTIME (sql.js + localforage) — legacy path, kept for Lovable preview
// ===========================================================================
const STORAGE_KEY = "alshimy-db-v1";
let SQL: SqlJsStatic | null = null;
let webDb: SqlJsDatabase | null = null;
let webReady: Promise<SqlJsDatabase> | null = null;

localforage.config({ name: "alshimy-pos", storeName: "sqlite" });

async function persistWeb() {
  if (!webDb) return;
  const bytes = webDb.export();
  await localforage.setItem(STORAGE_KEY, bytes);
}

async function initWeb(): Promise<SqlJsDatabase> {
  if (webDb) return webDb;
  if (webReady) return webReady;
  webReady = (async () => {
    SQL = await initSqlJs({
      locateFile: () => new URL("sql-wasm.wasm", document.baseURI).href,
    });
    const saved = await localforage.getItem<Uint8Array>(STORAGE_KEY);
    webDb = saved ? new SQL.Database(new Uint8Array(saved)) : new SQL.Database();
    webDb.run(SCHEMA);
    const r = webDb.exec("SELECT COUNT(*) as c FROM products");
    const count = (r[0]?.values?.[0]?.[0] as number) ?? 0;
    if (count === 0) {
      webDb.run(SEED_SUPPLIERS);
      webDb.run(SEED_PRODUCTS);
      await persistWeb();
    }
    return webDb;
  })();
  return webReady;
}

// ===========================================================================
// PUBLIC API — identical shape across runtimes
// ===========================================================================

/**
 * Returns the underlying database handle.
 * NOTE: In the web runtime this is a sql.js `Database` (has `.prepare`, `.run`,
 * `.exec`). In the Tauri runtime the raw handle is different — call sites that
 * need portability should use `query` / `exec` / `queryOne` instead of the
 * returned handle directly.
 */
export async function getDb(): Promise<SqlJsDatabase> {
  return (isTauri ? (initTauri() as unknown as Promise<SqlJsDatabase>) : initWeb());
}

/** Run a write / DDL statement. */
export async function exec(sql: string, params: unknown[] = []): Promise<void> {
  if (isTauri) {
    const d = await initTauri();
    await d.execute(sql, params);
  } else {
    const d = await initWeb();
    d.run(sql, params as never);
    await persistWeb();
  }
  notify();
}

/** Run a SELECT and return all rows. */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  if (isTauri) {
    const d = await initTauri();
    return d.select<T>(sql, params);
  }
  const d = await initWeb();
  const stmt = d.prepare(sql);
  stmt.bind(params as never);
  const rows: T[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject() as T);
  stmt.free();
  return rows;
}

/** Run a SELECT and return the first row (or undefined). */
export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<T | undefined> {
  const rows = await query<T>(sql, params);
  return rows[0];
}

/** Export the raw SQLite database as bytes (for user-side backup). */
export async function exportBackup(): Promise<Uint8Array> {
  if (isTauri) {
    // Read the SQLite file from the Tauri app-data directory.
    const [pathMod, fsMod] = await Promise.all([
      import(/* @vite-ignore */ "@tauri-apps/api/path" as any) as Promise<any>,
      import(/* @vite-ignore */ "@tauri-apps/plugin-fs" as any) as Promise<any>,
    ]);
    const dir = await pathMod.appDataDir();
    const path = await pathMod.join(dir, "alshimy.db");
    const bytes = await fsMod.readFile(path);
    return new Uint8Array(bytes);
  }
  const d = await initWeb();
  return d.export();
}

/** Replace the current database with the provided bytes. */
export async function restoreBackup(bytes: Uint8Array): Promise<void> {
  if (isTauri) {
    const [pathMod, fsMod] = await Promise.all([
      import(/* @vite-ignore */ "@tauri-apps/api/path" as any) as Promise<any>,
      import(/* @vite-ignore */ "@tauri-apps/plugin-fs" as any) as Promise<any>,
    ]);
    const dir = await pathMod.appDataDir();
    if (!(await fsMod.exists(dir))) await fsMod.mkdir(dir, { recursive: true });
    const path = await pathMod.join(dir, "alshimy.db");

    // Close current connection before overwriting the underlying file.
    if (tauriDb) {
      try {
        await tauriDb.close();
      } catch {
        /* ignore */
      }
      tauriDb = null;
      tauriReady = null;
    }
    await fsMod.writeFile(path, bytes);
    await initTauri(); // reopen
    notify();
    return;
  }
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: () => new URL("sql-wasm.wasm", document.baseURI).href,
    });
  }
  webDb = new SQL.Database(new Uint8Array(bytes));
  await persistWeb();
  notify();
}

/** Wipe the database and reseed with defaults. */
export async function resetDb(): Promise<void> {
  if (isTauri) {
    const d = await initTauri();
    const tables = [
      "sale_items",
      "sales",
      "purchase_items",
      "purchases",
      "supplier_payments",
      "expenses",
      "products",
      "suppliers",
      "settings",
    ];
    for (const t of tables) await d.execute(`DELETE FROM ${t}`);
    for (const t of tables) {
      await d.execute("DELETE FROM sqlite_sequence WHERE name = ?", [t]).catch(() => {});
    }
    for (const stmt of splitStatements(SEED_SUPPLIERS)) await d.execute(stmt);
    for (const stmt of splitStatements(SEED_PRODUCTS)) await d.execute(stmt);
    notify();
    return;
  }
  await localforage.removeItem(STORAGE_KEY);
  webDb = null;
  webReady = null;
  await initWeb();
  notify();
}
