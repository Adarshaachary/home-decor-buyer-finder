import { useEffect, useRef, useState } from "react";

import "./styles.css";

const BUYER_OPTIONS = [10, 15, 20];

function SearchIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="svg-icon"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4 4" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="svg-icon"
    >
      <path d="M4 10.5L12 4l8 6.5" />
      <path d="M6.5 9.5V20h11V9.5" />
      <path d="M10 20v-5h4v5" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="svg-icon"
    >
      <path d="M12 21s7-6.2 7-12A7 7 0 0 0 5 9c0 5.8 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.3" />
    </svg>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={`chevron-icon ${open ? "open" : ""}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function BuyerCountDropdown({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleOutsideClick(event) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick
      );
    };
  }, []);

  function handleKeyDown(event) {
    if (disabled) return;

    if (event.key === "Escape") {
      setOpen(false);
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setOpen((current) => !current);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();

      if (!open) {
        setOpen(true);
        return;
      }

      const currentIndex = BUYER_OPTIONS.indexOf(value);

      const nextIndex = Math.min(
        currentIndex + 1,
        BUYER_OPTIONS.length - 1
      );

      onChange(BUYER_OPTIONS[nextIndex]);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();

      if (!open) {
        setOpen(true);
        return;
      }

      const currentIndex = BUYER_OPTIONS.indexOf(value);

      const nextIndex = Math.max(
        currentIndex - 1,
        0
      );

      onChange(BUYER_OPTIONS[nextIndex]);
    }
  }

  function selectOption(option) {
    onChange(option);
    setOpen(false);
  }

  return (
    <div
      className="custom-dropdown"
      ref={dropdownRef}
    >
      <button
        type="button"
        className={`custom-dropdown-trigger ${
          open ? "dropdown-open" : ""
        }`}
        onClick={() =>
          setOpen((current) => !current)
        }
        onKeyDown={handleKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="dropdown-value">
          {value}
        </span>

        <ChevronIcon open={open} />
      </button>

      {open && (
        <div
          className="custom-dropdown-menu"
          role="listbox"
          aria-label="Potential Buyers"
        >
          {BUYER_OPTIONS.map((option) => (
            <button
              type="button"
              key={option}
              role="option"
              aria-selected={value === option}
              className={`dropdown-option ${
                value === option
                  ? "selected"
                  : ""
              }`}
              onClick={() =>
                selectOption(option)
              }
            >
              <span>{option}</span>

              {value === option && (
                <span className="dropdown-check">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function createGoogleMapsUrl(
  businessName,
  locationParts
) {
  const address = locationParts
    .filter(Boolean)
    .join(", ");

  const searchText = [
    businessName,
    address,
  ]
    .filter(Boolean)
    .join(", ");

  if (!searchText) {
    return "";
  }

  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    searchText
  )}`;
}

function normalizeWebsite(website) {
  if (!website) {
    return "";
  }

  if (/^https?:\/\//i.test(website)) {
    return website;
  }

  return `https://${website}`;
}

function formatCategory(category) {
  if (!category) {
    return "";
  }

  return String(category)
    .replace("commercial.", "")
    .replaceAll("_", " ")
    .replaceAll(".", " › ");
}

export default function App() {
  const [category, setCategory] =
    useState("Home Decor");

  const [location, setLocation] =
    useState("United States");

  const [buyerType, setBuyerType] =
    useState(10);

  const [buyers, setBuyers] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [searched, setSearched] =
    useState(false);

  const [searchError, setSearchError] =
    useState("");

  const [info, setInfo] =
    useState("");

  const [selected, setSelected] =
    useState(null);

  const [toast, setToast] =
    useState("");

  const toastTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  function showSearchToast(message) {
    setToast(message);

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = setTimeout(() => {
      setToast("");
    }, 4000);
  }

  async function findBuyers(event) {
    event.preventDefault();

    const cleanCategory =
      category.trim();

    const cleanLocation =
      location.trim();

    const cleanBuyerType =
      Number(buyerType);

    if (!cleanCategory) {
      setSearchError(
        "Please enter a product or category."
      );

      setSearched(true);
      return;
    }

    if (!cleanLocation) {
      setSearchError(
        "Please enter a location."
      );

      setSearched(true);
      return;
    }

    if (
      !BUYER_OPTIONS.includes(
        cleanBuyerType
      )
    ) {
      setSearchError(
        "Potential Buyers must be 10, 15, or 20."
      );

      setSearched(true);
      return;
    }

    setLoading(true);
    setSearchError("");
    setInfo("");
    setToast("");
    setSelected(null);
    setBuyers([]);
    setSearched(false);

    try {
      const response = await fetch(
        "/api/buyers/search",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            category: cleanCategory,
            location: cleanLocation,
            buyerType: cleanBuyerType,
          }),
        }
      );

      const data =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.message ||
            data.error ||
            "Search failed. Please try again."
        );
      }

      const results =
        Array.isArray(data.buyers)
          ? data.buyers
          : Array.isArray(data.results)
          ? data.results
          : [];

      setBuyers(results);

      const resultMessage =
        data.message ||
        `Found ${results.length} potential ${
          results.length === 1
            ? "buyer"
            : "buyers"
        }.`;

      setInfo(resultMessage);
      setSearched(true);

      showSearchToast(
        `Search completed — ${results.length} potential ${
          results.length === 1
            ? "buyer"
            : "buyers"
        } found.`
      );
    } catch (error) {
      setSearchError(
        error?.message ===
          "Failed to fetch"
          ? "Unable to connect to the server. Make sure the Node.js backend is running."
          : error?.message ||
              "Something went wrong while searching."
      );

      setSearched(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <div className="background-orb orb-one"></div>
      <div className="background-orb orb-two"></div>

      <main className="page">

        {/* SEARCH COMPLETED POPUP */}
        {toast && (
          <div
            className="search-toast"
            role="status"
            aria-live="polite"
          >
            <div className="search-toast-icon">
              ✓
            </div>

            <div className="search-toast-content">
              <strong>
                Search completed
              </strong>

              <span>
                {toast.replace(
                  "Search completed — ",
                  ""
                )}
              </span>
            </div>
          </div>
        )}

        {/* HERO */}

        <header className="hero">
          <div className="hero-badge">
            <span className="badge-dot"></span>
            BUSINESS DISCOVERY PLATFORM
          </div>

          <h1>
            Find Your Next
            <span> Business Buyer</span>
          </h1>

          <p className="sub">
            Discover potential retailers and
            businesses for your products across
            the United States.
          </p>

          <div className="hero-stats">
            <div className="stat">
              <strong>01</strong>
              <span>Search</span>
            </div>

            <div className="stat-line"></div>

            <div className="stat">
              <strong>02</strong>
              <span>Discover</span>
            </div>

            <div className="stat-line"></div>

            <div className="stat">
              <strong>03</strong>
              <span>Connect</span>
            </div>
          </div>
        </header>

        {/* SEARCH */}

        <section className="search-card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                START YOUR SEARCH
              </span>

              <h2>Find buyers</h2>
            </div>

            <div className="search-icon">
              <SearchIcon />
            </div>
          </div>

          <form
            className="search-form"
            onSubmit={findBuyers}
          >

            {/* CATEGORY */}

            <div className="input-group">
              <label htmlFor="category">
                Product / Category
              </label>

              <div className="input-wrapper">
                <span className="input-icon">
                  <HomeIcon />
                </span>

                <input
                  id="category"
                  type="text"
                  value={category}
                  onChange={(event) =>
                    setCategory(
                      event.target.value
                    )
                  }
                  placeholder="Home Decor"
                  autoComplete="off"
                />
              </div>
            </div>

            {/* LOCATION */}

            <div className="input-group">
              <label htmlFor="location">
                Location
              </label>

              <div className="input-wrapper">
                <span className="input-icon">
                  <LocationIcon />
                </span>

                <input
                  id="location"
                  type="text"
                  value={location}
                  onChange={(event) =>
                    setLocation(
                      event.target.value
                    )
                  }
                  placeholder="United States or a city"
                  autoComplete="off"
                />
              </div>
            </div>

            {/* BUYER COUNT */}

            <div className="input-group buyer-limit-group">
              <label>
                Potential Buyers
              </label>

              <BuyerCountDropdown
                value={buyerType}
                onChange={setBuyerType}
                disabled={loading}
              />
            </div>

            {/* SEARCH BUTTON */}

            <button
              className="search-button"
              type="submit"
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  SEARCHING...
                </>
              ) : (
                <>
                  <SearchIcon />
                  FIND BUYERS
                </>
              )}
            </button>
          </form>

          <div className="search-note">
            <span className="secure-icon">
              ✓
            </span>

            <span>
              Search businesses by product
              category and location. The selected
              buyer count is a maximum.
            </span>
          </div>
        </section>

        {/* ERROR */}

        {searchError && (
          <div className="message-box error">
            <div className="message-icon">
              !
            </div>

            <div>
              <strong>
                Search failed
              </strong>

              <p>{searchError}</p>
            </div>
          </div>
        )}

        {/* INFO */}

        {info && !searchError && (
          <div className="message-box info">
            <div className="message-icon">
              i
            </div>

            <p>{info}</p>
          </div>
        )}

        {/* RESULTS */}

        {searched &&
          buyers.length > 0 && (
            <section className="results-section">
              <div className="results-header">
                <div>
                  <span className="eyebrow">
                    DISCOVERED BUSINESSES
                  </span>

                  <h2>
                    Potential buyers
                  </h2>
                </div>

                <div className="results-count">
                  <strong>
                    {buyers.length}
                  </strong>

                  <span>
                    {buyers.length === 1
                      ? "buyer found"
                      : "buyers found"}
                  </span>
                </div>
              </div>

              <div className="results">
                {buyers.map(
                  (buyer, index) => {
                    const businessName =
                      buyer.businessName ||
                      buyer.name ||
                      "Business";

                    const details =
                      buyer.details ||
                      buyer.snippet ||
                      "";

                    const locationParts = [
                      buyer.address,
                      buyer.city,
                      buyer.state,
                      buyer.country,
                    ].filter(Boolean);

                    const googleMapsUrl =
                      createGoogleMapsUrl(
                        businessName,
                        locationParts
                      );

                    const website =
                      normalizeWebsite(
                        buyer.website
                      );

                    const verificationStatus =
                      buyer.emailVerification
                        ?.status;

                    const isDomainChecked =
                      verificationStatus ===
                        "public_domain_valid" ||
                      verificationStatus ===
                        "public_domain_dns_valid";

                    const cardId =
                      buyer.id ||
                      `${businessName}-${index}`;

                    return (
                      <article
                        key={cardId}
                        className={`buyer-card ${
                          selected &&
                          selected.id ===
                            buyer.id
                            ? "active"
                            : ""
                        }`}
                        style={{
                          animationDelay: `${
                            index * 70
                          }ms`,
                          display: "flex",
                          flexDirection:
                            "column",
                          height: "100%",
                        }}
                      >

                        {/* CARD TOP */}

                        <div className="buyer-top">
                          <div className="business-avatar">
                            {businessName
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          {buyer.email && (
                            <div className="email-status">
                              <span></span>

                              {isDomainChecked
                                ? "Public email · Domain checked"
                                : "Public email"}
                            </div>
                          )}
                        </div>

                        {/* BUSINESS NAME */}

                        <h3>
                          {businessName}
                        </h3>

                        {/* DETAILS */}

                        <div className="buyer-details">

                          {/* ADDRESS */}

                          {locationParts.length >
                            0 && (
                            <div className="detail address-detail">
                              <span className="detail-icon">
                                <LocationIcon />
                              </span>

                              <div className="address-content">
                                {googleMapsUrl ? (
                                  <a
                                    href={
                                      googleMapsUrl
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="map-address-link"
                                    title="Open this address in Google Maps"
                                  >
                                    {locationParts.join(
                                      ", "
                                    )}
                                  </a>
                                ) : (
                                  <span className="address-text">
                                    {locationParts.join(
                                      ", "
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}

                          {/* WEBSITE */}

                          {website && (
                            <div className="detail">
                              <span className="detail-icon">
                                ↗
                              </span>

                              <a
                                href={website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="website-link"
                              >
                                {buyer.website}
                              </a>
                            </div>
                          )}

                          {/* PHONE */}

                          {buyer.phone && (
                            <div className="detail">
                              <span className="detail-icon">
                                ☎
                              </span>

                              <span>
                                {buyer.phone}
                              </span>
                            </div>
                          )}

                          {/* EMAIL */}

                          {buyer.email && (
                            <div className="detail">
                              <span className="detail-icon">
                                @
                              </span>

                              <span className="email-text">
                                {buyer.email}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* CATEGORY */}

                        {buyer.category && (
                          <div className="tag">
                            {formatCategory(
                              buyer.category
                            )}
                          </div>
                        )}

                        {/* DESCRIPTION */}

                        {details && (
                          <p className="buyer-description">
                            {details}
                          </p>
                        )}

                        {/* EMAIL BUTTON */}

                        <div
                          style={{
                            marginTop: "auto",
                            paddingTop: "18px",
                          }}
                        >
                          {buyer.email ? (
                            <button
                              type="button"
                              className="email-button"
                              onClick={() =>
                                setSelected(
                                  buyer
                                )
                              }
                            >
                              SEND EMAIL

                              <span>
                                →
                              </span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="email-button disabled"
                              disabled
                              title="No public email was found for this business"
                            >
                              NO EMAIL AVAILABLE
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  }
                )}
              </div>
            </section>
          )}

        {/* NO RESULTS */}

        {searched &&
          !loading &&
          buyers.length === 0 &&
          !searchError && (
            <div className="empty-state">
              <div className="empty-icon">
                <SearchIcon />
              </div>

              <h3>
                No buyers found
              </h3>

              <p>
                Try searching for another
                product category or location.
              </p>
            </div>
          )}

        {/* EMAIL MODAL */}

        {selected && (
          <EmailForm
            key={selected.id}
            buyer={selected}
            onClose={() =>
              setSelected(null)
            }
          />
        )}

        {/* FOOTER */}

        <footer>
          <span>Buyer Finder</span>
          <span>•</span>
          <span>
            Business discovery made simple
          </span>
        </footer>
      </main>
    </div>
  );
}

/* =========================================================
   EMAIL FORM
   ========================================================= */

function EmailForm({
  buyer,
  onClose,
}) {
  const businessName =
    buyer.businessName ||
    buyer.name ||
    "this business";

  const [subject, setSubject] =
    useState("Home Decor Products");

  const [message, setMessage] =
    useState(
      `Hello ${businessName},

I sell home decor products and would love to discuss supplying your store.

Please reply if you would like a catalog and pricing.

Thank you.`
    );

  const [status, setStatus] =
    useState("idle");

  const [error, setError] =
    useState("");

  async function send(event) {
    event.preventDefault();

    if (
      !subject.trim() ||
      !message.trim()
    ) {
      setStatus("error");

      setError(
        "Please fill in the subject and message."
      );

      return;
    }

    if (!buyer.email) {
      setStatus("error");

      setError(
        "No public email is available for this business."
      );

      return;
    }

    setStatus("sending");
    setError("");

    try {
      const response = await fetch(
        "/api/email/send",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            to: buyer.email,
            subject,
            message,
          }),
        }
      );

      const data =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {
        setError(
          data.error ||
            data.message ||
            "Unable to send email. Please try again."
        );

        setStatus("error");

        return;
      }

      setStatus("success");
    } catch {
      setError(
        "Unable to connect to the email server. Please try again."
      );

      setStatus("error");
    }
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={onClose}
    >
      <form
        className="email-modal"
        onSubmit={send}
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <button
          type="button"
          className="modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          ×
        </button>

        <div className="modal-header">
          <div className="modal-icon">
            @
          </div>

          <div>
            <span className="eyebrow">
              OUTREACH
            </span>

            <h2>
              Send an email
            </h2>

            <p>
              Contact {businessName}
            </p>
          </div>
        </div>

        <div className="email-fields">
          <label>
            To

            <div className="readonly-field">
              <span>@</span>
              {buyer.email}
            </div>
          </label>

          <label>
            Subject

            <input
              value={subject}
              onChange={(event) =>
                setSubject(
                  event.target.value
                )
              }
              placeholder="Enter email subject"
            />
          </label>

          <label>
            Message

            <textarea
              rows="8"
              value={message}
              onChange={(event) =>
                setMessage(
                  event.target.value
                )
              }
              placeholder="Write your message..."
            />
          </label>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="cancel-button"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            type="submit"
            className="send-button"
            disabled={
              status === "sending"
            }
          >
            {status === "sending" ? (
              <>
                <span className="spinner"></span>
                SENDING...
              </>
            ) : (
              <>
                SEND EMAIL
                <span>→</span>
              </>
            )}
          </button>
        </div>

        {status === "success" && (
          <div className="modal-status success">
            <span>✓</span>
            Email sent successfully.
          </div>
        )}

        {status === "error" && (
          <div className="modal-status error">
            <span>!</span>
            {error}
          </div>
        )}
      </form>
    </div>
  );
}