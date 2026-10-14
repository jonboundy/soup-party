# Product vision

Soup Party is a small, exceptionally well-designed RSVP website for a casual soup potluck (event: November 2026) — everybody brings soup, everybody tries the other soups. Planned production URL: https://soup.jonboundy.com. Snapshot of the PRD as of 2026-10-10; see [prd and jira links](prd-and-jira-links.md).

**It is not a competition.** No voting, ranking, judging, winners, scorekeeping, leaderboards, awards, or ratings — and no copy that references competition.

**Why:** the humor comes from the disproportionate care given to coordinating soup. The site should "feel more polished than the occasion requires": polished, minimal, deadpan; never meme-heavy, noisy, or forced.

**Outcomes:** primary — guests RSVP, say what soup they'll bring, and see existing soups to avoid duplicates. Secondary — a few delightful, highly crafted interactions.

**Principles (how to apply when making build decisions):**
1. RSVP first — fast and clear on mobile; no guest accounts.
2. Soup coordination — show existing soups before a guest chooses; warn about likely duplicates but never block them.
3. Understatement — matter-of-fact copy; no memes, competitions, dramatic fake alerts, confetti, or pointless interruption.
4. Privacy — reveal only deliberate public fields; private management tokens never appear in public endpoints.
5. Progressive enhancement — artful interactions may enrich the site but must never prevent RSVPing.
6. Independence — separate Next.js app at soup.jonboundy.com; do not touch the existing jonboundy.com website.

**Voice:** concise, literal, faintly over-formal. No jokes at guests' expense. Default copy strings:
- Hero: "Soup is happening.", and since 2026-10-13 the event's title, "Soup Party 2: Electric Boogaloo", in uppercase above it, with "Electric Boogaloo" as a tomato neon sign that sputters on as the page loads and flickers now and then, like an old sign (see [scope and tickets](scope-and-tickets.md))
- Supporting: "Everyone brings soup. Everyone eats soup."
- Primary action: "I'll be there" or "RSVP"
- Registry title: "The soups" (no full stop since 2026-10-13; Jon keeps one only on the hero. The RSVP section is headed "RSVP")
- Empty registry: "No soups yet."
- RSVP confirmation: "You're on the list."
- Soup confirmation: "Your soup has been registered."
- Duplicate warning: "This soup has already been registered."
- Footer: "© 2026 Soup Party", and since 2026-10-13 "Sponsored by GoochBuddy and Opossum Catcher" (see [scope and tickets](scope-and-tickets.md))

**Information architecture:** one primary landing page (wordmark/nav, high-impact hero, restrained soup imagery or interactive bowl, event details, visible registered soups, RSVP form/action, quiet footer). Supporting views: confirmation/edit view and protected host dashboard. Avoid unnecessary navigation levels.

**Look and feel:** warm off-white backgrounds, near-black typography, subtle tomato or earthy accent; generous negative space; elegant sans-serif; soft borders; disciplined spacing; minimal elevation; high-quality soup photography or a polished illustration.

**Motion:** short, subtle transitions; no bouncing, blinking, autoplay spectacle, or scrolling obstacles. Support touch, keyboard, reduced-motion, and high-contrast/accessible typography.
