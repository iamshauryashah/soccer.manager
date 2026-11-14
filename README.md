# Touchline — shared soccer leagues

Manage a named football club with friends on separate computers. The main page now uses a shared online world. Each world has three 20-team leagues, common fixtures and tables, promotion/relegation, shared transfer listings, sponsors, training, morale, fans and finances.

## Play with friends

1. Open the deployed game. Everyone should use the same **world code** (the default is `TOUCHLINE`). Use a different 4–20 character code to start another group.
2. Enter a unique club name and choose **Create club / join world**. Each new manager takes an available computer-controlled League 3 club. Joining mid-season takes over that club’s current league record.
3. Store your **manager key** privately. The game remembers it in this browser. On another computer, enter the world code and key and choose **Open my club**.
4. Prepare your squad and click **Ready for matchday**. When all managers are ready, the server simulates that matchday once. Managers in the same league play each other home and away as scheduled.
5. If somebody is away, the first ready manager starts a 24-hour deadline. At the deadline, unready clubs play automatically with their saved setup and an available lineup. A club unable to field eleven uninjured players forfeits 3–0; two such clubs draw 0–0.

Ready managers can **Unready** to make changes before the round advances. At season end, ready up again to begin the next shared season. Standings, promotions, prizes, and sponsor expiry stay synchronized for everyone. A world can eventually contain up to 60 managed clubs; new managers require an available League 3 club (initially 20 slots).

**Club & manager key** lets you rename your club, view your recovery key, or switch accounts. Club names are unique within a world. Share world codes, not manager keys: a key controls its club.

## What is shared

- All 60 clubs’ standings and the 38-round calendar.
- One authoritative result per fixture, mirrored for both human managers.
- One global transfer market across **all worlds**, with stronger-player pools for the higher leagues. Every listing represents one player: only one club anywhere can win and sign that player. Matchdays and seasons do not split the transfer pool.
- Player-name history across the world, including sold players and expired listings. Catalog players use unique dotted middle initials and stable IDs to avoid collisions with generated club recruits.

Each manager controls only their own squad, tactics, budget, sponsors and tickets. The browser sends individual actions; it cannot upload money, ratings, or match results. Private manager keys are not included in standings or other managers’ snapshots. The server stores hashes of the keys.

## Existing solo careers

The **Solo career** link opens `/solo.html`, which retains the previous browser-local save on the same site. Online clubs start fresh to keep shared competition fair; solo squads and money are not imported. Online debt does not reset the shared world or remove a manager: the club continues and must sell players or reduce spending to recover.

## League rewards

| League | Prize range | Audience multiplier | Transfer ratings |
| --- | --- | --- | --- |
| League 3 | £250k–£2m | ×1.0 | 55–74 |
| League 2 | £1m–£7m | ×1.5 | 66–84 |
| League 1 | £3m–£25m | ×2.4 | 78–93 |

Top three move up and bottom three move down at season end. There is no promotion above League 1 or relegation below League 3. Higher leagues bring larger sponsor offers, stronger transfers and greater fan demand. Expensive tickets can still reduce attendance and support.

## Deploy to Cloudflare Workers

The deploy command remains **`npx wrangler deploy`** from the repository root. `wrangler.jsonc` includes the Worker entrypoint, static assets, the `LEAGUE_WORLDS` Durable Object binding, and its initial SQLite-backed migration. Wrangler provisions the namespace on the first deployment. No database ID, third-party API key, or separate backend service is needed.

This version requires **Workers**, not a static Pages-only deployment. Use the existing Worker’s GitHub build integration. Wrangler runs the source-generation commands before bundling. Cloudflare runtime/account limits still apply.

Worlds persist in a SQLite-backed Durable Object per world code. A separate `TRANSFER_MARKET` Durable Object owns the global auctions, winning-club records, and delivery outbox. State is stored atomically in bounded chunks; concurrent actions are serialized, and deadlines use Durable Object alarms. Existing world data must be preserved when changing future migration tags.

## Development and tests

- `npm run build`: regenerate the authoritative engine and online UI from the solo game.
- `npm test`: run all gameplay, shared-world, and online UI tests. No npm dependency installation is needed for the test suite.
- `npx wrangler dev --local`: run the actual Cloudflare local runtime.
- `npm run dev`: run a dependency-free Node preview adapter. Its local saves are in ignored `.local-worlds/`; this adapter is not the production storage implementation.

`public/solo.html` contains the base game rules. `scripts/build-engine.cjs` generates `src/engine.js`; `scripts/build-online.cjs` combines the UI with `scripts/online-actions.js` to generate `public/online-game.js` and `public/index.html`. Keep these generated files current through the build command.

Tests cover all prior gameplay plus independent manager keys, club naming, concurrent purchases, action ownership, mirrored head-to-head scores, stale/repeated ready requests, durable reload, deadline recovery, a full shared season, synchronized promotion, and named-club UI initialization.

Existing online worlds connect to the global market on their next load without changing owned players, money, standings, or readiness. Catalog player IDs occupy a separate namespace from existing recruits. Global sold-player records prevent purchased players from reappearing, including after a restart.

## Global bidding

Click **Bid +** in Transfers. The first offer must meet the guide fee and opens a two-minute auction. Other managers, including managers in different worlds, can outbid it. Each new offer must increase the current bid by at least 5% or £10k, whichever is larger. Late offers leave at least 30 seconds for a response.

The club’s available cash is reduced while its offer leads. A higher self-offer holds only the extra amount. Outbid offers are refunded automatically. At closing time, the player is delivered to the single winning club; held funds cover the transfer fee. Other worlds cannot sign the same player. Auction deadlines use real time and do not depend on when a world advances its league season.

Available squad slots are reserved with active bids. Auction deliveries use a persisted outbox and per-event receipts; retries cannot duplicate players or refunds. Uncertain bid responses keep their escrow reserved and retry the same bid identity. If an award cannot be delivered, its funds are released and the player returns to bidding. New listings refill the market as completed transfers leave it. Released/sold club players are not automatically relisted globally.

Deploying this version will require the additional `global-transfers-v2` migration in `wrangler.jsonc`, which creates the `TransferMarket` Durable Object namespace. The existing league-world migration is retained unchanged.

## Visible team rating

The page header shows **TEAM OVR** throughout the game, including the dashboard and Squad screen. It is the average base overall of the 11 selected starters, shown to one decimal place, and updates when the lineup changes. The Squad screen repeats it beside the starting XI. Benched players do not affect it; fitness, morale, and tactics still affect match performance separately. An incomplete, injured, or positionally invalid lineup shows a selection prompt instead of a misleading rating.

Sold players re-enter the global transfer market for the selling club’s current league. The selling club receives its normal 80% sale value immediately, and the player leaves the squad and lineup. Other managers can bid using the standard two-minute auction. The market owns the listing and retains later auction proceeds. Player attributes are preserved; original club recruits receive a global market ID, while previously purchased players retain theirs. Unconfirmed listings are saved and retried automatically without a second payment or duplicate listing.

Sale offers are recalculated from the player’s current OVR using the current league’s transfer-price scale. The club receives 80% of this current valuation; the shared resale listing uses the full valuation as its guide fee. Training improvements affect future offers even for older saves, independently of past purchase prices or stored historical values.

Auto-ready is an optional per-manager timer in the shared-world controls. It defaults to five minutes and accepts whole-minute intervals from 1 to 1,440. Durable Object alarms mark the club ready after that preparation period on each matchday even when the browser is closed. The usual all-managers-ready / 24-hour deadline rules still control when matches play. Every completed matchday starts a fresh timer; missed intervals never fast-forward multiple matches. Invalid lineups trigger Auto-pick, and a club without a valid XI pauses Auto-ready. The timer pauses at season end until managers start the next season. Settings survive reloads and server restarts. Stop cancels future auto-ready actions; manually marking the club unready also disables the timer.

The **Clubs & Offers** tab lets authenticated managers inspect other managed squads in their own world, across all three leagues. Squad views include player ratings, potential, age, fitness, morale, injuries, wages and lineup status; finances and manager credentials stay private. A manager can offer a custom whole-pound price for a specific player. The owner may accept or reject, and the buyer may withdraw. Offers expire after 48 hours and do not reserve money. Acceptance rechecks both clubs are unready, buyer cash and reserved auction squad slots, and the seller’s formation/minimum roster requirements. On acceptance the full agreed fee and the player move atomically within the world. Other offers for that player close. Previously auctioned players also update the global ownership register through a persisted retry queue before another sale is allowed.
