#!/bin/bash

# Smart Filter Test Endpoint Examples
# Make sure your server is running on localhost:3000 (or update the BASE_URL)

BASE_URL="http://localhost:3000"

echo "🔍 Smart Filter Test Endpoint Examples"
echo "========================================"
echo ""

# Example 1: Test with a simple site
echo "1️⃣  Test with example.com (small site):"
echo "curl \"${BASE_URL}/debug/smart-filter/test?site=https://example.com\""
echo ""

# Example 2: Test with lead_site type
echo "2️⃣  Test with lead_site type:"
echo "curl \"${BASE_URL}/debug/smart-filter/test?site=https://example.com&siteType=lead_site\""
echo ""

# Example 3: Test with organization_site type
echo "3️⃣  Test with organization_site type:"
echo "curl \"${BASE_URL}/debug/smart-filter/test?site=https://example.com&siteType=organization_site\""
echo ""

# Example 4: Test with pretty output
echo "4️⃣  Test with pretty JSON output:"
echo "curl -s \"${BASE_URL}/debug/smart-filter/test?site=https://example.com\" | jq ."
echo ""

# Example 5: Test and save to file
echo "5️⃣  Test and save response to file:"
echo "curl -s \"${BASE_URL}/debug/smart-filter/test?site=https://example.com\" > smart-filter-test.json"
echo ""

# Example 6: Test and extract key metrics
echo "6️⃣  Test and extract performance metrics:"
echo "curl -s \"${BASE_URL}/debug/smart-filter/test?site=https://example.com\" | jq '{totalUrls: .sitemap.totalUrls, basicFiltered: .filtering.basicFiltered, smartFiltered: .filtering.smartFiltered, smartFilterTimeMs: .performance.smartFilterTimeMs}'"
echo ""

# Example 7: Test with a large site (will trigger skip logic)
echo "7️⃣  Test with a large site (to test >300 URL skip logic):"
echo "curl \"${BASE_URL}/debug/smart-filter/test?site=https://docs.python.org\""
echo ""

echo "========================================"
echo ""
echo "💡 Tips:"
echo "  - Install 'jq' for pretty JSON formatting: sudo apt-get install jq"
echo "  - Check logs with: tail -f logs/server.log | grep 'Debug'"
echo "  - Test with your own sites that had issues in production"
echo ""
echo "🚀 To actually run an example, copy-paste the command above"
echo ""
