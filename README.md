# Touchline — Soccer Manager

A browser soccer management game. Buy and sell players, choose your starting XI, train your squad, manage morale and finances, expand the stadium, and play through league seasons.

## Play locally

Open `public/index.html` in your browser. No build or installation is needed. Career progress autosaves in browser local storage. Saves belong to that browser and site address; opening the deployed site will start a separate career from a downloaded file.

## Choose players

Open **Squad**, then click a position on the pitch to select or replace its player. You can also use the squad checkboxes. **Auto-pick XI** chooses the strongest available players for your formation. Tired players can play with reduced performance; injured players cannot play. Any missing positions are explained after Auto-pick.

## Team talks

Team talks give up to +4 morale to each player, with smaller gains as confidence rises. A talk cannot raise morale above 80. Play three matches between talks; reloading and changing seasons preserve the cooldown. The Training screen shows when the next talk is available. Existing careers are upgraded automatically.

## Supporters and ticket prices

Fan support is rated from 0 to 100 and affects attendance. Wins lift support, defeats reduce it, and home ticket prices above the supporters’ budget damage support after the match. Affordable prices can help rebuild it. Results also grow or shrink the underlying fan base over time.

Demand depends on fan support, fan-base size, recent form, league position, and ticket prices. Expensive tickets reduce demand sharply, so £40 is not automatically the most profitable option. Stadium expansion raises capacity without creating extra supporters. Use **Finances** to compare projected attendance and gate revenue at each price; match reports show the actual crowd and fan-support change.

Existing saves receive supporter data automatically. Reloading or changing ticket prices does not directly change support; reactions happen at matches. The fan base and support persist into the next season.

## Unique player names

Players are named from thousands of combinations across 14 regional name pools. Names are reserved for the entire career, including sold players and expired transfer listings, so refreshes and reloads do not reuse them. Very long careers can generate additional names with middle names when the base pool is exhausted.

Existing saves automatically rename duplicate entries, preserving the first squad player with each name and keeping every player’s ID, rating, wages, and other attributes. An explicit new career starts a new name registry.

## Deploy to Cloudflare Workers

Connect this repository to Cloudflare Workers Builds. Leave the build command empty and use `npx wrangler deploy` as the deploy command, with the repository root as the working directory. `wrangler.jsonc` serves the game from `public/`.

For Cloudflare Pages, select no framework, leave the build command empty, and use `public` as the output directory.

## Tests

Requires Node.js. Run `node tests/selection.cjs`, `node tests/team-talk.cjs`, `node tests/fans.cjs`, and `node tests/names.cjs` from the repository root. This checks Auto-pick with exhausted players, empty-slot selection, direct replacement, injury rules, formation changes, and match progression. Team-talk tests cover diminishing gains, repeated clicks, the three-match cooldown, reload persistence, season boundaries, and existing saves.

All players and clubs are fictional. Match outcomes are simulated locally; no AI service or API key is required.

Fan tests cover price-sensitive demand, ticket revenue tradeoffs, fan reactions, stadium expansion, match accounting, reloads, and old-save migration.

Name tests generate thousands of players and check uniqueness, pool exhaustion, reloads, retired names, old-save repairs, season refreshes, and explicit career resets.
