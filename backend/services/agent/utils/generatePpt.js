
import pptxgenjs from "pptxgenjs";

const COLORS = {
  navy: "172554",
  navyLight: "1E3A8A",
  blue: "3B82F6",
  cyan: "38BDF8",
  white: "FFFFFF",
  background: "F5F7FC",
  text: "25324B",
  muted: "64748B",
  border: "E2E8F0",
  paleBlue: "EAF2FF",
};

const FONTS = {
  heading: "Aptos Display",
  body: "Aptos",
};

const generatePpt = async (data = {}) => {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid presentation data.");
  }

  if (!Array.isArray(data.slides) || data.slides.length === 0) {
    throw new Error("Presentation must contain at least one slide.");
  }

  const ppt = new pptxgenjs();

  ppt.layout = "LAYOUT_WIDE";
  ppt.author = "NoBound AI";
  ppt.subject = data.subtitle || "AI Generated Presentation";
  ppt.title = data.title || "Generated Presentation";
  ppt.company = "NoBound AI";
  ppt.lang = "en-US";

  ppt.theme = {
    headFontFace: FONTS.heading,
    bodyFontFace: FONTS.body,
    lang: "en-US",
  };

  ppt.defineSlideMaster({
    title: "CONTENT_MASTER",
    background: { color: COLORS.background },
    objects: [
      {
        rect: {
          x: 0,
          y: 0,
          w: 0.12,
          h: 7.5,
          line: { color: COLORS.blue, transparency: 100 },
          fill: { color: COLORS.blue },
        },
      },
      {
        line: {
          x: 0.55,
          y: 7.05,
          w: 12.25,
          h: 0,
          line: { color: COLORS.border, width: 1 },
        },
      },
      {
        text: {
          text: "NoBound AI",
          options: {
            x: 0.58,
            y: 7.12,
            w: 3,
            h: 0.18,
            fontFace: FONTS.body,
            fontSize: 8,
            color: COLORS.muted,
            margin: 0,
            breakLine: false,
          },
        },
      },
    ],
    slideNumber: {
      x: 12.15,
      y: 7.1,
      w: 0.55,
      h: 0.22,
      color: COLORS.muted,
      fontFace: FONTS.body,
      fontSize: 9,
      align: "right",
      margin: 0,
    },
  });

  const addText = (slide, text, options = {}) => {
    slide.addText(String(text ?? ""), {
      fontFace: FONTS.body,
      color: COLORS.text,
      margin: 0,
      breakLine: false,
      valign: "mid",
      ...options,
    });
  };

  // ---------- TITLE SLIDE ----------

  const cover = ppt.addSlide();

  cover.background = { color: COLORS.navy };

  // Decorative right-side panels
  cover.addShape("rect", {
    x: 8.9,
    y: 0,
    w: 4.43,
    h: 7.5,
    line: { color: COLORS.navyLight, transparency: 100 },
    fill: { color: COLORS.navyLight },
  });

  cover.addShape("rect", {
    x: 10.65,
    y: 0,
    w: 2.68,
    h: 7.5,
    line: { color: COLORS.blue, transparency: 100 },
    fill: { color: COLORS.blue, transparency: 25 },
  });

  cover.addShape("ellipse", {
    x: 9.4,
    y: 1.05,
    w: 2.5,
    h: 2.5,
    line: { color: COLORS.cyan, width: 2, transparency: 20 },
    fill: { color: COLORS.cyan, transparency: 85 },
  });

  cover.addShape("ellipse", {
    x: 10.25,
    y: 3.25,
    w: 1.6,
    h: 1.6,
    line: { color: COLORS.white, width: 1, transparency: 45 },
    fill: { color: COLORS.white, transparency: 100 },
  });

  cover.addShape("rect", {
    x: 0.8,
    y: 1.0,
    w: 0.75,
    h: 0.07,
    line: { color: COLORS.cyan, transparency: 100 },
    fill: { color: COLORS.cyan },
  });

  addText(cover, "NoBound AI  /  PRESENTATION", {
    x: 0.8,
    y: 1.28,
    w: 6.5,
    h: 0.3,
    fontSize: 11,
    bold: true,
    charSpacing: 2,
    color: COLORS.cyan,
  });

  addText(cover, data.title || "Untitled Presentation", {
    x: 0.8,
    y: 2.0,
    w: 7.3,
    h: 1.65,
    fontFace: FONTS.heading,
    fontSize: 34,
    bold: true,
    color: COLORS.white,
    breakLine: false,
    valign: "mid",
    fit: "shrink",
    paraSpaceAfterPt: 8,
  });

  addText(
    cover,
    data.subtitle || "Ideas, insights, and perspectives",
    {
      x: 0.83,
      y: 3.85,
      w: 6.8,
      h: 0.85,
      fontSize: 18,
      color: "CBD5E1",
      valign: "top",
      breakLine: false,
      fit: "shrink",
    },
  );

  cover.addShape("line", {
    x: 0.83,
    y: 5.45,
    w: 1.15,
    h: 0,
    line: { color: COLORS.blue, width: 3 },
  });

  addText(cover, "Prepared with NoBound AI", {
    x: 0.83,
    y: 5.72,
    w: 4.5,
    h: 0.35,
    fontSize: 12,
    color: COLORS.white,
    bold: true,
  });

  addText(cover, new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }), {
    x: 0.83,
    y: 6.15,
    w: 4.5,
    h: 0.3,
    fontSize: 10,
    color: "CBD5E1",
  });

  // ---------- CONTENT SLIDES ----------

  data.slides.forEach((item, index) => {
    const slide = ppt.addSlide("CONTENT_MASTER");

    const slideTitle = item?.title || `Section ${index + 1}`;

    const points = Array.isArray(item?.points)
      ? item.points
          .map((point) => {
            if (typeof point === "string") return point;
            if (point && typeof point.text === "string") return point.text;
            return "";
          })
          .filter((point) => point.trim())
      : [];

    // Small section label
    addText(slide, `KEY TOPIC  /  ${String(index + 1).padStart(2, "0")}`, {
      x: 0.65,
      y: 0.42,
      w: 6.5,
      h: 0.25,
      fontSize: 9,
      bold: true,
      charSpacing: 1.5,
      color: COLORS.blue,
    });

    // Main slide heading
    addText(slide, slideTitle, {
      x: 0.65,
      y: 0.82,
      w: 11.9,
      h: 0.8,
      fontFace: FONTS.heading,
      fontSize: 27,
      bold: true,
      color: COLORS.navy,
      valign: "mid",
      fit: "shrink",
      breakLine: false,
    });

    // Heading accent
    slide.addShape("rect", {
      x: 0.67,
      y: 1.72,
      w: 0.72,
      h: 0.055,
      line: { color: COLORS.blue, transparency: 100 },
      fill: { color: COLORS.blue },
    });

    // Content panel
    slide.addShape("roundRect", {
      x: 0.65,
      y: 2.02,
      w: 12.0,
      h: 4.72,
      rectRadius: 0.12,
      line: { color: COLORS.border, width: 0.8 },
      fill: { color: COLORS.white },
      shadow: {
        type: "outer",
        color: "94A3B8",
        blur: 1,
        angle: 45,
        distance: 1,
        opacity: 0.08,
      },
    });

    if (points.length === 0) {
      addText(slide, "No content available for this slide.", {
        x: 1.0,
        y: 2.45,
        w: 10.8,
        h: 0.5,
        fontSize: 16,
        color: COLORS.muted,
      });
      return;
    }

    // Dynamically distribute bullet rows within the panel.
    const panelTop = 2.22;
    const panelBottom = 6.52;
    const rowHeight = Math.min(
      0.86,
      (panelBottom - panelTop) / points.length,
    );

    points.forEach((point, pointIndex) => {
      const y = panelTop + pointIndex * rowHeight;
      const textHeight = rowHeight - 0.08;

      // Bullet marker
      slide.addShape("ellipse", {
        x: 0.98,
        y: y + (textHeight - 0.12) / 2,
        w: 0.12,
        h: 0.12,
        line: { color: COLORS.blue, transparency: 100 },
        fill: { color: COLORS.blue },
      });

      // Bullet text
      addText(slide, point, {
        x: 1.28,
        y,
        w: 10.85,
        h: textHeight,
        fontSize: points.length >= 6 ? 14 : 16,
        color: COLORS.text,
        valign: "mid",
        breakLine: false,
        fit: "shrink",
        paraSpaceAfterPt: 4,
      });

      // Row divider
      if (pointIndex < points.length - 1) {
        slide.addShape("line", {
          x: 1.28,
          y: y + rowHeight - 0.015,
          w: 10.8,
          h: 0,
          line: {
            color: COLORS.border,
            transparency: 35,
            width: 0.6,
          },
        });
      }
    });
  });

  // ---------- CLOSING SLIDE ----------

  const closing = ppt.addSlide();
  closing.background = { color: COLORS.navy };

  closing.addShape("rect", {
    x: 0,
    y: 0,
    w: 0.15,
    h: 7.5,
    line: { color: COLORS.blue, transparency: 100 },
    fill: { color: COLORS.blue },
  });

  closing.addShape("ellipse", {
    x: 9.2,
    y: 1.5,
    w: 2.5,
    h: 2.5,
    line: { color: COLORS.cyan, width: 2, transparency: 25 },
    fill: { color: COLORS.cyan, transparency: 85 },
  });

  closing.addShape("ellipse", {
    x: 10.4,
    y: 3.3,
    w: 1.35,
    h: 1.35,
    line: { color: COLORS.white, width: 1, transparency: 50 },
    fill: { color: COLORS.white, transparency: 100 },
  });

  addText(closing, "THANK YOU", {
    x: 0.9,
    y: 2.15,
    w: 7.3,
    h: 0.4,
    fontSize: 12,
    bold: true,
    charSpacing: 3,
    color: COLORS.cyan,
  });

  addText(closing, "Questions & Discussion", {
    x: 0.9,
    y: 2.8,
    w: 8.0,
    h: 1.0,
    fontFace: FONTS.heading,
    fontSize: 32,
    bold: true,
    color: COLORS.white,
    fit: "shrink",
  });

  addText(closing, "Prepared with NoBound AI", {
    x: 0.92,
    y: 4.05,
    w: 5.0,
    h: 0.4,
    fontSize: 15,
    color: "CBD5E1",
  });

  // Return a Node.js Buffer for HTTP responses or file uploads.
  const buffer = await ppt.write({
    outputType: "nodebuffer",
  });

  return buffer;
};

export default generatePpt;
