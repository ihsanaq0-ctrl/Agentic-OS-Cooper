import { getAllSettings } from "../db.js";
import { config } from "../config.js";

export const ok = (res, data) => res.json(data);
export const fail = (res, code, msg) => res.status(code).json({ error: msg });
export const asyncRoute = (fn) => (req, res) =>
  Promise.resolve(fn(req, res)).catch((err) => fail(res, 500, err.message));

export function todayISODate() {
  const tz = getAllSettings().timezone || config.defaults.timezone;
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function shiftDays(isoDate, days) {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function rangeToDates(range, customFrom, customTo) {
  const today = todayISODate();
  switch (range) {
    case "today": return { from: today, to: today };
    case "week": return { from: shiftDays(today, -6), to: today };
    case "year": return { from: `${today.slice(0, 4)}-01-01`, to: today };
    case "custom": return { from: customFrom || `${today.slice(0, 4)}-01-01`, to: customTo || today };
    case "month":
    default: return { from: `${today.slice(0, 7)}-01`, to: today };
  }
}

export function daysForRange(range, customFrom, customTo) {
  const { from, to } = rangeToDates(range, customFrom, customTo);
  const ms = new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime();
  return Math.max(1, Math.ceil(ms / 86400000) + 1);
}
