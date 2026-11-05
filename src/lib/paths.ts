import path from "node:path";

/** Filesystem layout for the on-disk data dir (DB + screenshots). */
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), "data");
export const SCREENSHOTS_DIR = path.join(DATA_DIR, "screenshots");
export const DB_PATH = path.join(DATA_DIR, "journal.db");
