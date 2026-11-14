// LinkedIn PDF Carousel Generator for AI/ML Engineering & Tech Insights.
// Decomposes technical topics or research papers into a 5-slide structured deck,
// and renders high-resolution 1080x1350 branded PDF slides.
import PDFDocument from "pdfkit";
import { createWriteStream, mkdirSync } from "fs";
import { join } from "path";
import { chat } from "./openrouter.js";
import { ROOT_DIR } from "../config.js";

const CAROUSELS_DIR = join(ROOT_DIR, "storage", "carousels");
mkdirSync(CAROUSELS_DIR, { recursive: true });

/**
 * Distill a technical topic or article into structured carousel slides.
 *
 * @param {string} content - Topic description, research paper abstract, or article text
 * @param {object} opts - { brandVoice, numSlides }
 * @returns {Promise<object>} Structured carousel JSON
 */
export async function generateCarouselContent(content, { brandVoice = "", numSlides = 5 } = {}) {
  const prompt = `
You are an expert AI/ML technical content creator for LinkedIn. 
Decompose the following technical content/topic into a high-engagement, ${numSlides}-slide LinkedIn PDF carousel.

Content:
"""
${content.slice(0, 3000)}
"""

Target Audience: AI/ML Engineers, Researchers, Founders, and Tech Leaders.
Brand Voice: ${brandVoice || "Deeply technical, crisp, authoritative, zero fluff."}

Format the response strictly as valid JSON with NO markdown code fences or backticks. Follow this structure:
{
  "title": "Short Main Title (Max 6 words)",
  "subtitle": "Subtitle explaining the takeaway",
  "slides": [
    {
      "slideNumber": 1,
      "tag": "HOOK & PROBLEM",
      "headline": "Bold Statement or Question",
      "body": "2 short punchy sentences defining why this matters right now.",
      "callout": "Key insight, metric, or architectural pain point"
    },
    {
      "slideNumber": 2,
      "tag": "CORE BOTTLENECK",
      "headline": "What Traditional Approaches Miss",
      "body": "Point 1 explaining the failure mode.\\nPoint 2 explaining the cost/latency bottleneck.",
      "callout": "e.g. 70% of multi-agent failures happen during tool handoff"
    },
    {
      "slideNumber": 3,
      "tag": "SYSTEM ARCHITECTURE",
      "headline": "The Proposed Architectural Solution",
      "body": "Step-by-step technical breakdown of how the components flow together.",
      "callout": "e.g. Graph-based state machines + speculative tool execution"
    },
    {
      "slideNumber": 4,
      "tag": "ENGINEERING DEEP DIVE",
      "headline": "Key Implementation Patterns & Benchmarks",
      "body": "Specific parameters, evaluation metrics, or production best practices.",
      "callout": "e.g. 3.4x faster convergence with 42% lower token cost"
    },
    {
      "slideNumber": 5,
      "tag": "KEY TAKEAWAY",
      "headline": "Strategic Blueprint for Builders",
      "body": "How engineers should implement this today. What to build vs avoid.",
      "callout": "Save this guide for your next production rollout."
    }
  ]
}
`.trim();

  const response = await chat([{ role: "user", content: prompt }], {
    temperature: 0.4,
  });

  const cleaned = response.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // Fallback if LLM returned non-JSON
    return {
      title: "AI Architecture Blueprint",
      subtitle: "Technical Breakdown & Strategic Implementation",
      slides: [
        {
          slideNumber: 1,
          tag: "OVERVIEW",
          headline: "Next-Gen AI Systems",
          body: content.slice(0, 150),
          callout: "Engineered for high-throughput production",
        },
        {
          slideNumber: 2,
          tag: "ANALYSIS",
          headline: "Technical Constraints",
          body: "Overcoming state drift and token degradation in long agentic runs.",
          callout: "Deterministic evaluation is required",
        },
        {
          slideNumber: 3,
          tag: "TAKEAWAY",
          headline: "Strategic Summary",
          body: "Build modular pipelines with strict schema boundaries.",
          callout: "Save and implement in your stack",
        },
      ],
    };
  }
}

/**
 * Render structured carousel slides into a vertical PDF document (1080x1350 pt).
 *
 * @param {object} carouselData - { title, subtitle, slides: [...] }
 * @param {object} opts - { authorName }
 * @returns {Promise<object>} { pdfPath, relativePath, filename }
 */
export async function renderCarouselPdf(carouselData, { authorName = "IHSAN ULLAH" } = {}) {
  const filename = `carousel-${Date.now()}.pdf`;
  const filePath = join(CAROUSELS_DIR, filename);

  const width = 1080;
  const height = 1350;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: [width, height],
      margins: { top: 80, bottom: 80, left: 90, right: 90 },
      autoFirstPage: false,
    });

    const stream = createWriteStream(filePath);
    doc.pipe(stream);

    const slides = carouselData.slides || [];
    const totalSlides = slides.length;

    slides.forEach((slide, idx) => {
      doc.addPage({ size: [width, height] });

      // 1. Deep Dark Background
      doc.rect(0, 0, width, height).fill("#0a0d14");

      // 2. Gradient-like Accent Top Border Bar
      doc.rect(0, 0, width, 14).fill("#00f0ff");
      doc.rect(0, 14, width, 4).fill("#7000ff");

      // 3. Header: Author Tag & Slide Counter Pill
      const topY = 70;
      doc.fontSize(16).fillColor("#00f0ff").text(authorName.toUpperCase() + "  |  AI & ML SYSTEMS", 90, topY, {
        characterSpacing: 2,
      });

      // Slide Counter Pill
      const pillText = `SLIDE  ${String(idx + 1).padStart(2, "0")} / ${String(totalSlides).padStart(2, "0")}`;
      doc.fontSize(16).fillColor("#94a3b8").text(pillText, width - 260, topY, {
        align: "right",
        width: 170,
        characterSpacing: 1.5,
      });

      // Top divider
      doc.moveTo(90, 110).lineTo(width - 90, 110).strokeColor("#1e293b").lineWidth(1.5).stroke();

      // 4. Slide Category Tag
      const tagY = 190;
      doc.fontSize(20).fillColor("#38bdf8").text((slide.tag || "INSIGHT").toUpperCase(), 90, tagY, {
        characterSpacing: 2.5,
      });

      // 5. Main Slide Headline (Punchy & Bold)
      const headY = tagY + 45;
      doc.fontSize(52).fillColor("#f8fafc").text(slide.headline || carouselData.title, 90, headY, {
        width: width - 180,
        lineGap: 10,
      });

      // 6. Slide Body Content (Multi-line or Bullet points)
      const bodyY = headY + 180;
      const bodyText = (slide.body || "").replace(/\\n/g, "\n");
      doc.fontSize(28).fillColor("#cbd5e1").text(bodyText, 90, bodyY, {
        width: width - 180,
        lineGap: 16,
      });

      // 7. Callout / Architecture Highlight Card Box
      if (slide.callout) {
        const boxY = height - 420;
        const boxHeight = 180;
        const boxWidth = width - 180;

        // Card background
        doc.roundedRect(90, boxY, boxWidth, boxHeight, 18).fill("#131c2e");
        // Card left accent bar
        doc.roundedRect(90, boxY, 12, boxHeight, 6).fill("#00f0ff");

        // Card Content
        doc.fontSize(18).fillColor("#38bdf8").text("KEY ARCHITECTURAL TAKEAWAY", 130, boxY + 30, {
          characterSpacing: 2,
        });

        doc.fontSize(26).fillColor("#f1f5f9").text(slide.callout, 130, boxY + 70, {
          width: boxWidth - 70,
          lineGap: 8,
        });
      }

      // 8. Footer: Swipe Cue or Call to Action
      const footerY = height - 120;
      doc.moveTo(90, footerY - 20).lineTo(width - 90, footerY - 20).strokeColor("#1e293b").lineWidth(1.5).stroke();

      doc.fontSize(18).fillColor("#64748b").text("Agentic OS  •  Autonomous Intelligence", 90, footerY);

      const isLast = idx === totalSlides - 1;
      const navText = isLast ? "FOLLOW FOR MORE  ✦" : "SWIPE  >>>";
      const navColor = isLast ? "#00f0ff" : "#cbd5e1";
      doc.fontSize(20).fillColor(navColor).text(navText, width - 320, footerY, {
        align: "right",
        width: 230,
        characterSpacing: 1.5,
      });
    });

    doc.end();

    stream.on("finish", () => {
      resolve({
        path: filePath,
        relativePath: `/storage/carousels/${filename}`,
        filename,
      });
    });

    stream.on("error", (err) => reject(err));
  });
}
