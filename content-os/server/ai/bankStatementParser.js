// Automated Bank Statement PDF Extractor for Pakistani Banks
// Parses monthly statements from Meezan, HBL, Nayapay, Sadapay, MCB, etc.,
// extracts tabular transactions using an LLM, and inserts them into SQLite.
import { PDFParse } from "pdf-parse";
import { chat } from "./openrouter.js";
import { insertTransaction } from "../db.js";

/**
 * Parse a PDF bank statement buffer and extract transactions into SQLite.
 *
 * @param {Buffer} pdfBuffer - The uploaded PDF file buffer
 * @returns {Promise<object>} { count, transactions }
 */
export async function parseBankStatementPdf(pdfBuffer) {
  // 1. Extract raw text from PDF
  const parser = new PDFParse({ data: pdfBuffer });
  let fullText = "";
  try {
    const textResult = await parser.getText();
    fullText = (textResult.text || "").trim();
  } finally {
    await parser.destroy();
  }

  if (!fullText || fullText.length < 50) {
    throw new Error("Unable to extract text from PDF. The document might be image-only/scanned.");
  }

  // 2. Pass text to LLM for tabular transaction extraction
  const prompt = `
You are an expert Pakistani banking ledger parser.
Extract all debit/credit transactions from the following bank statement text (Meezan Bank, HBL, Sadapay, Nayapay, Bank Alfalah, MCB, etc.).

Statement Text:
"""
${fullText.slice(0, 12000)}
"""

Extract all individual transactions into a valid JSON array of objects. Do NOT include markdown code fences or backticks.
Schema for each object:
{
  "occurred_at": "YYYY-MM-DD",
  "amount": 1250.00,
  "type": "expense" | "income",
  "category": "Food" | "Bills" | "Shopping" | "Transfer" | "Cloud/Dev" | "Salary" | "Subscription" | "Travel" | "General",
  "description": "Clean merchant or transaction description (e.g. Nayapay Wallet Load, AWS EMEA, Shell Petrol, Careem)",
  "reference": "Transaction reference or ID if present, else empty string"
}

Rules:
- Debit = expense, Credit = income
- All amounts must be positive numbers in PKR
- If year is missing from dates, assume current year
- Filter out balance rows, opening/closing balances, and fee warnings
- Output ONLY pure JSON array: [{"occurred_at": ...}, ...]
`.trim();

  const response = await chat([{ role: "user", content: prompt }], {
    temperature: 0.1,
  });

  const cleaned = response.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();

  let transactions = [];
  try {
    transactions = JSON.parse(cleaned);
  } catch (err) {
    // Attempt regex extraction of array if wrapped with commentary
    const match = cleaned.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (match) {
      transactions = JSON.parse(match[0]);
    } else {
      throw new Error(`Failed to parse extracted transactions: ${err.message}`);
    }
  }

  if (!Array.isArray(transactions) || transactions.length === 0) {
    return { count: 0, transactions: [] };
  }

  // 3. Insert into SQLite transactions table
  let inserted = 0;
  const insertedList = [];

  for (const t of transactions) {
    if (!t.amount || Number(t.amount) <= 0) continue;
    const record = {
      occurred_at: t.occurred_at || new Date().toISOString().slice(0, 10),
      amount: Number(t.amount),
      currency: "PKR",
      type: t.type === "income" ? "income" : "expense",
      category: t.category || "General",
      description: t.description || "Bank Statement Transaction",
      raw_source: `Statement PDF (${t.reference || "ref"})`,
    };

    try {
      insertTransaction(record);
      inserted++;
      insertedList.push(record);
    } catch {
      // Ignore duplicate / constraint collisions
    }
  }

  return {
    count: inserted,
    transactions: insertedList,
  };
}
