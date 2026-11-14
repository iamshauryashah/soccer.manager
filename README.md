# Touchline — Soccer Manager

Build Northbridge FC from League 3 to the top flight. Manage players, tactics, training, fan support, ticket prices, finances, and sponsorship contracts across a three-league pyramid.

## Play

Open `public/index.html` in a browser. Everything runs locally; no build or API key is required. Progress autosaves in that browser at that address.

## The league pyramid

New careers begin in League 3. Each of the three leagues has 20 clubs, playing 38 matches home and away. All 60 clubs play each matchday, and you can view every table on the League screen.

At season end, the top three in Leagues 2 and 3 are promoted. The bottom three in Leagues 1 and 2 are relegated. There is no promotion above League 1 or relegation below League 3. Clubs move when you start the next season. Rankings use points, goal difference, goals scored, and club ID as the final tie-breaker.

| League | Prize range | Fan-demand multiplier | Transfer rating range |
| --- | --- | --- | --- |
| League 3 | £250k–£2m | ×1.0 | 55–74 OVR |
| League 2 | £1m–£7m | ×1.5 | 66–84 OVR |
| League 1 | £3m–£25m | ×2.4 | 78–93 OVR |

Prizes descend with finishing position and are paid once in the league you completed. Promotion adds up to 10 fan-support points and increases the fan base by 20%; relegation reduces support by up to 10 and the fan base by 15%. Existing attendance, affordability, and stadium-capacity rules still apply. Transfer fees and wages also rise for stronger-league recruits.

## Transfer sorting

On the Transfers screen, click **Overall: high to low** to show the highest-rated players first. Sorting also applies to position filters and new listings, and the preference is saved with your career.

## Sponsorship management

Use **Sponsors** to choose a contract for the remainder of the season:

- **Riverside Mutual:** reliable guaranteed income.
- **Stride Sports:** lower guaranteed income plus win bonuses.
- **Townline Travel:** income plus a home bonus for at least 75% occupancy.

Signing fees arrive once. Weekly and conditional bonuses are paid after matches and appear in cash flow and match reports. Contracts cannot be repeatedly switched for signing fees; they expire at season end. Signing late prorates the upfront fee. League 2 offers scale by ×2.4 and League 1 by ×6 relative to League 3. No sponsor means no sponsorship income.

## Existing careers

The old eight-team campaign is archived and a new League 3 campaign begins. Squad, player IDs and attributes, money, stadium, fan support, fan base, name history, and team-talk cooldown are preserved. Current league tables and fixture schedules restart together so no club receives an unfair points advantage. A message in the club journal explains the upgrade. The migration runs only once.

## Tests

Run `npm test` or `node tests/run.cjs`. No package installation is needed.

Tests cover full 38-match seasons, all promotion/relegation boundaries, 60 unique clubs, prize accounting, sponsor fees and conditional payouts, save migration, transfers, fans, team talks, squad selection, and player-name uniqueness.

## Cloudflare configuration

`wrangler.jsonc` serves `public/`. The eventual Workers deploy command is `npx wrangler deploy`, with no build step. For Pages, use no framework, no build command, and `public` as the output directory. 
