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
- Transfer listings per division. If two managers try to sign one player, the first completed purchase wins; a player cannot join two squads.
- Player-name history across the world, including sold players and expired listings.

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

Worlds persist in a SQLite-backed Durable Object per world code. State is stored atomically in bounded chunks; concurrent actions are serialized, and deadlines use Durable Object alarms. Existing world data must be preserved when changing future migration tags.

## Development and tests

- `npm run build`: regenerate the authoritative engine and online UI from the solo game.
- `npm test`: run all gameplay, shared-world, and online UI tests. No npm dependency installation is needed for the test suite.
- `npx wrangler dev --local`: run the actual Cloudflare local runtime.
- `npm run dev`: run a dependency-free Node preview adapter. Its local saves are in ignored `.local-worlds/`; this adapter is not the production storage implementation.

`public/solo.html` contains the base game rules. `scripts/build-engine.cjs` generates `src/engine.js`; `scripts/build-online.cjs` combines the UI with `scripts/online-actions.js` to generate `public/online-game.js` and `public/index.html`. Keep these generated files current through the build command.

Tests cover all prior gameplay plus independent manager keys, club naming, concurrent purchases, action ownership, mirrored head-to-head scores, stale/repeated ready requests, durable reload, deadline recovery, a full shared season, synchronized promotion, and named-club UI initialization.
