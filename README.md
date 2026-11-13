# Touchline — Soccer Manager

A browser soccer management game. Buy and sell players, choose your starting XI, train your squad, manage morale and finances, expand the stadium, and play through league seasons.

## Play locally

Open `public/index.html` in your browser. No build or installation is needed. Career progress autosaves in browser local storage. Saves belong to that browser and site address; opening the deployed site will start a separate career from a downloaded file.

## Choose players

Open **Squad**, then click a position on the pitch to select or replace its player. You can also use the squad checkboxes. **Auto-pick XI** chooses the strongest available players for your formation. Tired players can play with reduced performance; injured players cannot play. Any missing positions are explained after Auto-pick.

## Team talks

Team talks give up to +4 morale to each player, with smaller gains as confidence rises. A talk cannot raise morale above 80. Play three matches between talks; reloading and changing seasons preserve the cooldown. The Training screen shows when the next talk is available. Existing careers are upgraded automatically.

## Deploy to Cloudflare Workers

Connect this repository to Cloudflare Workers Builds. Leave the build command empty and use `npx wrangler deploy` as the deploy command, with the repository root as the working directory. `wrangler.jsonc` serves the game from `public/`.

For Cloudflare Pages, select no framework, leave the build command empty, and use `public` as the output directory.

## Tests

Requires Node.js. Run `node tests/selection.cjs` and `node tests/team-talk.cjs` from the repository root. This checks Auto-pick with exhausted players, empty-slot selection, direct replacement, injury rules, formation changes, and match progression. Team-talk tests cover diminishing gains, repeated clicks, the three-match cooldown, reload persistence, season boundaries, and existing saves.

All players and clubs are fictional. Match outcomes are simulated locally; no AI service or API key is required.
