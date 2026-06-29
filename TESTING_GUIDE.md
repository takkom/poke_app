================================================================================
🎮 QUICK START GUIDE - Testing the TCGdex Implementation
================================================================================

This guide will help you test the updated Pokémon TCG app with live data
and market pricing.

================================================================================
⚡ SUPER QUICK START (5 minutes)
================================================================================

1. INSTALL DEPENDENCIES
   cd d:\apps\xmon\pokemon-tcg-app
   npm install

2. START THE APP
   npm start

3. LAUNCH IN SIMULATOR
   Press 'i' for iOS or 'a' for Android

4. WAIT FOR LOADING
   • App shows: "Loading Pokémon cards from TCGdex..."
   • Wait 2-5 seconds
   • You should see 100+ cards loaded

5. TEST SEARCH
   • Type "pikachu" in search box
   • Should see Pikachu cards appear
   • Try other searches:
   - "charizard"
   - "135" (card number)
   - "base" (set name)

6. VIEW CARD DETAILS
   • Tap any card from search results
   • See card image, details, rarity, HP, etc.
   • SCROLL DOWN to see PRICING section
   • You should see:
   - TCGPlayer prices (USA) with $ symbol
   - CardMarket prices (Europe) with € symbol
   - Different conditions: Normal, Holofoil, Reverse Holo
   - Price ranges and 30-day averages

================================================================================
✅ VERIFICATION CHECKLIST
================================================================================

STARTUP (After npm install)
[ ] npm start runs without errors
[ ] Expo server starts
[ ] Shows QR code
[ ] App launches in simulator

SEARCH SCREEN
[ ] App shows "Loading Pokémon cards..." message
[ ] After 2-5 sec, shows card count (e.g., "200 cards available")
[ ] Search input box is visible and interactive
[ ] Results counter shows total cards

SEARCH FUNCTIONALITY
[ ] Type "pikachu" → Shows Pikachu cards
[ ] Type "charizard" → Shows Charizard cards  
 [ ] Type "135/108" → Shows specific card
[ ] Type nonsense → Shows "No cards found"
[ ] Clear search → Shows all cards again
[ ] Search is case-insensitive

CARD DETAIL VIEW
[ ] Tap a card → Detail screen opens
[ ] Shows card image (from TCGdex)
[ ] Shows card name
[ ] Shows card number (e.g., "25/102")
[ ] Shows set name (e.g., "Base Set")
[ ] Shows rarity (★ symbol)
[ ] Shows HP (if available)
[ ] Shows card type
[ ] Shows artist name
[ ] Shows weaknesses section (if any)
[ ] Shows resistances section (if any)

PRICING SECTION (THE NEW FEATURE!)
[ ] Scroll down on detail screen
[ ] See "💰 Market Prices" heading
[ ] See "TCGPlayer (USA)" card
[ ] Shows Normal condition price ($)
  [ ] Shows Holofoil condition price ($)
[ ] Shows Reverse Holo condition price ($)
[ ] Shows price ranges (low - high)
[ ] See "CardMarket (Europe)" card
[ ] Shows average sell price (€)
[ ] Shows 30-day average (€)
[ ] Shows lowest price (€)
[ ] Shows update timestamps

ERROR HANDLING
[ ] (Optional) Turn off WiFi
[ ] Error message appears with explanation
[ ] "Try Again" button is visible
[ ] Turn WiFi back on
[ ] Tap "Try Again" → Should load from cache or fresh

PERFORMANCE
[ ] First load: Takes 2-5 seconds
[ ] After first load: Nearly instant
[ ] Scrolling through cards: Smooth
[ ] Opening card detail: 1-2 seconds (pricing loads)
[ ] Searching: Instant (from cache)

================================================================================
🔍 TESTING SPECIFIC FEATURES
================================================================================

TEST 1: Live Card Data
Action: Search for a Pokémon name
Expected: See real cards from TCGdex API
Example:
• Search "pikachu"
• See multiple Pikachu cards
• Each has real image, number, set

TEST 2: Search by Card Number
Action: Search for card number
Expected: Find exact card
Example:
• Search "25/102" (Pikachu from Base Set)
• See that specific card
• Or search "25/" to see all #25 cards

TEST 3: TCGPlayer Pricing (USA Market)
Action: Tap a card, scroll to pricing
Expected: See TCGPlayer prices with $
Example:
• Normal condition: $2.50
• Holofoil: $12.99
• Reverse Holo: $5.49
• Range: $2.00 - $15.00

TEST 4: CardMarket Pricing (Europe Market)
Action: Tap a card, scroll to pricing
Expected: See CardMarket prices with €
Example:
• Avg Sell: €2.30
• 30-Day Avg: €2.15
• Lowest: €1.80

TEST 5: Multiple Conditions
Action: Tap a card with pricing, scroll
Expected: See different card conditions
Conditions:
• Normal (regular card)
• Holofoil (shiny)
• Reverse Holo (reverse shiny)

TEST 6: Results Counter
Action: Type in search box
Expected: See "X of Y cards" message
Example:
• "pikachu" → "5 of 200 cards"
• Clear search → "200 cards available"

TEST 7: No Results State
Action: Search for impossible term
Expected: See friendly message
Example:
• Search "xyzabc"
• See: "No cards found for 'xyzabc'"
• See: "Try searching for a different name"

TEST 8: Loading State
Action: Kill the app and restart
Expected: See loading message
Example:
• "Loading Pokémon cards from TCGdex..."
• "This may take a moment on first load"
• Wait 2-5 seconds

TEST 9: Offline/Cache
Action: (Optional) Turn WiFi off, restart app
Expected: See cached data
Result:
• App may take longer (no refresh)
• But should still show cards from cache
• Pricing may not load (requires API)

TEST 10: Image Loading
Action: Tap several cards
Expected: See card images from TCGdex
Quality:
• Should be clear 250x350px images
• Some cards might have placeholder (API issue)
• App still works without image

================================================================================
📊 WHAT YOU'LL SEE
================================================================================

SEARCH SCREEN (when app starts):

```
┌─────────────────────────────────┐
│ 🔍 Search cards                 │
│ [Search input box]              │
│ 200 cards available             │
├─────────────────────────────────┤
│ [Card 1] Pikachu 25/102         │
│ [Card 2] Charizard 4/102        │
│ [Card 3] Blastoise 2/102        │
│          ... more cards ...     │
└─────────────────────────────────┘
```

CARD DETAIL SCREEN (after tapping a card):

```
┌─────────────────────────────────┐
│           [Card Image]          │
├─────────────────────────────────┤
│           Pikachu               │
│ Card Number    25/102           │
│ Rarity         ★ Holo Rare      │
│ Set            Base Set         │
│ HP             40               │
│ Type           Electric         │
│ Artist         Ken Sugimori     │
├─────────────────────────────────┤
│ Weaknesses:                     │
│   Fighting +20                  │
├─────────────────────────────────┤
│ 💰 Market Prices                │
│ ┌─────────────────────────────┐ │
│ │ TCGPlayer (USA)             │ │
│ │ Normal      $2.50 ($2-$5)   │ │
│ │ Holofoil    $15.99 ($10-20) │ │
│ │ Rev Holo    $8.49 ($5-$12)  │ │
│ │ Updated: 6/1/2026          │ │
│ └─────────────────────────────┘ │
│ ┌─────────────────────────────┐ │
│ │ CardMarket (EU)             │ │
│ │ Avg Sell    €2.30           │ │
│ │ 30-Day Avg  €2.15           │ │
│ │ Lowest      €1.80           │ │
│ │ Updated: 6/1/2026          │ │
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

LOADING SCREEN (first run, 2-5 seconds):

```
┌─────────────────────────────────┐
│                                 │
│         [Loading...]            │
│                                 │
│ Loading Pokémon cards from      │
│ TCGdex...                       │
│                                 │
│ This may take a moment on       │
│ first load                      │
│                                 │
└─────────────────────────────────┘
```

ERROR SCREEN (if WiFi off):

```
┌─────────────────────────────────┐
│                                 │
│            ⚠️                   │
│                                 │
│ Failed to load Pokémon cards.   │
│ Please check your internet      │
│ connection.                     │
│                                 │
│       [ Try Again ]             │
│                                 │
└─────────────────────────────────┘
```

================================================================================
🎯 EXPECTED BEHAVIOR
================================================================================

FIRST LOAD (Slow - Normal):
Time: 2-5 seconds
Reason: Fetching 5 sets (~100-200 cards) from TCGdex API
What happens: 1. App loads 2. Shows "Loading Pokémon cards..." message 3. Fetches from API 4. Caches locally 5. Shows search screen with cards

SECOND+ LOADS (Fast - Normal):
Time: <1 second
Reason: Using cached data
What happens: 1. App loads 2. Shows cards from cache immediately 3. Updates cache in background (if >1 hour old)

SEARCHING (Instant - Normal):
Time: <100ms
Reason: Searching cached data in memory
What happens: 1. Type in search box 2. Results filter instantly 3. Shows "X of Y cards" counter

VIEWING PRICING (Slow - Normal):
Time: 300-500ms per card
Reason: Fetching pricing from API on-demand
What happens: 1. Tap a card 2. Detail screen opens instantly 3. Basic info shows immediately 4. Pricing section loads (300-500ms) 5. Shows TCGPlayer + CardMarket prices

MISSING PRICING (Optional - Normal):
Time: Card shows anyway
Reason: Pricing is optional, doesn't block display
What happens: 1. Some cards might not have pricing 2. Section shows "Pricing data not available" 3. Card details still visible 4. App continues to work normally

================================================================================
🆘 TROUBLESHOOTING
================================================================================

Q: "npm install" fails
A: Try:

- npm cache clean --force
- rm -r node_modules
- npm install again

Q: App shows blank screen
A: Try:

- npm start -- --clear
- Or manually clear Expo cache

Q: Cards don't load (error message)
A: Check:

- Internet connection
- WiFi is working
- No firewall blocking api.tcgdex.net
- Tap "Try Again" button

Q: Pricing doesn't show
A: This is OK! Pricing is optional

- Card still displays correctly
- Some cards might not have pricing
- App works fine without it

Q: Images don't load
A: This is OK! App works without images

- Some images might fail (CDN issue)
- Card details still visible
- Try refreshing the page

Q: App is slow on first load
A: This is NORMAL

- First load: 2-5 seconds (fetching data)
- Subsequent loads: Instant (cached)
- This is expected behavior

================================================================================
📞 SUPPORT
================================================================================

If something doesn't work:

1. Check IMPLEMENTATION_COMPLETE.md
   → Explains all changes made

2. Check package.json
   → Should have @tcgdex/sdk and axios

3. Check node_modules folder
   → Should exist and contain modules
   → If not, run npm install again

4. Check internet connection
   → API requires internet
   → Can't fetch without WiFi/network

5. Check console for errors
   → npm start shows errors
   → Helpful for debugging

================================================================================

Ready to test? Start here:

cd d:\apps\xmon\pokemon-tcg-app
npm install
npm start

Good luck! 🚀

================================================================================
