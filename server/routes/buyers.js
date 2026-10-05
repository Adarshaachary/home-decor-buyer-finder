const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");

const router = express.Router();

const SERPAPI_KEY = process.env.SERPAPI_KEY;

const knownEmails = new Set();

const blockedDomains = [
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "youtube.com",
  "tiktok.com",
  "pinterest.com",
  "twitter.com",
  "x.com",
  "reddit.com",
  "wikipedia.org",
  "amazon.com",
  "ebay.com",
  "yelp.com",
  "yellowpages.com",
  "aeroleads.com",
  "bestinhood.com",
  "housebeautiful.com",
  "architecturaldigest.com",
  "homedecorelooks.com",
  "nestingoak.com",
  "heart4home.net",
  "hommes.studio",
];

const blockedPathWords = [
  "/search",
  "/directory",
  "/directories",
  "/listings",
  "/listing",
  "/category/",
  "/categories/",
  "/tag/",
  "/tags/",
  "/article/",
  "/articles/",
  "/story/",
  "/stories/",
  "/blog/",
  "/blogs/",
  "/news/",
  "/guide/",
  "/guides/",
  "/best-",
  "/top-",
  "/list/",
  "/lists/",
  "/ranking/",
  "/rankings/",
];

const blockedTitleWords = [
  "best ",
  "top ",
  "guide",
  "list of",
  "directory",
  "directories",
  "listing",
  "listings",
  "article",
  "articles",
  "news",
  "magazine",
  "review",
  "reviews",
  "comparison",
  "ranked",
  "ranking",
  "roundup",
  "round-up",
  "places to",
  "where to",
  "things to do",
  "updated guide",
];

const businessTypeWords = [
  "store",
  "shop",
  "shoppe",
  "retailer",
  "retail",
  "showroom",
  "furniture",
  "home furnishings",
  "home furnishing",
  "home decor",
  "home décor",
  "decor",
  "interior",
  "interiors",
  "design",
  "boutique",
  "warehouse",
  "dealer",
  "manufacturer",
  "wholesale",
  "company",
  "business",
  "market",
];

const genericSiteWords = [
  "blog",
  "news",
  "magazine",
  "directory",
  "review",
  "reviews",
  "guide",
  "guides",
  "listicle",
  "forum",
];

function cleanText(value) {
  if (!value) {
    return "";
  }

  return String(value)
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

function normalizeWebsite(url) {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return null;
    }

    return `${parsed.protocol}//${parsed.hostname}${
      parsed.pathname === "/" ? "" : parsed.pathname
    }`;
  } catch {
    return null;
  }
}

function getDomain(url) {
  try {
    return new URL(url).hostname
      .toLowerCase()
      .replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isBlockedDomain(url) {
  try {
    const hostname = new URL(url).hostname
      .toLowerCase()
      .replace(/^www\./, "");

    return blockedDomains.some(
      (domain) =>
        hostname === domain || hostname.endsWith(`.${domain}`)
    );
  } catch {
    return true;
  }
}

function isBlockedPath(url) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();

    return blockedPathWords.some((word) =>
      pathname.includes(word)
    );
  } catch {
    return true;
  }
}

function extractEmails(text) {
  if (!text) {
    return [];
  }

  const matches = text.match(
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi
  );

  if (!matches) {
    return [];
  }

  return [
    ...new Set(
      matches
        .map((email) => email.toLowerCase().trim())
        .filter((email) => {
          const blockedEmailDomains = [
            "example.com",
            "test.com",
            "domain.com",
            "sentry.io",
            "wixpress.com",
            "schema.org",
            "google.com",
            "facebook.com",
            "instagram.com",
          ];

          return !blockedEmailDomains.some((domain) =>
            email.endsWith(`@${domain}`)
          );
        })
    ),
  ];
}

function extractPhones(text) {
  if (!text) {
    return [];
  }

  const matches = text.match(
    /(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}/g
  );

  if (!matches) {
    return [];
  }

  return [
    ...new Set(
      matches
        .map((phone) => cleanText(phone))
        .filter(
          (phone) =>
            phone.replace(/\D/g, "").length >= 10
        )
    ),
  ];
}

function extractAddress($) {
  const selectors = [
    "address",
    '[itemprop="address"]',
    '[itemtype*="PostalAddress"]',
    ".address",
    ".contact-address",
    ".store-address",
    ".location-address",
    ".business-address",
    ".contact-info",
  ];

  for (const selector of selectors) {
    const value = $(selector).first().text();

    if (value) {
      const cleaned = cleanText(value);

      if (cleaned.length >= 8) {
        return cleaned.substring(0, 300);
      }
    }
  }

  return null;
}

function extractJsonLd($) {
  const records = [];

  $('script[type="application/ld+json"]').each(
    (index, element) => {
      const raw = $(element).html();

      if (!raw) {
        return;
      }

      try {
        const parsed = JSON.parse(raw);

        if (Array.isArray(parsed)) {
          records.push(...parsed);
        } else {
          records.push(parsed);
        }
      } catch {
        return;
      }
    }
  );

  return records;
}

function extractBusinessFromJsonLd(records) {
  const businessTypes = [
    "organization",
    "localbusiness",
    "store",
    "furniturestore",
    "homegoodsstore",
    "shoppingcenter",
    "corporation",
  ];

  for (const record of records) {
    if (!record || typeof record !== "object") {
      continue;
    }

    const type = Array.isArray(record["@type"])
      ? record["@type"].join(" ")
      : String(record["@type"] || "");

    const normalizedType = type
      .toLowerCase()
      .replace(/[^a-z]/g, "");

    const isBusinessType = businessTypes.some((item) =>
      normalizedType.includes(item)
    );

    if (!isBusinessType) {
      continue;
    }

    let address = null;

    if (record.address) {
      if (typeof record.address === "string") {
        address = cleanText(record.address);
      } else if (
        typeof record.address === "object"
      ) {
        address = cleanText(
          [
            record.address.streetAddress,
            record.address.addressLocality,
            record.address.addressRegion,
            record.address.postalCode,
            record.address.addressCountry,
          ]
            .filter(Boolean)
            .join(", ")
        );
      }
    }

    return {
      name: cleanText(record.name || ""),
      email: cleanText(record.email || "").toLowerCase() || null,
      phone: cleanText(record.telephone || "") || null,
      address: address || null,
      description:
        cleanText(
          record.description || ""
        ) || null,
    };
  }

  return {
    name: "",
    email: null,
    phone: null,
    address: null,
    description: null,
  };
}

function normalizeForMatching(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[^\w\s]/g, " ");
}

function tokenize(value) {
  return normalizeForMatching(value)
    .split(/\s+/)
    .filter((word) => word.length >= 3);
}

function locationTokens(location) {
  return tokenize(location);
}

function categoryTokens(category) {
  return tokenize(category);
}

function containsAny(text, words) {
  const normalized = normalizeForMatching(text);

  return words.some((word) =>
    normalized.includes(normalizeForMatching(word))
  );
}

function hasBlockedTitle(title) {
  const normalized = normalizeForMatching(title);

  return blockedTitleWords.some((word) =>
    normalized.includes(normalizeForMatching(word))
  );
}

function looksLikeBusinessWebsite(url) {
  if (!url) {
    return false;
  }

  if (isBlockedDomain(url)) {
    return false;
  }

  if (isBlockedPath(url)) {
    return false;
  }

  return true;
}

function getBusinessName(title, url, jsonLdName = "") {
  if (jsonLdName) {
    return cleanText(jsonLdName);
  }

  const cleanedTitle = cleanText(title);

  if (cleanedTitle) {
    const parts = cleanedTitle
      .split(/\s+[|–—-]\s+/)
      .map((part) => cleanText(part))
      .filter(Boolean);

    if (parts.length > 1) {
      const first = parts[0];
      const last = parts[parts.length - 1];

      if (
        first.length <= 70 &&
        !hasBlockedTitle(first)
      ) {
        return first;
      }

      if (
        last.length <= 70 &&
        !hasBlockedTitle(last)
      ) {
        return last;
      }
    }

    if (!hasBlockedTitle(cleanedTitle)) {
      return cleanedTitle;
    }
  }

  try {
    return new URL(url).hostname
      .replace(/^www\./, "")
      .split(".")[0]
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (char) =>
        char.toUpperCase()
      );
  } catch {
    return "Potential Business";
  }
}

function buildRelatedTerms(category) {
  const normalized = normalizeForMatching(category);

  const terms = [category];

  if (
    normalized.includes("sofa") ||
    normalized.includes("couch")
  ) {
    terms.push(
      "furniture store",
      "sofa store",
      "furniture retailer",
      "furniture showroom",
      "home furnishings store"
    );
  } else if (
    normalized.includes("dining") ||
    normalized.includes("table")
  ) {
    terms.push(
      "furniture store",
      "dining furniture",
      "furniture retailer",
      "furniture showroom",
      "home furnishings store"
    );
  } else if (
    normalized.includes("wall") ||
    normalized.includes("decor") ||
    normalized.includes("decoration")
  ) {
    terms.push(
      "home decor store",
      "home furnishings store",
      "interior decor store",
      "decor retailer",
      "home goods store"
    );
  } else if (
    normalized.includes("bed") ||
    normalized.includes("mattress")
  ) {
    terms.push(
      "furniture store",
      "bedroom furniture store",
      "mattress store",
      "furniture retailer",
      "home furnishings store"
    );
  } else if (
    normalized.includes("lighting") ||
    normalized.includes("lamp")
  ) {
    terms.push(
      "lighting store",
      "lighting retailer",
      "home lighting showroom",
      "home decor store"
    );
  } else if (
    normalized.includes("rug") ||
    normalized.includes("carpet")
  ) {
    terms.push(
      "rug store",
      "carpet store",
      "home decor store",
      "flooring retailer",
      "home furnishings store"
    );
  } else {
    terms.push(
      "home decor store",
      "home furnishings store",
      "furniture retailer",
      "home goods store",
      "interior design store"
    );
  }

  return [...new Set(terms)];
}

function buildQueries(category, location) {
  const relatedTerms = buildRelatedTerms(category);

  const queries = [];

  for (const term of relatedTerms) {
    queries.push(
      `"${term}" "${location}" official website`
    );

    queries.push(
      `"${term}" "${location}" contact`
    );
  }

  queries.push(
    `"${category}" "${location}" business website`
  );

  queries.push(
    `"${category}" "${location}" retailer website`
  );

  queries.push(
    `"${category}" "${location}" showroom`
  );

  return [...new Set(queries)];
}

async function searchDuckDuckGo(query) {
  if (!SERPAPI_KEY) {
    throw new Error(
      "SERPAPI_KEY is missing from server .env"
    );
  }

  console.log(
    `Searching DuckDuckGo through SerpApi: ${query}`
  );

  const response = await axios.get(
    "https://serpapi.com/search",
    {
      params: {
        engine: "duckduckgo",
        q: query,
        api_key: SERPAPI_KEY,
        kl: "us-en",
      },
      timeout: 30000,
    }
  );

  if (response.data?.error) {
    throw new Error(response.data.error);
  }

  return response.data?.organic_results || [];
}

async function inspectWebsite(url) {
  if (!url) {
    return {
      finalUrl: null,
      businessName: "",
      email: null,
      phone: null,
      address: null,
      details: null,
      pageText: "",
      hasBusinessSchema: false,
      contactPage: null,
    };
  }

  try {
    const response = await axios.get(url, {
      timeout: 12000,
      maxRedirects: 5,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/154 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (typeof response.data !== "string") {
      return {
        finalUrl: url,
        businessName: "",
        email: null,
        phone: null,
        address: null,
        details: null,
        pageText: "",
        hasBusinessSchema: false,
        contactPage: null,
      };
    }

    const finalUrl =
      normalizeWebsite(response.request?.res?.responseUrl) ||
      normalizeWebsite(url);

    const html = response.data;

    const $ = cheerio.load(html);

    const pageText = cleanText(
      $("body").text()
    );

    const jsonLdRecords = extractJsonLd($);

    const jsonLdBusiness =
      extractBusinessFromJsonLd(
        jsonLdRecords
      );

    const emails = extractEmails(
      `${html} ${pageText}`
    );

    const phones = extractPhones(
      pageText
    );

    const address =
      extractAddress($) ||
      jsonLdBusiness.address ||
      null;

    const metaDescription = cleanText(
      $('meta[name="description"]').attr("content") ||
        $('meta[property="og:description"]').attr(
          "content"
        ) ||
        ""
    );

    let details = metaDescription;

    if (!details && jsonLdBusiness.description) {
      details = jsonLdBusiness.description;
    }

    if (!details && pageText) {
      details = pageText.substring(0, 350);
    }

    let contactPage = null;

    $("a").each((index, element) => {
      if (contactPage) {
        return;
      }

      const href = $(element).attr("href");

      if (!href) {
        return;
      }

      const text = cleanText(
        $(element).text()
      ).toLowerCase();

      const hrefLower = href.toLowerCase();

      if (
        text.includes("contact") ||
        text.includes("about us") ||
        text === "about" ||
        hrefLower.includes("/contact") ||
        hrefLower.includes("/about")
      ) {
        try {
          const candidate = new URL(
            href,
            finalUrl || url
          ).href;

          const candidateDomain =
            getDomain(candidate);

          if (
            candidateDomain ===
            getDomain(finalUrl || url)
          ) {
            contactPage = candidate;
          }
        } catch {
          return;
        }
      }
    });

    return {
      finalUrl: finalUrl || url,
      businessName:
        jsonLdBusiness.name || "",
      email:
        emails[0] ||
        jsonLdBusiness.email ||
        null,
      phone:
        phones[0] ||
        jsonLdBusiness.phone ||
        null,
      address,
      details: details || null,
      pageText,
      hasBusinessSchema:
        Boolean(jsonLdBusiness.name),
      contactPage,
    };
  } catch (error) {
    console.log(
      `Website inspection failed: ${url}`
    );

    return {
      finalUrl: url,
      businessName: "",
      email: null,
      phone: null,
      address: null,
      details: null,
      pageText: "",
      hasBusinessSchema: false,
      contactPage: null,
    };
  }
}

async function collectWebsiteDetails(url) {
  const normalizedUrl =
    normalizeWebsite(url);

  if (
    !normalizedUrl ||
    isBlockedDomain(normalizedUrl)
  ) {
    return {
      finalUrl: normalizedUrl,
      businessName: "",
      email: null,
      phone: null,
      address: null,
      details: null,
      pageText: "",
      hasBusinessSchema: false,
    };
  }

  let details =
    await inspectWebsite(normalizedUrl);

  if (
    details.contactPage &&
    (!details.email ||
      !details.phone ||
      !details.address)
  ) {
    const contactDetails =
      await inspectWebsite(
        details.contactPage
      );

    details = {
      finalUrl:
        details.finalUrl ||
        contactDetails.finalUrl ||
        normalizedUrl,
      businessName:
        details.businessName ||
        contactDetails.businessName ||
        "",
      email:
        details.email ||
        contactDetails.email ||
        null,
      phone:
        details.phone ||
        contactDetails.phone ||
        null,
      address:
        details.address ||
        contactDetails.address ||
        null,
      details:
        details.details ||
        contactDetails.details ||
        null,
      pageText:
        `${details.pageText || ""} ${
          contactDetails.pageText || ""
        }`,
      hasBusinessSchema:
        details.hasBusinessSchema ||
        contactDetails.hasBusinessSchema,
    };
  }

  return details;
}

function getLocationMatchScore(text, location) {
  const normalizedText =
    normalizeForMatching(text);

  const tokens =
    locationTokens(location);

  if (!tokens.length) {
    return 0;
  }

  let matches = 0;

  for (const token of tokens) {
    if (normalizedText.includes(token)) {
      matches++;
    }
  }

  if (matches === tokens.length) {
    return 4;
  }

  if (matches > 0) {
    return 2;
  }

  return 0;
}

function getCategoryMatchScore(
  text,
  category
) {
  const normalizedText =
    normalizeForMatching(text);

  const tokens =
    categoryTokens(category);

  if (!tokens.length) {
    return 0;
  }

  let matches = 0;

  for (const token of tokens) {
    if (normalizedText.includes(token)) {
      matches++;
    }
  }

  if (matches === tokens.length) {
    return 4;
  }

  if (matches > 0) {
    return 2;
  }

  return 0;
}

function scoreCandidate({
  title,
  snippet,
  website,
  businessDetails,
  category,
  location,
  contactDetails,
}) {
  const combinedText = cleanText(
    `${title} ${snippet} ${website} ${
      businessDetails.pageText || ""
    }`
  ).toLowerCase();

  let score = 0;

  const locationScore =
    getLocationMatchScore(
      combinedText,
      location
    );

  const categoryScore =
    getCategoryMatchScore(
      combinedText,
      category
    );

  score += locationScore;
  score += categoryScore;

  if (
    containsAny(
      combinedText,
      businessTypeWords
    )
  ) {
    score += 3;
  }

  if (contactDetails.hasBusinessSchema) {
    score += 4;
  }

  if (contactDetails.email) {
    score += 4;
  }

  if (contactDetails.phone) {
    score += 2;
  }

  if (contactDetails.address) {
    score += 3;
  }

  if (
    contactDetails.contactPage
  ) {
    score += 1;
  }

  if (
    website &&
    !isBlockedPath(website)
  ) {
    score += 2;
  }

  if (hasBlockedTitle(title)) {
    score -= 8;
  }

  if (
    containsAny(
      combinedText,
      genericSiteWords
    )
  ) {
    score -= 5;
  }

  if (
    isBlockedDomain(website)
  ) {
    score -= 20;
  }

  if (
    !looksLikeBusinessWebsite(website)
  ) {
    score -= 15;
  }

  return score;
}

function isStrongBusinessCandidate({
  title,
  snippet,
  website,
  contactDetails,
  category,
  location,
}) {
  if (!website) {
    return false;
  }

  if (!looksLikeBusinessWebsite(website)) {
    return false;
  }

  if (hasBlockedTitle(title)) {
    return false;
  }

  const combinedText = cleanText(
    `${title} ${snippet} ${
      contactDetails.pageText || ""
    } ${contactDetails.details || ""}`
  ).toLowerCase();

  const categoryScore =
    getCategoryMatchScore(
      combinedText,
      category
    );

  const locationScore =
    getLocationMatchScore(
      combinedText,
      location
    );

  const hasBusinessSignals =
    containsAny(
      combinedText,
      businessTypeWords
    );

  const hasContact =
    Boolean(
      contactDetails.email ||
        contactDetails.phone ||
        contactDetails.address
    );

  const hasBusinessSchema =
    Boolean(
      contactDetails.hasBusinessSchema
    );

  if (
    categoryScore === 0 &&
    !hasBusinessSignals
  ) {
    return false;
  }

  if (
    locationScore === 0 &&
    !hasContact &&
    !hasBusinessSchema
  ) {
    return false;
  }

  return true;
}

function createCandidate({
  result,
  website,
  businessDetails,
  category,
  location,
}) {
  const businessName =
    getBusinessName(
      result.title,
      website,
      businessDetails.businessName
    );

  const email =
    businessDetails.email
      ? businessDetails.email.toLowerCase()
      : null;

  if (email) {
    knownEmails.add(email);
  }

  const details =
    businessDetails.details ||
    cleanText(result.snippet || "");

  const score =
    scoreCandidate({
      title: result.title || "",
      snippet: result.snippet || "",
      website,
      businessDetails,
      category,
      location,
      contactDetails: businessDetails,
    });

  return {
    businessName,
    name: businessName,
    category,
    location,
    address:
      businessDetails.address || null,
    email,
    phone:
      businessDetails.phone || null,
    website,
    details: details || null,
    snippet:
      cleanText(result.snippet || ""),
    source: "DuckDuckGo via SerpApi",
    score,
  };
}

router.post("/search", async (req, res) => {
  try {
    const category =
      cleanText(req.body.category);

    const location =
      cleanText(req.body.location);

    const buyerType =
      Number(req.body.buyerType);

    console.log("");
    console.log("==============================");
    console.log("DUCKDUCKGO BUYER SEARCH");
    console.log("==============================");
    console.log(
      `Product/category: ${category}`
    );
    console.log(
      `Location: ${location}`
    );
    console.log(
      `Requested buyers: ${buyerType}`
    );
    console.log("");

    if (!category) {
      return res.status(400).json({
        success: false,
        message:
          "Product/category is required.",
      });
    }

    if (!location) {
      return res.status(400).json({
        success: false,
        message:
          "Location is required.",
      });
    }

    if (
      ![10, 15, 20].includes(
        buyerType
      )
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Buyer count must be 10, 15, or 20.",
      });
    }

    if (!SERPAPI_KEY) {
      return res.status(500).json({
        success: false,
        message:
          "SerpApi is not configured. Add SERPAPI_KEY to server/.env.",
      });
    }

    const queries =
      buildQueries(
        category,
        location
      );

    console.log(
      "Generated DuckDuckGo queries:"
    );

    queries.forEach((query) => {
      console.log(`- ${query}`);
    });

    console.log("");

    const candidates = [];
    const seenDomains = new Set();
    const seenNames = new Set();

    const maximumResultsToCollect =
      Math.max(
        buyerType * 3,
        30
      );

    for (const query of queries) {
      if (
        candidates.length >=
        maximumResultsToCollect
      ) {
        break;
      }

      let results = [];

      try {
        results =
          await searchDuckDuckGo(
            query
          );
      } catch (error) {
        console.log(
          `DuckDuckGo search failed: ${error.message}`
        );
        continue;
      }

      console.log(
        `DuckDuckGo returned ${results.length} results for this query.`
      );

      for (const result of results) {
        if (
          candidates.length >=
          maximumResultsToCollect
        ) {
          break;
        }

        if (
          !result ||
          !result.link
        ) {
          continue;
        }

        const rawUrl =
          normalizeWebsite(
            result.link
          );

        if (!rawUrl) {
          continue;
        }

        if (
          isBlockedDomain(
            rawUrl
          )
        ) {
          console.log(
            `Rejected blocked domain: ${rawUrl}`
          );
          continue;
        }

        if (
          isBlockedPath(
            rawUrl
          )
        ) {
          console.log(
            `Rejected directory/article path: ${rawUrl}`
          );
          continue;
        }

        if (
          hasBlockedTitle(
            cleanText(
              result.title || ""
            )
          )
        ) {
          console.log(
            `Rejected article/list result: ${result.title}`
          );
          continue;
        }

        const domain =
          getDomain(rawUrl);

        if (
          !domain ||
          seenDomains.has(domain)
        ) {
          continue;
        }

        console.log(
          `Inspecting candidate website: ${rawUrl}`
        );

        const websiteDetails =
          await collectWebsiteDetails(
            rawUrl
          );

        const finalWebsite =
          normalizeWebsite(
            websiteDetails.finalUrl ||
              rawUrl
          ) || rawUrl;

        const finalDomain =
          getDomain(
            finalWebsite
          );

        if (
          finalDomain &&
          seenDomains.has(finalDomain)
        ) {
          continue;
        }

        if (
          finalDomain &&
          isBlockedDomain(
            finalWebsite
          )
        ) {
          continue;
        }

        const candidateName =
          getBusinessName(
            result.title,
            finalWebsite,
            websiteDetails.businessName
          );

        const normalizedName =
          normalizeForMatching(
            candidateName
          );

        if (
          !normalizedName ||
          normalizedName.length < 2
        ) {
          continue;
        }

        if (
          seenNames.has(
            normalizedName
          )
        ) {
          continue;
        }

        const isStrong =
          isStrongBusinessCandidate({
            title:
              result.title || "",
            snippet:
              result.snippet || "",
            website:
              finalWebsite,
            contactDetails:
              websiteDetails,
            category,
            location,
          });

        if (!isStrong) {
          console.log(
            `Rejected weak candidate: ${candidateName}`
          );
          continue;
        }

        const candidate =
          createCandidate({
            result,
            website:
              finalWebsite,
            businessDetails:
              websiteDetails,
            category,
            location,
          });

        if (
          candidate.score < 6
        ) {
          console.log(
            `Rejected low-score candidate: ${candidateName} (${candidate.score})`
          );
          continue;
        }

        seenDomains.add(
          finalDomain || domain
        );

        seenNames.add(
          normalizedName
        );

        candidates.push(
          candidate
        );

        console.log(
          `Added candidate ${candidates.length}: ${candidateName} | score ${candidate.score}`
        );
      }
    }

    candidates.sort(
      (a, b) => {
        if (
          b.score !== a.score
        ) {
          return b.score - a.score;
        }

        const aContact =
          Number(Boolean(a.email)) +
          Number(Boolean(a.phone)) +
          Number(Boolean(a.address));

        const bContact =
          Number(Boolean(b.email)) +
          Number(Boolean(b.phone)) +
          Number(Boolean(b.address));

        return (
          bContact - aContact
        );
      }
    );

    const buyers =
      candidates
        .slice(0, buyerType)
        .map(
          ({
            score,
            ...buyer
          }) => buyer
        );

    console.log("");
    console.log(
      `Search completed. Found ${buyers.length} potential buyers.`
    );
    console.log("==============================");
    console.log("");

    return res.json({
      success: true,
      count: buyers.length,
      requested: buyerType,
      buyers,
      message:
        buyers.length > 0
          ? `Found ${buyers.length} potential business leads.`
          : "No suitable public business leads were found for this search.",
    });
  } catch (error) {
    console.error(
      "Buyer search error:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message ||
        "Buyer search failed. Please try again.",
    });
  }
});

module.exports = router;
module.exports.knownEmails =
  knownEmails;