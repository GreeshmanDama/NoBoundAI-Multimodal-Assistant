import pptxgen from "pptxgenjs";

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
  paleCyan: "ECFEFF",
  paleGray: "F1F5F9",
  green: "15803D",
};

const FONTS = {
  heading: "Aptos Display",
  body: "Aptos",
};

const PAGE = {
  width: 13.333,
  height: 7.5,
  left: 0.65,
  right: 12.68,
  contentTop: 2.15,
  contentBottom: 6.0,
};

const MAX_SLIDES = 30;
const MAX_TEXT_LENGTH = 2000;

const cleanText = (value, fallback = "") => {
  if (typeof value !== "string") return fallback;

  return (
    value
      .replace(/\u0000/g, "")
      .slice(0, MAX_TEXT_LENGTH)
      .trim() || fallback
  );
};

const isFiniteNumber = (value) =>
  typeof value === "number" && Number.isFinite(value);

const assertValidPresentation = (data) => {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("Invalid presentation data.");
  }

  if (!Array.isArray(data.slides) || data.slides.length === 0) {
    throw new Error("Presentation must contain at least one slide.");
  }

  if (data.slides.length > MAX_SLIDES) {
    throw new Error(`Presentation cannot exceed ${MAX_SLIDES} slides.`);
  }

  const allowedLayouts = new Set([
    "bullets",
    "cards",
    "chart",
    "table",
    "process",
    "comparison",
    "quote",
    "section",
  ]);

  data.slides.forEach((slide, index) => {
    if (
      !slide ||
      typeof slide !== "object" ||
      Array.isArray(slide) ||
      typeof slide.title !== "string" ||
      !slide.title.trim()
    ) {
      throw new Error(`Slide ${index + 1} has an invalid title.`);
    }

    const layout = slide.layout || "bullets";

    if (!allowedLayouts.has(layout)) {
      throw new Error(
        `Slide ${index + 1} has an unsupported layout: ${layout}`,
      );
    }

    switch (layout) {
      case "bullets":
        if (
          !Array.isArray(slide.points) ||
          slide.points.length === 0 ||
          slide.points.length > 8 ||
          !slide.points.every((point) => typeof point === "string")
        ) {
          throw new Error(`Slide ${index + 1} has invalid bullet points.`);
        }
        break;

      case "cards":
        if (
          !Array.isArray(slide.cards) ||
          slide.cards.length < 2 ||
          slide.cards.length > 4 ||
          !slide.cards.every(
            (card) =>
              card &&
              typeof card === "object" &&
              typeof card.heading === "string",
          )
        ) {
          throw new Error(`Slide ${index + 1} has invalid cards.`);
        }
        break;

      case "chart": {
        const chart = slide.chart;
        const chartTypes = ["bar", "line", "pie", "doughnut", "area"];

        if (
          !chart ||
          !chartTypes.includes(chart.type) ||
          !Array.isArray(chart.categories) ||
          chart.categories.length < 1 ||
          chart.categories.length > 12 ||
          !Array.isArray(chart.series) ||
          chart.series.length < 1 ||
          chart.series.length > 5
        ) {
          throw new Error(`Slide ${index + 1} has invalid chart data.`);
        }

        if (
          chart.series.some(
            (series) =>
              !series ||
              !Array.isArray(series.values) ||
              series.values.length !== chart.categories.length ||
              !series.values.every(isFiniteNumber),
          )
        ) {
          throw new Error(
            `Slide ${index + 1} has invalid chart series values.`,
          );
        }

        if (
          ["pie", "doughnut"].includes(chart.type) &&
          (chart.series.length !== 1 ||
            chart.series[0].values.some((value) => value < 0) ||
            chart.series[0].values.every((value) => value === 0))
        ) {
          throw new Error(`Slide ${index + 1} has invalid pie/doughnut data.`);
        }
        break;
      }

      case "table":
        if (
          !slide.table ||
          !Array.isArray(slide.table.headers) ||
          !Array.isArray(slide.table.rows) ||
          slide.table.headers.length < 1 ||
          slide.table.headers.length > 6 ||
          slide.table.rows.length < 1 ||
          slide.table.rows.length > 10 ||
          slide.table.rows.some(
            (row) =>
              !Array.isArray(row) || row.length !== slide.table.headers.length,
          )
        ) {
          throw new Error(`Slide ${index + 1} has invalid table data.`);
        }
        break;

      case "process":
        if (
          !Array.isArray(slide.steps) ||
          slide.steps.length < 2 ||
          slide.steps.length > 6 ||
          !slide.steps.every(
            (step) =>
              step &&
              typeof step.title === "string" &&
              typeof step.description === "string",
          )
        ) {
          throw new Error(`Slide ${index + 1} has invalid process steps.`);
        }
        break;

      case "comparison":
        for (const side of [slide.left, slide.right]) {
          if (
            !side ||
            typeof side.heading !== "string" ||
            !Array.isArray(side.points) ||
            side.points.length < 1 ||
            side.points.length > 6 ||
            !side.points.every((point) => typeof point === "string")
          ) {
            throw new Error(`Slide ${index + 1} has invalid comparison data.`);
          }
        }
        break;

      case "quote":
        if (typeof slide.quote !== "string" || !slide.quote.trim()) {
          throw new Error(`Slide ${index + 1} has an invalid quote.`);
        }
        break;

      case "section":
        break;
    }
  });

  return data;
};

const generatePpt = async (input = {}) => {
  const data = assertValidPresentation(input);
  const ppt = new pptxgen();

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

  // ---------- CONTENT MASTER ----------

  ppt.defineSlideMaster({
    title: "CONTENT_MASTER",
    background: { color: COLORS.background },
    objects: [
      {
        rect: {
          x: 0,
          y: 0,
          w: 0.12,
          h: PAGE.height,
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

  // ---------- SHARED HELPERS ----------

  const addText = (slide, text, options = {}) => {
    slide.addText(String(text ?? ""), {
      fontFace: FONTS.body,
      fontSize: 15,
      color: COLORS.text,
      margin: 0,
      breakLine: false,
      valign: "mid",
      ...options,
    });
  };

  const addPanel = (slide, x, y, w, h, fill = COLORS.white, options = {}) => {
    slide.addShape("roundRect", {
      x,
      y,
      w,
      h,
      rectRadius: 0.12,
      line: {
        color: options.lineColor || COLORS.border,
        width: options.lineWidth ?? 0.8,
      },
      fill: { color: fill },
      ...(options.shadow
        ? {
            shadow: {
              type: "outer",
              color: "94A3B8",
              blur: 1,
              angle: 45,
              distance: 1,
              opacity: 0.08,
            },
          }
        : {}),
    });
  };

  const addBulletList = (
    slide,
    points,
    { x = 1, y = 2.35, w = 11, h = 3.7, fontSize = 16 } = {},
  ) => {
    const items = (points || [])
      .filter((point) => typeof point === "string" && point.trim())
      .slice(0, 8);

    if (!items.length) return;

    const rowHeight = h / items.length;

    items.forEach((point, index) => {
      const rowY = y + index * rowHeight;

      slide.addShape("ellipse", {
        x,
        y: rowY + rowHeight / 2 - 0.055,
        w: 0.11,
        h: 0.11,
        line: { color: COLORS.blue, transparency: 100 },
        fill: { color: COLORS.blue },
      });

      addText(slide, point, {
        x: x + 0.28,
        y: rowY,
        w: w - 0.32,
        h: rowHeight - 0.03,
        fontSize,
        fit: "shrink",
        valign: "mid",
      });
    });
  };

  const addSlideHeader = (slide, item, index) => {
    addText(slide, `KEY TOPIC / ${String(index + 1).padStart(2, "0")}`, {
      x: 0.65,
      y: 0.42,
      w: 6.5,
      h: 0.25,
      fontSize: 9,
      bold: true,
      charSpacing: 1.5,
      color: COLORS.blue,
    });

    addText(slide, cleanText(item.title, `Section ${index + 1}`), {
      x: 0.65,
      y: 0.82,
      w: 11.95,
      h: item.subtitle ? 0.58 : 0.78,
      fontFace: FONTS.heading,
      fontSize: 27,
      bold: true,
      color: COLORS.navy,
      fit: "shrink",
    });

    if (item.subtitle) {
      addText(slide, cleanText(item.subtitle), {
        x: 0.67,
        y: 1.45,
        w: 11.7,
        h: 0.32,
        fontSize: 12,
        color: COLORS.muted,
        fit: "shrink",
      });
    }

    slide.addShape("rect", {
      x: 0.67,
      y: 1.88,
      w: 0.72,
      h: 0.055,
      line: { color: COLORS.blue, transparency: 100 },
      fill: { color: COLORS.blue },
    });
  };

  const addTakeaway = (slide, takeaway) => {
    if (typeof takeaway !== "string" || !takeaway.trim()) return;

    addPanel(slide, 0.68, 6.2, 11.95, 0.55, COLORS.paleBlue);

    addText(slide, "KEY TAKEAWAY", {
      x: 0.9,
      y: 6.29,
      w: 1.55,
      h: 0.25,
      fontSize: 9,
      bold: true,
      color: COLORS.blue,
    });

    addText(slide, cleanText(takeaway), {
      x: 2.4,
      y: 6.26,
      w: 9.95,
      h: 0.32,
      fontSize: 11,
      bold: true,
      color: COLORS.navy,
      fit: "shrink",
    });
  };

  // ---------- TITLE SLIDE ----------

  const cover = ppt.addSlide();
  cover.background = { color: COLORS.navy };

  cover.addShape("rect", {
    x: 8.9,
    y: 0,
    w: 4.433,
    h: PAGE.height,
    line: { color: COLORS.navyLight, transparency: 100 },
    fill: { color: COLORS.navyLight },
  });

  cover.addShape("rect", {
    x: 10.65,
    y: 0,
    w: 2.683,
    h: PAGE.height,
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
    y: 1,
    w: 0.75,
    h: 0.07,
    line: { color: COLORS.cyan, transparency: 100 },
    fill: { color: COLORS.cyan },
  });

  addText(cover, "NoBound AI / PRESENTATION", {
    x: 0.8,
    y: 1.28,
    w: 6.8,
    h: 0.3,
    fontSize: 11,
    bold: true,
    charSpacing: 2,
    color: COLORS.cyan,
  });

  addText(cover, cleanText(data.title, "Untitled Presentation"), {
    x: 0.8,
    y: 2,
    w: 7.4,
    h: 1.65,
    fontFace: FONTS.heading,
    fontSize: 34,
    bold: true,
    color: COLORS.white,
    fit: "shrink",
  });

  addText(
    cover,
    cleanText(data.subtitle, "Ideas, insights, and perspectives"),
    {
      x: 0.83,
      y: 3.85,
      w: 6.8,
      h: 0.85,
      fontSize: 18,
      color: "CBD5E1",
      valign: "top",
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

  addText(
    cover,
    new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    {
      x: 0.83,
      y: 6.15,
      w: 4.5,
      h: 0.3,
      fontSize: 10,
      color: "CBD5E1",
    },
  );

  // ---------- CARDS LAYOUT ----------

  const renderCards = (slide, cards = []) => {
    const items = cards.slice(0, 4);
    if (!items.length) return;

    const gap = 0.2;
    const totalWidth = 11.95;
    const cardWidth = (totalWidth - gap * (items.length - 1)) / items.length;

    items.forEach((card, index) => {
      const x = 0.68 + index * (cardWidth + gap);

      addPanel(slide, x, 2.2, cardWidth, 3.65, COLORS.white, {
        shadow: true,
      });

      slide.addShape("rect", {
        x: x + 0.22,
        y: 2.52,
        w: 0.45,
        h: 0.055,
        line: { color: COLORS.blue, transparency: 100 },
        fill: { color: COLORS.blue },
      });

      addText(slide, cleanText(card.heading, `Metric ${index + 1}`), {
        x: x + 0.22,
        y: 2.78,
        w: cardWidth - 0.44,
        h: 0.48,
        fontSize: 13,
        bold: true,
        color: COLORS.muted,
        fit: "shrink",
      });

      addText(slide, cleanText(card.value, "—"), {
        x: x + 0.22,
        y: 3.4,
        w: cardWidth - 0.44,
        h: 0.85,
        fontFace: FONTS.heading,
        fontSize: 27,
        bold: true,
        color: COLORS.navy,
        fit: "shrink",
      });

      addText(slide, cleanText(card.description), {
        x: x + 0.22,
        y: 4.35,
        w: cardWidth - 0.44,
        h: 0.7,
        fontSize: 11,
        color: COLORS.text,
        valign: "top",
        fit: "shrink",
      });

      if (card.status) {
        addText(slide, cleanText(card.status), {
          x: x + 0.22,
          y: 5.18,
          w: cardWidth - 0.44,
          h: 0.25,
          fontSize: 10,
          bold: true,
          color: COLORS.blue,
          fit: "shrink",
        });
      }
    });
  };

  // ---------- CHART LAYOUT ----------

  const renderChart = (slide, chart) => {
    const chartTypes = {
      bar: "bar",
      line: "line",
      pie: "pie",
      doughnut: "doughnut",
      area: "area",
    };

    const chartType = chartTypes[chart.type];

    if (!chartType) {
      throw new Error(`Unsupported chart type: ${chart.type}`);
    }

    const chartData = chart.series.map((series) => ({
      name: cleanText(series.name, "Series"),
      labels: chart.categories.map((category) => String(category)),
      values: series.values,
    }));

    const isCircular = ["pie", "doughnut"].includes(chart.type);

    slide.addChart(chartType, chartData, {
      x: 0.85,
      y: 2.05,
      w: 11.65,
      h: 3.95,
      showTitle: false,
      showLegend: chart.showLegend ?? chart.series.length > 1,
      legendPos: "b",
      showValue: isCircular,
      showCategoryName: isCircular,
      showPercent: isCircular,
      chartColors: [
        COLORS.blue,
        COLORS.cyan,
        COLORS.navyLight,
        "94A3B8",
        "60A5FA",
      ],
      showBorder: false,
      showMarker: chart.type === "line",
      showCatName: false,
      showValAxis: !isCircular,
      showCatAxis: !isCircular,
      showValAxisTitle: !isCircular && Boolean(chart.yAxisTitle),
      valAxisTitle: cleanText(chart.yAxisTitle),
      showCatAxisTitle: !isCircular && Boolean(chart.xAxisTitle),
      catAxisTitle: cleanText(chart.xAxisTitle),
      catAxisLabelFontFace: FONTS.body,
      catAxisLabelFontSize: 10,
      valAxisLabelFontFace: FONTS.body,
      valAxisLabelFontSize: 9,
      showLeaderLines: isCircular,
      showLine: true,
      showShadow: false,
      showCatName: false,
    });
  };

  // ---------- TABLE LAYOUT ----------

  const renderTable = (slide, table) => {
    const columnCount = table.headers.length;
    const rowCount = table.rows.length;

    const headerRow = table.headers.map((header) => ({
      text: String(header ?? ""),
      options: {
        bold: true,
        color: COLORS.white,
        fill: COLORS.navy,
        margin: 7,
        breakLine: false,
        valign: "mid",
      },
    }));

    const bodyRows = table.rows.map((row, rowIndex) =>
      row.map((value) => ({
        text: String(value ?? ""),
        options: {
          color: COLORS.text,
          fill: rowIndex % 2 === 0 ? COLORS.white : COLORS.paleGray,
          margin: 6,
          breakLine: false,
          valign: "mid",
        },
      })),
    );

    const tableHeight = Math.min(3.9, 0.48 * (rowCount + 1));

    slide.addTable([headerRow, ...bodyRows], {
      x: 0.72,
      y: 2.15,
      w: 11.9,
      h: tableHeight,
      border: {
        type: "solid",
        color: COLORS.border,
        pt: 0.7,
      },
      fontFace: FONTS.body,
      fontSize: rowCount > 7 ? 9 : 11,
      color: COLORS.text,
      autoFit: false,
      rowH: rowCount > 7 ? 0.34 : 0.43,
      colW: Array(columnCount).fill(11.9 / columnCount),
      margin: 0.07,
      valign: "mid",
      breakLine: false,
    });
  };

  // ---------- PROCESS LAYOUT ----------

  const renderProcess = (slide, steps = []) => {
    const items = steps.slice(0, 6);
    if (!items.length) return;

    const gap = 0.17;
    const totalWidth = 11.95;
    const width = (totalWidth - gap * (items.length - 1)) / items.length;

    items.forEach((step, index) => {
      const x = 0.68 + index * (width + gap);

      addPanel(
        slide,
        x,
        2.45,
        width,
        3.0,
        index % 2 === 0 ? COLORS.paleBlue : COLORS.white,
      );

      slide.addShape("ellipse", {
        x: x + 0.18,
        y: 2.72,
        w: 0.48,
        h: 0.48,
        line: { color: COLORS.blue, transparency: 100 },
        fill: { color: COLORS.blue },
      });

      addText(slide, String(index + 1), {
        x: x + 0.18,
        y: 2.81,
        w: 0.48,
        h: 0.22,
        fontSize: 12,
        bold: true,
        color: COLORS.white,
        align: "center",
      });

      addText(slide, cleanText(step.title, `Step ${index + 1}`), {
        x: x + 0.16,
        y: 3.42,
        w: width - 0.32,
        h: 0.65,
        fontSize: 14,
        bold: true,
        color: COLORS.navy,
        fit: "shrink",
      });

      addText(slide, cleanText(step.description), {
        x: x + 0.16,
        y: 4.15,
        w: width - 0.32,
        h: 0.9,
        fontSize: 11,
        color: COLORS.text,
        fit: "shrink",
        valign: "top",
      });

      if (index < items.length - 1) {
        slide.addShape("chevron", {
          x: x + width + 0.015,
          y: 3.5,
          w: gap - 0.03,
          h: 0.28,
          line: { color: COLORS.blue, transparency: 100 },
          fill: { color: COLORS.blue },
        });
      }
    });
  };

  // ---------- COMPARISON LAYOUT ----------

  const renderComparison = (slide, item) => {
    [item.left, item.right].forEach((side, index) => {
      const x = index === 0 ? 0.7 : 6.78;

      addPanel(
        slide,
        x,
        2.25,
        5.85,
        3.75,
        index === 0 ? COLORS.white : COLORS.paleBlue,
      );

      addText(slide, cleanText(side.heading), {
        x: x + 0.28,
        y: 2.55,
        w: 5.25,
        h: 0.5,
        fontSize: 19,
        bold: true,
        color: COLORS.navy,
        fit: "shrink",
      });

      addBulletList(slide, side.points, {
        x: x + 0.3,
        y: 3.2,
        w: 5.15,
        h: 2.35,
        fontSize: 13,
      });
    });
  };

  // ---------- QUOTE LAYOUT ----------

  const renderQuote = (slide, item) => {
    addPanel(slide, 0.85, 2.4, 11.5, 3.2, COLORS.paleBlue);

    addText(slide, "\u201C", {
      x: 1.2,
      y: 2.55,
      w: 0.8,
      h: 0.8,
      fontSize: 48,
      bold: true,
      color: COLORS.blue,
    });

    addText(slide, cleanText(item.quote), {
      x: 1.8,
      y: 2.95,
      w: 9.7,
      h: 1.5,
      fontFace: FONTS.heading,
      fontSize: 23,
      bold: true,
      color: COLORS.navy,
      fit: "shrink",
    });

    if (item.attribution) {
      addText(slide, cleanText(item.attribution), {
        x: 1.82,
        y: 4.65,
        w: 9.4,
        h: 0.35,
        fontSize: 12,
        color: COLORS.muted,
        fit: "shrink",
      });
    }
  };

  // ---------- SECTION DIVIDER ----------

  const renderSection = (slide, item) => {
    slide.background = { color: COLORS.background };

    addPanel(slide, 0.75, 2.45, 11.8, 2.85, COLORS.navy, {
      lineColor: COLORS.navy,
    });

    slide.addShape("rect", {
      x: 0.75,
      y: 2.45,
      w: 0.12,
      h: 2.85,
      line: { color: COLORS.cyan, transparency: 100 },
      fill: { color: COLORS.cyan },
    });

    addText(slide, "SECTION", {
      x: 1.2,
      y: 2.9,
      w: 3,
      h: 0.3,
      fontSize: 10,
      bold: true,
      charSpacing: 2,
      color: COLORS.cyan,
    });

    addText(slide, cleanText(item.title), {
      x: 1.2,
      y: 3.35,
      w: 10.4,
      h: 0.8,
      fontFace: FONTS.heading,
      fontSize: 32,
      bold: true,
      color: COLORS.white,
      fit: "shrink",
    });

    if (item.subtitle) {
      addText(slide, cleanText(item.subtitle), {
        x: 1.22,
        y: 4.3,
        w: 10.2,
        h: 0.45,
        fontSize: 15,
        color: "CBD5E1",
        fit: "shrink",
      });
    }
  };

  // ---------- CONTENT SLIDES ----------

  data.slides.forEach((item, index) => {
    const slide = ppt.addSlide("CONTENT_MASTER");
    const layout = item.layout || "bullets";

    if (layout === "section") {
      renderSection(slide, item);
      return;
    }

    addSlideHeader(slide, item, index);

    switch (layout) {
      case "cards":
        renderCards(slide, item.cards);
        break;

      case "chart":
        renderChart(slide, item.chart);
        break;

      case "table":
        renderTable(slide, item.table);
        break;

      case "process":
        renderProcess(slide, item.steps);
        break;

      case "comparison":
        renderComparison(slide, item);
        break;

      case "quote":
        renderQuote(slide, item);
        break;

      case "bullets":
      default:
        addBulletList(slide, item.points, {
          x: 0.95,
          y: 2.25,
          w: 11.4,
          h: item.takeaway ? 3.65 : 4.15,
          fontSize: 16,
        });
        break;
    }

    addTakeaway(slide, item.takeaway);
  });

  // ---------- CLOSING SLIDE ----------

  const closing = ppt.addSlide();
  closing.background = { color: COLORS.navy };

  closing.addShape("rect", {
    x: 0,
    y: 0,
    w: 0.15,
    h: PAGE.height,
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
    w: 8,
    h: 1,
    fontFace: FONTS.heading,
    fontSize: 32,
    bold: true,
    color: COLORS.white,
    fit: "shrink",
  });

  addText(closing, "Prepared with NoBound AI", {
    x: 0.92,
    y: 4.05,
    w: 5,
    h: 0.4,
    fontSize: 15,
    color: "CBD5E1",
  });

  // Return a Node.js Buffer for your existing uploadPpt() utility.
  const buffer = await ppt.write({
    outputType: "nodebuffer",
  });

  return buffer;
};

export default generatePpt;
