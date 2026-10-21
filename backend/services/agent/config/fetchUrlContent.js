import * as cheerio from "cheerio";

const MAX_CONTENT_LENGTH = 14000;
const REQUEST_TIMEOUT = 10000;

const isPublicWebUrl = (value) => {
  try {
    const url = new URL(value);

    if (!["http:", "https:"].includes(url.protocol)) {
      return false;
    }

    const hostname = url.hostname.toLowerCase();

    // Reject local and common private-network destinations.
    if (
      !hostname ||
      hostname === "localhost" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname === "::1" ||
      hostname.startsWith("127.") ||
      hostname.startsWith("10.") ||
      hostname.startsWith("192.168.") ||
      hostname.startsWith("169.254.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
      hostname === "0.0.0.0"
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
};

const fetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "NoBoundAI/1.0",
      Accept: "text/html, text/plain, application/json",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    redirect: "error",
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return {
    text: await response.text(),
    contentType: response.headers.get("content-type") || "",
  };
};

const extractGitHubContent = async (url) => {
  const segments = url.pathname.split("/").filter(Boolean);
  const owner = segments[0];
  const repo = segments[1]?.replace(/\.git$/, "");

  if (!owner || !repo) {
    return null;
  }

  let apiUrl;

  // https://github.com/owner/repo/blob/main/README.md
  if (segments[2] === "blob" && segments.length >= 5) {
    const branch = segments[3];
    const path = segments.slice(4).join("/");

    apiUrl =
      `https://api.github.com/repos/${encodeURIComponent(owner)}` +
      `/${encodeURIComponent(repo)}/contents/` +
      path.split("/").map(encodeURIComponent).join("/") +
      `?ref=${encodeURIComponent(branch)}`;
  } else {
    // Repository homepage: retrieve its README.
    apiUrl =
      `https://api.github.com/repos/${encodeURIComponent(owner)}` +
      `/${encodeURIComponent(repo)}/readme`;
  }

  const response = await fetch(apiUrl, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "NoBoundAI/1.0",
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT),
    redirect: "error",
  });

  if (!response.ok) {
    throw new Error(`GitHub API returned HTTP ${response.status}`);
  }

  const data = await response.json();

  if (data.encoding === "base64" && data.content) {
    return Buffer.from(data.content, "base64").toString("utf8");
  }

  // GitHub may return a download URL for larger files.
  if (data.download_url) {
    const file = await fetchText(data.download_url);
    return file.text;
  }

  throw new Error("No readable file content was returned");
};

const extractHtmlText = (html) => {
  const $ = cheerio.load(html);

  $("script, style, noscript, iframe, svg, nav, footer, header").remove();

  const title = $("title").first().text().trim();
  const description =
    $('meta[name="description"]').attr("content") || "";

  const content = $("main").length
    ? $("main").text()
    : $("article").length
      ? $("article").text()
      : $("body").text();

  return [
    title && `Title: ${title}`,
    description && `Description: ${description}`,
    content,
  ]
    .filter(Boolean)
    .join("\n")
    .replace(/\s+/g, " ")
    .trim();
};

export const fetchUrlContent = async (inputUrl) => {
  try {
    if (!isPublicWebUrl(inputUrl)) {
      return {
        url: inputUrl,
        success: false,
        content: "",
        error: "Unsupported or non-public URL",
      };
    }

    const url = new URL(inputUrl);

    let content;

    if (url.hostname === "github.com") {
      content = await extractGitHubContent(url);
    } else {
      content = null;
    }

    if (!content) {
      const page = await fetchText(url.href);

      if (page.contentType.includes("application/pdf")) {
        throw new Error(
          "PDF URLs require the document-processing pipeline"
        );
      }

      if (
        page.contentType.includes("application/json") ||
        page.contentType.includes("text/plain")
      ) {
        content = page.text;
      } else if (
        page.contentType.includes("text/html") ||
        !page.contentType
      ) {
        content = extractHtmlText(page.text);
      } else {
        throw new Error("Unsupported webpage content type");
      }
    }

    console.log(String(content).slice(0, MAX_CONTENT_LENGTH));

    return {
      url: url.href,
      success: true,
      content: String(content).slice(0, MAX_CONTENT_LENGTH),
    };
  } catch (error) {
    console.error(
      "URL content fetch failed:",
      inputUrl,
      error.message
    );

    return {
      url: inputUrl,
      success: false,
      content: "",
      error: error.message,
    };
  }
};

export const fetchUrlsFromPrompt = async (prompt) => {
  const matches =
    String(prompt || "").match(/https?:\/\/[^\s<>"']+/gi) || [];

  const urls = [
    ...new Set(
      matches.map((value) => value.replace(/[),.!?;]+$/, ""))
    ),
  ].slice(0, 3);

  return Promise.all(urls.map(fetchUrlContent));
};
