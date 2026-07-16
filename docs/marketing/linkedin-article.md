# Why does a plane ticket cost more every time you refresh the page? (And what your business can learn from it)

Book a flight three months out, then check the same flight again next week, and
again the week after that. The price moves — sometimes up, sometimes down —
without a single person retyping a number. That's not random, and it's not
a trick. It's a well-understood branch of math called **revenue management**,
and airlines have been running on it since the 1990s. I built a small,
open-source, interactive tool that shows exactly how it works — and the
underlying idea turns out to apply far beyond airplanes.

## The problem, in plain terms

An airline seat has one brutal property: **the moment the plane pushes back
from the gate, every empty seat becomes worth exactly nothing.** You can't
put it in a warehouse and sell it next month like a sweater. It just
evaporates.

At the same time, not every customer values that seat equally. A family
booking a vacation four months out will happily take a cheaper fare and a
worse time slot. A businessperson who has to be in another city tomorrow
morning will pay much more for the same seat, booked much later.

Put those two facts together and you get a real dilemma:

- **Price too low, too early**, and you sell out the plane with vacationers
  months in advance — then have nothing left to sell to the last-minute
  business travelers who would have paid double.
- **Price too high, too rigid**, and the plane takes off half full, and
  every one of those empty seats' potential revenue is gone forever.

A single fixed price can't solve this. You need a system that constantly asks:
*given how many seats are left, and how much time is left before departure,
what's the right price to charge right now?*

## The four ideas that make it work

Strip away the statistics and the model comes down to four ideas anyone can
follow:

**1. Different customers, different segments.** Don't treat all demand as one
blob. Leisure travelers and business travelers respond to price differently
and book at different times — model them separately instead of guessing at
one average customer.

**2. Protect what's scarce for the customer who hasn't shown up yet.** This is
the counterintuitive part: sometimes the right move is to *refuse* to sell a
seat cheaply today, because the math says a higher-paying customer is likely
to want it later. This is exactly what airlines mean when they "hold back"
seats in a fare class.

**3. Keep checking your work as reality unfolds.** The plan you make three
months before departure shouldn't be the plan you're still following the day
before. As bookings actually come in, the system re-checks itself again and
again, and adjusts the price to match how the flight is really filling —
not how it was expected to fill.

**4. Never let the math run wild.** A price floor (never sell below what it
costs you), a price ceiling (never gouge), and a limit on how much the price
can jump at once. These are guardrails a human sets — the algorithm just
enforces them, every time, without getting tired or making an exception for
the wrong reason.

That's it. Segment demand, protect scarce inventory for higher value later,
re-optimize continuously, and stay inside guardrails. The actual technique
behind step 2 — called **EMSRb** — is 35-year-old, well-validated statistics,
not some black-box AI. It's explainable, auditable, and it's been running
quietly behind almost every plane ticket you've ever bought.

## This isn't just about planes

Once you see the pattern, you start noticing it everywhere. The core
ingredients — **something perishable, uneven demand, and a finite window to
sell it in** — show up across a surprising number of industries:

- **Hotels and short-term rentals.** An empty room tonight is gone forever
  the moment midnight passes. Same math, different seat.
- **Live events and concerts.** An unsold seat at a show has zero value the
  second the curtain goes up.
- **Cloud computing capacity.** Unused server capacity this minute can't be
  banked and sold next minute — which is exactly why cloud providers
  price spot capacity dynamically.
- **Ride-sharing.** "Surge pricing" is the same demand/supply rebalancing
  act, just recalculated in real time instead of over months.
- **Advertising inventory.** An ad slot that doesn't sell before the page
  loads is gone — impressions are perishable inventory too.
- **Seasonal retail.** Not identical, but the same tension: hold price and
  risk unsold stock at season's end, or discount and leave money on the
  table with customers who'd have paid full price.

If your business has scarce capacity, a deadline after which unsold
inventory is worthless, and customers with different willingness to pay —
you likely already have a revenue-management problem, whether or not you've
named it that.

## Seeing it, not just reading about it

Reading about this is one thing; watching the price curve reshape itself the
instant you move a slider makes it click. That's why I built **Flight Pricing
Studio** — a free, open-source, interactive demonstration of this entire
model, running live in the browser:

**Try it: https://flight-pricing.troche.workers.dev**

You can drag the sliders — capacity, demand mix, price sensitivity, how far
out people book — and watch the price curve, the load-factor curve, and the
expected revenue recompute instantly. There's also a Monte Carlo simulator
that stress-tests the pricing policy against thousands of randomized demand
scenarios, and a validation exhibit comparing the dynamic policy against a
single flat fare across ten synthetic route types (it wins by roughly
4–5% on average, with the gap widest on price-sensitive leisure routes and
smallest on business-heavy ones — exactly what the theory predicts).

Here's how the whole thing fits together under the hood — one shared pricing
engine, running identically in your browser and on the server, so there's
never a mismatch between what the interface shows you and what the API
would actually quote:

![Flight Pricing Studio system architecture: a shared TypeScript pricing engine is bundled into both the visitor's browser, for instant client-side interactivity, and a small server Worker that serves the UI and an API — both sides run the identical engine code, communicating over HTTP only for the initial page load and optional server-side cross-checks.](../../apps/web/public/architecture.svg)

Everything — the pricing engine, the simulator, and the write-up of the
underlying method for a technical audience — is open source. Poke around,
break it with extreme inputs (it's designed not to crash), or just watch what
happens to the price curve when you make business travelers a bigger share of
demand.

**Live demo:** https://flight-pricing.troche.workers.dev
**Source code:** https://github.com/jose-troche/flight-pricing

*All figures and data in the tool are synthetic and illustrative — not real
airline fares, schedules, or revenue.*
