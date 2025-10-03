# Debug Endpoints

This document describes the debug endpoints available for testing and troubleshooting.

## Smart Filter Test Endpoint

Test the smart filter functionality by fetching a sitemap and running the smart filter on it.

### Endpoint

```
GET /debug/smart-filter/test
```

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `site` | string | Yes | - | Website URL to test (e.g., `https://example.com`) |
| `siteType` | string | No | `lead_site` | Type of site to scrape. Options: `lead_site`, `organization_site` |

### Example Requests

#### Test with a small site
```bash
curl "http://localhost:3000/debug/smart-filter/test?site=https://example.com"
```

#### Test with a specific site type
```bash
curl "http://localhost:3000/debug/smart-filter/test?site=https://example.com&siteType=organization_site"
```

#### Test with a large site (to trigger skip logic)
```bash
curl "http://localhost:3000/debug/smart-filter/test?site=https://some-large-site.com"
```

### Response Format

#### Success Response (200)

```json
{
  "success": true,
  "site": "https://example.com",
  "siteType": "lead_site",
  "sitemap": {
    "totalUrls": 150,
    "sampleUrls": [
      "https://example.com/",
      "https://example.com/about",
      "https://example.com/products",
      "https://example.com/services",
      "https://example.com/contact"
    ]
  },
  "filtering": {
    "basicFiltered": 142,
    "smartFiltered": 68,
    "finalUrls": [
      "https://example.com/",
      "https://example.com/about",
      "...remaining 66 URLs..."
    ]
  },
  "performance": {
    "sitemapFetchTimeMs": 1234,
    "smartFilterTimeMs": 5678,
    "totalTimeMs": 6912
  },
  "timestamp": "2025-10-03T20:00:00.000Z"
}
```

#### Success Response with Skip (200)

When the smart filter is skipped (sitemap too large or too small):

```json
{
  "success": true,
  "site": "https://large-site.com",
  "siteType": "lead_site",
  "sitemap": {
    "totalUrls": 450,
    "sampleUrls": ["..."]
  },
  "filtering": {
    "basicFiltered": 398,
    "smartFiltered": 75,
    "finalUrls": ["...first 75 URLs..."]
  },
  "performance": {
    "sitemapFetchTimeMs": 2345,
    "smartFilterTimeMs": 12,
    "totalTimeMs": 2357
  },
  "skipped": {
    "reason": "above_maximum",
    "message": "Sitemap size (398) is above maximum (300), smart filter skipped"
  },
  "timestamp": "2025-10-03T20:00:00.000Z"
}
```

#### Error Response (400)

```json
{
  "success": false,
  "error": "Invalid URL provided"
}
```

#### Error Response (500)

```json
{
  "success": false,
  "error": "Smart filter test failed",
  "details": {
    "name": "TimeoutError",
    "message": "Request timed out after 120000ms",
    "totalTimeMs": 120567
  }
}
```

### Response Fields Explanation

| Field | Description |
|-------|-------------|
| `success` | Whether the test completed successfully |
| `site` | The URL that was tested |
| `siteType` | The site type used for filtering |
| `sitemap.totalUrls` | Total number of URLs found in the sitemap |
| `sitemap.sampleUrls` | First 5 URLs from the sitemap (for preview) |
| `filtering.basicFiltered` | Number of URLs after basic filtering (removing blog, privacy, etc.) |
| `filtering.smartFiltered` | Number of URLs after smart AI filtering |
| `filtering.finalUrls` | The actual filtered URLs that would be scraped |
| `performance.sitemapFetchTimeMs` | Time taken to fetch sitemap from Firecrawl |
| `performance.smartFilterTimeMs` | Time taken to run smart filter |
| `performance.totalTimeMs` | Total time for the entire test |
| `skipped` | Present if smart filter was skipped (too large or too small) |
| `skipped.reason` | Reason for skipping: `below_minimum` or `above_maximum` |
| `skipped.message` | Human-readable explanation |

### What Gets Tested

This endpoint tests the complete smart filter flow:

1. **Sitemap Fetch**: Retrieves the sitemap from Firecrawl
2. **Basic Filtering**: Removes common pages (blog, privacy, terms, etc.)
3. **Smart Filtering**: Uses AI to select the most relevant pages (45-75 URLs)

### Smart Filter Behavior

- **< 45 URLs**: Smart filter is skipped, returns all URLs
- **45-300 URLs**: Smart filter is applied with 120s timeout
- **> 300 URLs**: Smart filter is skipped, returns first 75 URLs
- **Fallback**: On error/timeout, returns first 75 URLs

### Use Cases

1. **Debug a specific site**: Test why a particular site is or isn't being filtered correctly
2. **Performance testing**: See how long the smart filter takes for different site sizes
3. **Verify fixes**: After making changes, verify the smart filter works correctly
4. **Reproduce issues**: Test with the exact site that caused a production issue

### Logging

All requests to this endpoint are logged with:
- Site URL
- Site type
- Sitemap size
- Filtering results
- Performance metrics
- Any errors encountered

Check your logs for `[Debug]` prefix to see detailed execution information.

---

## Other Debug Endpoints

See the main API documentation for other debug endpoints:
- `/debug/cache/test` - Test cache connection
- `/debug/cache/manual` - Manual cache operations
- `/debug/cache/stats` - Get cache statistics
- `/debug/cache/inspect` - Inspect Redis directly
