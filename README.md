# Home Decor Buyer Finder

A React + Node.js application for discovering **potential business leads** from public web information based on a product/category, location, and potential buyer type.

## Current stack

- Frontend: React 18 + Vite + JavaScript
- Backend: Node.js + Express
- Web discovery: DuckDuckGo HTML search
- Email sending: Brevo API

No Foursquare, Google Places, Yelp, Hunter.io, Trueguard, OpenStreetMap, Overpass, or other business-search API is required.

## Project structure

```text
home-decor-buyer-finder/
├── client/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── styles.css
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
├── server/
│   ├── routes/
│   │   ├── buyers.js
│   │   └── email.js
│   └── index.js
├── .env
├── .env.example
├── package.json
└── package-lock.json
```

## Environment variables

Keep these in the server/root `.env` file:

```dotenv
BREVO_API_KEY=your_brevo_api_key
SENDER_EMAIL=you@example.com
SENDER_NAME=Your Name
PORT=3000
```

DuckDuckGo search does **not** require a `DUCKDUCKGO_API_KEY` in this implementation.

Do not expose the Brevo API key in the frontend.

## Install

From the project root:

```powershell
npm run install-all
```

Or separately:

```powershell
npm install
npm install --prefix client
```

## Run during development

Backend:

```powershell
npm run dev:server
```

Frontend, in another terminal:

```powershell
npm run dev:client
```

## Search flow

The user enters:

- Product / Category
- Location
- Potential Buyers

For example:

```text
Product / Category: Modern Sofa
Location: New York
Potential Buyers: Furniture Stores
```

The backend dynamically creates search queries such as:

```text
"Modern Sofa" "Furniture Stores" "New York"
Modern Sofa Furniture Stores New York
Modern Sofa Furniture Stores New York contact
Modern Sofa Furniture Stores New York email
```

DuckDuckGo is then searched using its non-JavaScript HTML results page.

DuckDuckGo's official help pages document HTML as one of its non-JavaScript search-result versions and document search operators that can be used to refine queries.

The backend then:

1. Collects relevant search results.
2. Removes duplicate URLs/business domains.
3. Scores results against the product, location, and buyer type.
4. Prefers direct business websites over common directory/social domains.
5. Opens publicly accessible business website pages.
6. Checks the homepage and relevant contact/about/support pages.
7. Extracts publicly displayed email addresses and phone numbers when available.
8. Returns structured potential business leads.
9. Stores discovered emails temporarily so the existing Brevo endpoint can send to a selected lead.

## API

### Search buyers

`POST /api/buyers/search`

Example:

```json
{
  "category": "Modern Sofa",
  "location": "New York",
  "buyerType": "Furniture Stores"
}
```

The response contains fields such as:

```json
{
  "success": true,
  "buyers": [
    {
      "name": "Example Furniture Store",
      "category": "Furniture Stores",
      "location": "New York",
      "email": "info@example.com",
      "phone": "123-456-7890",
      "website": "https://example.com",
      "description": "Furniture retailer in New York",
      "source": "DuckDuckGo",
      "sourceUrl": "https://example.com"
    }
  ]
}
```

If no relevant leads are found:

```json
{
  "success": true,
  "buyers": [],
  "message": "No relevant potential buyers found."
}
```

### Send email

`POST /api/email/send`

The existing Brevo endpoint remains in place.

```json
{
  "to": "buyer@example.com",
  "subject": "Home Decor Products",
  "message": "Hello, I would love to discuss supplying your store."
}
```

The recipient must have been discovered by a previous buyer search or be included in the existing test-recipient configuration.

## Important limitations

DuckDuckGo is a general web search engine, not a dedicated business database. It cannot guarantee:

- Every business in a location
- Every potential buyer
- Every business email
- Complete business information
- Verified buyer intent

The application therefore describes results as **potential business leads**, not confirmed buyers.

A publicly visible email address only means the address was found on a public source. It does not prove that the business currently wants to purchase the product.

The website crawler does not bypass:

- Login pages
- CAPTCHA
- Paywalls
- Authentication
- Anti-bot protection
- Other security restrictions

It only attempts normal public HTTP requests.

## Example searches

### Test 1

```text
Product: Modern Sofa
Location: New York
Potential Buyers: Furniture Stores
```

### Test 2

```text
Product: Dining Tables
Location: Los Angeles
Potential Buyers: Home Decor Retailers
```

### Test 3

```text
Product: Office Chairs
Location: Chicago
Potential Buyers: Office Furniture Dealers
```

## Responsible use

Only use publicly available business information and contact businesses in accordance with applicable privacy, anti-spam, and email-marketing laws.
