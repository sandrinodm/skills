# Layout patterns

Coordinates for the canvas: 760 wide, 24 margin, so content runs from x=24 to x=736 (712 wide). Title baseline y=34, subtitle y=54, content from y=72. Height = bottom of the lowest element + 24.

Every number below comes from a diagram that was judged good. Treat them as defaults, not law: when content doesn't fit, change the count of things (fewer boxes, shorter words) before you change the geometry.

Contents:
1. Anatomy: the parts inside one thing
2. Lanes: where things sit between two parties
3. Sequence: who talks to whom, in order
4. Flow: steps from left to right
5. Comparison: options side by side
6. Zones: trust boundaries and areas
7. Layers: a stack
8. System context: what a system talks to
9. Event-driven: who publishes and who reacts
10. State machine: the life of one thing
11. Swimlane: who does what, in order
12. Data model: tables and how they relate
13. Timeline: what happens when
14. Quadrant: two dimensions at once
15. Tree: what contains or reports to what
16. Feature matrix: options against capabilities
17. Pyramid: levels that build on each other
18. Cycle: a loop with no end
19. Board: work in flight
20. Infrastructure: where things run
21. Annotated artifact: the parts of one real thing
22. Decision tree: questions that lead to an answer
23. Concentric rings: what sits inside what
24. Journey map: one person's experience, stage by stage
25. Service blueprint: what the customer sees, and what happens behind it
26. Byte layout: the fields of a format
27. Branch graph: how work flows between branches
28. Fishbone: causes grouped around one problem
29. Causal loop: causes that feed back on themselves
30. Wardley map: how visible and how mature each part is
31. Text fitting and spacing

---

## 1. Anatomy: the parts inside one thing

Example: `examples/smart-speaker-anatomy.svg`. Use when the point is what something is made of and how it touches the outside world.

- **Outside actor** on top (optional): box x=200 y=76 w=360 h=56, centered name (`name mid`) at y+24, note at y+40.
- **Two arrows** between actor and container, 40 tall (y 132→172), at x=340 (down) and x=420 (up). Labels at y=156: left one `note end` at x=332, right one `note` at x=428.
- **Container**: x=24 y=172 w=712. Label `name` at (40, 196). Children start 40 below the container top.
- **Parts grid** inside the container spans x=40 to 720 (680 wide). Pick the grid by how many parts there are; never leave a hole in a grid.
  - 6 parts: 3 columns of 216 at x=40, 272, 504 (16 gap), rows of 72 at y=212, 300 (16 gap).
  - 5 parts: 3 of 216 on the first row, then 2 of 332 at x=40, 388 on the second, so both rows end at the same edges.
  - 4 parts: 2×2 of 332 at x=40, 388. A 332 box fits a ~50-character note on one line, so these are usually 56 tall (name at y+24, one note at y+40); keep 72 only if a note truly needs two lines.
  - 3 parts: one row of 216. 7–9 parts: add a third row. More than 9: split the diagram.
  - Inside each part: name at y+24, note lines at y+40 and y+56, all at x+12.
  - If arrows run between parts (a pipeline inside the container), use 40 between rows instead of 16 so each arrow has room for its label, and route the flow down one column and up the other rather than zig-zagging.
- **Key band** (the accent): the guard, filter or rule the diagram is about, full width inside the container: x=40 w=680 h=40, name at (56, y+24) and an ink label on the same baseline, starting 16 after the end of the name ("Guard" ends near x=96, so the label starts at 112). Put it where traffic crosses the boundary it protects:
  - checks what goes out (actions, outgoing data): at the bottom, under the parts, with the outputs below it. This is the example's layout.
  - filters what comes in (requests, access): at the top, right under the container label, before the parts. The actor's down-arrow then runs through the container's top edge and stops on the band (y=212), so it's 80 long instead of 40; the up-arrow starts from the band too.
  - filters something in the middle of the flow (for example, documents between an index and the model): between the parts and the thing they draw from, so the filtered path visibly crosses it. Label the arrows on both sides of it ("every match" in, "only documents they can open" out).
  - if the key idea is one of the parts (say, the memory), make that part a `key` box and skip the band.
- Container bottom = the last element inside it + 16.
- The container's name sits top-left; arrows entering through its top edge must stay clear of it. If the name needs a note after it and arrows crowd it, use the Zones pattern's left label column instead.
- **Uneven fan-out** (one part feeds two outside boxes, another feeds none): let the busy part's box span two narrower outside boxes below it, and leave the empty slot at an outer edge, never in the middle.
- **Outside row** below, for what it reaches. Its outer edges line up with the container's edges (x=24 and 736), not with the parts inside: 2 boxes of 344 at x=24, 392 (centers 196, 564); 3 of 216 at x=24, 272, 520 (centers 132, 380, 628); 4 of 166 at x=24, 206, 388, 570 (centers 107, 289, 471, 653). Name-only outside boxes are 40 tall with a centered `name`. Arrows go straight down from the band (or the container) to each box center, 40–56 tall, with one shared label beside the middle arrow saying what passes ("approved actions only").
- Two outside actors (for example, phone app and voice): two boxes of 280 on top, each centered over a column of the grid below so its arrow drops straight into it (over a 2×2 grid: x=66 and 414, arrows at 206 and 554). Drop the up-arrow labels if they would crowd.

## 2. Lanes: where things sit between two parties

Example: `examples/integration-map.svg`. Use for "how does X reach Y", integration maps, channels.

- **Left column**: x=24 y=72 w=168 h=416, title `name mid` at (108, 96). Inner boxes 136×40 at x=40, y=lane+20, label `mid` at (108, lane+44).
- **Right column**: same at x=568 (inner boxes at x=584, labels at x=652).
- **Lanes** in the middle: x=208 w=344 h=80, at y=104, 200, 296, 392 (80 tall, 16 gap). Lane title `name` at (224, lane+24).
- **Chips** in a lane: y=lane+40, h=26, rx=13, gap 8, label `small mid` at y=lane+57. Width = label width + 24 (see section 7).
- **Connectors**: horizontal arrows at y=lane+40 from the inner box (x=176) to the lane (x=208), and from the lane (x=552) to the right inner box (x=584).
- **Shared base** (the accent): x=24 y=504 w=712 h=56, `name` at (40, 526), `small` body at (40, 546). Short plain lines from each column's bottom (y=488) down to it, at the column centers.

Four lanes is the comfortable maximum; with three, keep the 96 step and shorten the columns.

## 3. Sequence: who talks to whom, in order

Example: `examples/cross-app-access-flow.svg`. Use for protocols, auth flows, request/response chains.

- **Participants**: heads 160×52 at y=72. Spread centers evenly from 104 to 656: four → 104, 288, 472, 656; three → 104, 380, 656; five → heads 128 wide, centers 88, 234, 380, 526, 672. Name `name mid` at y=94, role `note mid` at y=112.
- **Lifelines**: `<g class="life">`, one `<line>` per participant from y=124 to the last row + 24.
- **Messages**: first at y=172, then every 48. Draw from the sender's center to 2px short of the receiver's center so the arrowhead lands on the line. Number them: `1 Signs in with company SSO`.
- **Message labels**: 8px above the arrow, class `small`. Between neighbours, center it (`mid`) between the two lifelines. Across several lifelines, start it 12px right of the sender (left-to-right) or end it 12px left of the sender with `end` (right-to-left). Dashed lifelines may run through a label; that's expected.
- **The key step** (accent): an action one participant does on its own (a check, a decision) is a `key` box about 176×48 centered on its lifeline, taking one message row. Text `small strong mid` at top+20 and `small mid` at top+36.
- **Takeaway**: `callout` band x=24 w=712 h=56, 20 below the lifelines' end. `name` at y+22, `small` body at y+42.

More than 8 messages: split the flow into two diagrams (for example "setup" and "every request").

## 4. Flow: steps from left to right

Use for pipelines, processes, lifecycles. No example file; build from these numbers.

- **Steps in a row**: three steps → 216 wide with 32 gaps (x=24, 272, 520); four → 160 wide with 24 gaps (x=24, 208, 392, 576). Height 72: name at y+24, notes at y+40 and y+56, x+12. Four is the maximum per row.
- **Arrows** fill the gaps at the boxes' vertical center. A short horizontal gap can't hold a label: label horizontal arrows only when the gap is 64 or more, otherwise say what moves in the notes. Vertical arrows can always take a label beside them.
- **A second row** continues left to right again (not snake-like): drop an L-shaped connector from the last box of row one (`M x y V y2 H x2`) to the first box of row two, 40 below.
- **Branches**: put the alternative path in a row below the step that branches, connected by a vertical arrow (40 tall) with its condition as a `note` label beside it ("over $500"). Rejoin with an orthogonal path into the side or bottom of the next step.
- **The key step** gets `key` instead of `box`; text inside stays `name` + `small` (ink, not quiet, for readability on the tint).
- **Fan-in, then a split** (several inputs feed one step, which then goes one of two ways): put the inputs in a row above or beside the step, and draw the split as one line down from the step to a short horizontal bus that drops an arrow into each outcome. Label each drop with its condition ("an article covers it", "needs a person").
- **Uneven rows** (one box feeds two things, its neighbour feeds none): let a box span two columns of the row above or below, or leave the empty slot at the outer edge, never in the middle.
- Optional `callout` takeaway band at the bottom.

## 5. Comparison: options side by side

Use for "X vs Y", self-hosted vs hosted, before vs after.

- **Two options**: columns x=24 and x=392, 344 wide (24 gap). **Three**: x=24, 268, 512, 224 wide (20 gap).
- **Header** inside each column: `name` at (x+16, y+24), `note` one-liner at y+40 (product or example names go here as a comma list; use chips only if they fit one row). The first row starts 32 below the note; columns end 16 below their last row.
- **Rows** line up across columns at the same y so the eye can compare: each row is a small `note` label (the dimension, e.g. "Who runs it") with the option's value under it as `small` ink text, 16px line step, 24 between rows. Use the same dimensions in the same order in every column. If one column's value needs two lines, first try shortening it; otherwise give that row two lines' height in every column so the rows stay aligned.
- **The accent**, one of two ways:
  - When one dimension decides the choice, take that row out of the columns and give it its own full-width `key` band under them (x=24 w=712 h=56, 24 below the columns), with its `name` at y+22 and each option's value as `small` text at y+42, aligned with its column's text (x+16).
  - When one option is the recommendation, draw that column with `key` instead of `box`.
  - Don't stretch a `key` box across the columns behind a row: it cuts through the column outlines, and the checker reports it as overlapping boxes.
- Columns use `box`. End with a `callout` verdict only if the title doesn't already say it.

## 6. Zones: trust boundaries and areas

Use when the point is which things live where and what may cross a boundary (security reviews, network zones, team ownership). It pairs naturally with the `zones` theme, but works in every theme.

- **Stacked zones**: full-width containers (`box zone <hue>`, x=24 w=712), one per area, outermost at the top (the internet side first). 24 apart when nothing crosses between them; 48 apart when a labelled arrow crosses, so the label has room.
- **Label column** on the left of each zone (x=40, ~160 wide): the zone's `name`, then one or two `note` lines with its rule ("Reached only from app servers"). Content sits to the right (x=216 to 720). This keeps arrows coming down into a zone clear of its name.
- **Gates**: where traffic enters a zone, put a band across the top of its content area (a `box` for an ordinary gate; `key` for the one that matters). Arrows into a zone enter only through its gate, so the drawing itself shows "inward only".
- When several gate bands stack, start their labels on one shared x so they line up, instead of 16 after each name.

## 7. Layers: a stack

Use for protocol stacks, platform layers, "what sits on what".

- Full-width bands x=24 w=712, 56 tall, 8 apart, top layer first. Layer name `name` at (40, y+22), `small` description at (40, y+42). Chips for concrete examples right-aligned in the band (end at x=720), vertically centered (y+15).
- The layer the diagram is about gets `key`.
- If something spans several layers (for example "identity"), draw it as a narrow vertical `callout` at the right (x=616 w=120) and shorten the bands to end at x=600.

---

## 8. System context: what a system talks to

Example: `examples/type-system-payments.svg`. Use for "the big picture": one system, the people who use it and the systems it depends on (C4's context level).

- **The system** in the middle column: x=296 w=168, from the first row's top to the last row's bottom (at least 120 tall). It is the accent (`key`), with an accent icon (28px) centered above its `name mid` and a two-line `small mid` note, vertically centered.
- **Left column, people and channels**: boxes x=24 w=176 h=72 (icon, name and a note line, with air), one per row, rows 24 apart starting at y=80 (8 lower than other patterns, so the first arrow label clears the subtitle; y=168 if there's a box on top). **Right column, external systems**: x=560 w=176, same rows.
- **Uneven sides** (three people, four systems): center the shorter column on the system's vertical middle rather than top-aligning it, or move one box that naturally sits below (a data store, your own apps that consume the system's output) into the bottom slot.
- **Connections** are horizontal: x=200 to 296 on the left, 464 to 560 on the right, at each box's vertical center, with a short verb (`note mid`, about 14 characters) 8 above the line. Direction says who calls whom; use `marker-start` and `marker-end` together for both ways.
- **Optional top box** (x=296 w=168 h=56 at y=72, arrow down to the system) and **bottom box** (a data store or your own apps: x=280 w=200, 56 below the system, labelled arrow between).
- Up to four boxes per side; more means the system needs splitting.

## 9. Event-driven: who publishes and who reacts

Example: `examples/type-events-orders.svg`. Use for message buses, pub/sub, webhooks fan-out, telemetry pipelines.

- **Producers** in a row at the top (2 to 4 boxes, the outside-row widths: 344, 216 or 166). A single producer is a 216 box centered over the bus (x=272).
- **The bus** is the accent: a full-width `key` band (x=24 w=712 h=64) 64 below the producers, with an accent icon, the bus `name`, a `small` note on the second line ("keeps events 7 days, replayable"), and its topics as `chip amber` pills (monospace `small code`) right-aligned inside.
- **Consumers** in a row 64 below the bus, same widths. A dead-letter queue fed by the bus is just a consumer in `rose`; if the point is retries (the failing consumer writes to it), put it under that consumer instead, with the arrow from the consumer.
- **Icons in four 166 boxes** leave 112px for the name with a plain icon: about 16 name characters. If a name is longer ("Dead-letter queue"), drop icons from the whole row rather than from one box.
- **Arrows** go straight down: producer to bus, bus to consumer. Label each with the event name or subscription in `small code`, 8 right of the arrow (8 left, `end`-anchored, for the last column so it stays inside the margin).

## 10. State machine: the life of one thing

Example: `examples/type-states-order.svg`. Use for order, payment, ticket or task lifecycles.

- **States** are pills: `box` rects 44 tall with rx 22, width = name + 40 (at least 104), centered `name mid`. The happy path runs left to right on one row (center y=132), spread between x=72 and 680.
- **Start** is a filled dot (`btn` circle r=6 at x=36); **end** is a ring with a dot (`glyph` r=9 plus `btn` r=4.5 at x=722). Arrows connect dot, states and ring; each transition's event is a `note mid` 8 above its arrow.
- **Side states** (cancelled, failed, refunded) sit on a second row whose top is 88 below the happy path's center line (top y=220 for center 132), under the state they leave from. A side state that ends the thing's life needs no end ring of its own; the ring marks where the happy path ends. A side state reached from several states gets L-shaped arrows into its sides. A detour that comes back (3-D Secure, retry) uses two parallel vertical arrows, 40 apart, labelled on the outside.
- **A loop** on one state (try the next step) is an orthogonal arc above it: up 28, across, down.
- **A transition back to an earlier state** (reopen, start over) is the same arc stretched between the two: up 28 from the later state's top, across, and down into the earlier state's top, with the event label centered above the horizontal run. A second backward arc goes 20 higher.
- The accent marks the state that matters to the point (the point of no return, the one that waits for a person).

## 11. Swimlane: who does what, in order

Example: `examples/type-swimlane-refund.svg`. Use for cross-team processes and approvals.

- **Lanes** are stacked full-width `box zone <hue>` rows, 92 tall from y=72, touching. Each lane's header is a badge at (40, y+14) with the actor `name` below it at y+68. A plain line at x=152 separates headers from the steps.
- **Steps** are 92 x 48 boxes at x = 164 + 116 x column (columns 0 to 4), y = lane top + 22. Their text is `small mid`, one or two lines of about 13 characters.
- **Arrows**: same lane, straight across; same column, straight down; otherwise across, then down or up in the 24px gap just before the target column (turn at target x - 12), then across into it. Arrows that merge into one step may share their last segment.
- **Two alternative outcomes for one actor** in the same column (refund or close): that lane grows to 156 tall, with steps at lane top + 22 and + 86. The branch arrow rises in the gap before the column and splits into each outcome.
- Put conditions in the step text ("Refunds if the customer wins") rather than on arrows; the gaps are too narrow for labels. Step text is at most 13 characters per line, spaces included. The accent is the step the title is about.

## 12. Data model: tables and how they relate

Example: `examples/type-erd-commerce.svg`. Use for schemas and data ownership.

- **Tables** are 200-wide boxes on a three-column grid (x=24, 280, 536), rows 56 apart. A header 38 tall holds a plain icon (x+12) and the table `name` (x+40, y+25), with a plain line under it. Each field is a 22px row: name in `small` at x+12 (primary keys `small strong`), type in `note code end` at x+188. Write foreign keys' types as "→ customer".
- **Relationships** are plain lines without arrowheads, with cardinality ("1", "n") in `small` next to each end:
  - side by side: a horizontal line between the facing edges at the header's middle (y+19);
  - stacked: a vertical line between the facing edges at the column's center;
  - diagonal: leave the upper table's bottom 40 off-center, cross in the gap between the rows (28 below it), and enter the lower table's top 40 off-center, so the line never passes through another table;
  - around: when the relationships form a loop the grid can't seat side by side or stacked (user → booking → slot → venue → review → user), route the closing line around the outside of a row: down 28 from both tables' bottoms and across under the row (or above the top row). Leave 40 below that row for it.
- The accent is the table everything hangs off, or the one the title is about.

## 13. Timeline: what happens when

Example: `examples/type-timeline-roadmap.svg`. Use for roadmaps, rollout plans and incident timelines.

- **Axis**: a plain line from x=40 to about 720 with ticks at each period boundary; period labels (`note mid`) centered in each period, 18 above the axis. Periods divide the width evenly in whole pixels: stretch the end to make them (six months: 40 to 724, 114 each; four quarters: 40 to 720, 170 each).
- **Bands** (phases) sit above the period labels: pills 28 tall (rx 14), 40 apart per row, spanning their start and end; name in `small` 14 in from the left. Overlapping phases go on different rows. Phases that follow each other on one row are inset 2 from the shared boundary, so a 4px gap shows where one ends. If the dates matter, add them in the band after the name as a `note` ("Jan – Feb") when they fit.
- End the canvas 24 below the lowest milestone label; a timeline is wide and short.
- **Milestones** sit on the axis as dots (`btn` r=5) with a short plain leader down to their label: name `small strong mid`, date `note mid` under it. Alternate label rows (40 and 80 below the axis) so neighbours never collide; keep milestones at least one label-width apart within a row.
- **The accent** is one milestone, drawn as an 18px `key` circle (rx 9) on the axis, or one band. **Today** is a dashed `life` line with a "Today" `note` above the bands.

## 14. Quadrant: two dimensions at once

Example: `examples/type-quadrant-priorities.svg`. Use for prioritization, risk matrices, positioning.

- **Plot**: four boxes (rx 0) tiling x=176 to 736 and y=80 to 464, each with its `name` and a `note` top-left (`small` inside the `key`, which keeps text ink). The quadrant that matters is the `key`, drawn last so its neighbours don't paint over its shared edges. Mark the other three with a hue by meaning (`box rose` for avoid, `box green` for fine) and give all items one shared chip hue.
- **Axes**: the y-axis title (`name end`) at the plot's middle and its "high"/"low" ends (`note end`) in the left gutter at x=160; the x-axis title (`name mid`) and ends (`note`) 24 under the plot.
- **Items** are chips (h 26, rx 13) placed by their two values, each fully inside one quadrant, never on a dividing line. Six to eight items is plenty.

## 15. Tree: what contains or reports to what

Example: `examples/type-tree-cloud.svg`. Use for resource hierarchies, org charts, information architecture.

- **Root** at the top center (x=260 w=240 h=56 at y=72). **Children** in one row 48 below, with the outside-row widths (2, 3 or 4 boxes). **Grandchildren** are indented under their parent: boxes 34 tall, 20 in from the parent's left edge, 44 apart.
- **Connectors** are plain lines without arrowheads: from the root down to a bus 24 above the children, across, and down into each child; from each child a vertical line 10 in from its left edge, with a short elbow into each grandchild.
- The accent marks the node the title is about (where a policy is set, the team that owns the platform).

## 16. Feature matrix: options against capabilities

Example: `examples/type-matrix-auth.svg`. Use when many yes/no facts compare a few options (plans, methods, products).

- **Table**: one outline box (x=24 w=712, rx 8), drawn first. A header row 60 tall with each option's `name mid` and `note mid`; a plain line under it; rows 36 tall separated by dashed `life` lines.
- **First column** (236 wide) holds the capability in `small`; an optional corner label (`note`) sits in the header.
- **Cells**: a green check icon for yes, an em dash (`note mid`) for no, or a short value in `small mid`. Keep values to a word or two.
- **The accent** is the recommended column: a `key` rect inset 4 inside the table, drawn *after* the outline so a filled outline can't hide it.

## 17. Pyramid: levels that build on each other

Example: `examples/type-pyramid-tests.svg`. Use for test pyramids, assurance levels, maturity or trust levels.

- **Levels** are trapezoid paths (`box <hue>` or `key`), 56 tall and 6 apart, narrowing from 456 wide at the base to about 72 at the top, centered on x=252. The level's `name mid` sits 25 down; a `small mid` note fits only in the wider lower levels.
- **Side notes**: for each level, a dashed `life` leader from its right edge to x=496, then a `small strong` title and a `note` at x=504, vertically centered on the level.
- Three to five levels. The top is narrow: keep its name to one short word.

## 18. Cycle: a loop with no end

Example: `examples/type-cycle-product.svg`. Use for feedback loops, rotations, lifecycles that repeat.

- **Stations** are 216-wide boxes around the edge of the canvas, clockwise from the top-left: four at the corners, or six (three on top, three on the bottom, right to left).
- **Arrows** run along the loop: across the top, down the right side, back along the bottom, up the left side.
- **The center** holds what the loop is for: a 28px icon, the loop's `name mid` and a `note mid` line or two. The accent is the station the title is about.

## 19. Board: work in flight

Example: `examples/type-board-agent-tasks.svg`. Use for task boards, status overviews, launch checklists.

- **Columns** are `box zone <hue>` rects of equal width with 16 between them, as tall as the fullest column. Each header has an 18px icon, the column `name`, and a count in a small chip at the right.
- **Cards** are boxes 56 tall, 8 in from the column edges, 64 apart: title in `small strong`, a `note` line under it (owner, status, time).
- The accent is the one card that needs attention (blocked, waiting on you).

## 20. Infrastructure: where things run

Examples: `examples/type-infra-one-vpc.svg` (one network), `examples/type-infra-two-regions.svg` (two regions). Use for deployments, network tiers and regions.

The point of this pattern is containment: a service sits in a subnet, which sits in a network. Draw every level, even when there is only one network; that outer box is what tells the reader where "inside" ends.

- **Outside the network**, in a row at the top (y=72, 200 x 48): whatever reaches in (the internet, users, admins, calling agents). Each sits straight above the service it reaches. The internet is never a band inside the network.
- **The network** is a `box zone` container (one full-width, or two of 344 side by side for regions) from y=168, with a cloud icon, its `name`, and an optional `note end` on the right (the address range, if the user gave one).
- **Tiers** (public, private, data subnets) are nested `box zone <hue>` rects inside it, 12 apart, each with its name as a `note` top-left and an optional rule as a `note end` top-right ("No public IPs"). Each holds one or two service boxes (plain icon, `name`, one `note` line) 30 below the tier's top. One hue per tier.
- **Connectors**: from each outside thing straight down into its service; within a network, from tier to tier (straight down, or down 20, across and down when the columns differ). A protocol or port goes on the arrow in `small code`, 8 right of it: in the gap above the network for the entry arrows, in the target tier's header strip (10 above the service) inside. Between regions, a horizontal arrow joins the matching services (replication); that gap is too narrow for a label, so say it in the services' notes.
- Show addresses and ports the user gave; don't invent them.
- The accent is the service the title is about (the primary database, the only public entry, the guard).

## 21. Annotated artifact: the parts of one real thing

Examples: `examples/type-artifact-jwt.svg` (one line), `examples/type-artifact-http-request.svg` (several lines). Use when the reader should learn to read a concrete thing: a token, a key, a URL, a request, a command, a config file.

- **The artifact is the hero.** Split a one-line artifact into segments, each a `chip <hue>` (rx 6, 44 tall) at y=88 holding the literal text in 13px monospace (`code mid`, baseline y+27). Width = characters x 7.9 + 28, at least 64. Centre the row; you may nudge it up to 16px sideways so the accent's leader drops straight. Literal separators (the dots of a JWT, the underscores of a key) sit in the gaps in `name code mid`. A `note mid` label above each segment names it ("header", "mode").
- **Cards under the line**: one per segment, 72 below the row, filling the width with 16 between them: the part's `name` and a `note` of at most two lines saying what it means. Leaders are plain lines without arrowheads: down 16, across, down into the card. Leaders that go left turn lower the further in they are; leaders that go right mirror that, so none cross.
- **Several lines** (a request, a config file): a `box` window (x=24 w=424) with each line in `small code`, 28 apart. Tint each annotated range with a `chip <hue>` bar behind it (inset 8). Number the ranges with 24px circles just outside the window, and stack the notes on the right (x=496 w=240), each opening with the same number in a 24px circle and its `name`, the note starting 54 below the card's top. Numbers beat leader lines once there are more than three notes.
- **The accent** is the one part the title is about. Its card stays a plain `box` (no hue) with its note in `small` ink: the blue belongs to the part itself. Literal values are the user's; shorten long ones with `...` instead of shrinking the type.
- **When the point is a difference** (live versus test keys, v1 versus v2), end with a takeaway band (`callout`): its `name` line says the difference, and a second line sets the two forms side by side, each written in full in `small code` followed by a `small` gloss. To mix code and prose on one line, use `<tspan class="code">` inside the text.
- **Sizes**: the label above a chip sits 10 above it; cards are 40 tall plus 16 per note line, all the same height. If a value looks like a real secret (a live key, a password), keep it as given but suggest a fake one in your reply before it goes into public docs.

## 22. Decision tree: questions that lead to an answer

Examples: `examples/type-decision-oauth-flow.svg` (a tree), `examples/type-decision-login-method.svg` (a chain). Use for "which X should I use", triage and approval rules.

- **A chain** (each question either ends in an answer or asks the next question) reads best as a column. Questions are `box`es at x=24, a fixed 300 wide so the column lines up, 44 tall for one line (62 for two). The branch that ends goes right along an arrow to its answer at x=436 w=300 (40 tall plus 16 per note line), centred on the question's middle, with the branch label (`note mid`, "yes") 8 above the arrow. The other branch goes down from the question's bottom to the next question's top, labelled 8 right of the arrow at its midpoint. Rows are 40 apart (from the bottom of one row's tallest box to the next question); the first question starts at y=80, lower if its answer is taller. The last question's second answer sits on its own row below, reached down and across.
- **A tree** (questions under questions on both sides): give each answer an equal slot, slot = (712 + 16) / answers, answer width = slot - 16 (at most 176). Centre each question over its children, levels 112 apart from y=80. Edges go down 22 from the question, across, and down into each child with an arrowhead; the label sits 8 right of that last drop.
- **Questions** are neutral `box`es (no hue: they are the same kind of thing as each other, and colour belongs to the answers) with the question in `name mid`, ending in a question mark, as wide as the text plus 32 (at most 232 in a tree; wrap beyond). **Answers** are `box <hue>` with the answer in `name` and a `note` line on why; answers of the same kind share a hue, and when every answer is a different kind each gets its own (four at most). The recommendation goes in the title and on the accent; no closing band is needed.
- Up to four questions and six answers. **The accent** is the answer most readers should end up at.

## 23. Concentric rings: what sits inside what

Example: `examples/type-rings-defense-in-depth.svg`. Use for defense in depth, zero trust, trust levels, onion architectures.

- **Rings** are circles (`box <hue>`), outermost first, centred at x=220: the outer ring's radius 184 and the core's 52, the others stepping evenly between. Three to five rings. With long names, grow the outer radius to 212 and the core to 64 (move the notes column to x=472).
- **Names** sit inside each ring's band, centred at the top, halfway down the band (`name mid`); the core's name sits in its middle. A name must fit inside its band's arc: at most about 1.4 x the ring's radius in pixels for one word, so keep names to one or two short words. The checker flags any label that crosses a circle's outline.
- **Notes** go in a column on the right (x=456): the ring's name in `small strong` with one `note` line under it, outermost at the top and the core level with the centre, rows 40 to 48 apart. A solid plain leader joins each note to a small dot (a 2.5 radius `btn` path) inside its ring's band; the core's dot sits 10 past its label. The space under the notes stays empty: that is the shape of this pattern.
- **The accent** is one ring: draw it last as a `key` path made of two circles with `fill-rule="evenodd"`, so only its band is tinted (the core can simply be a `key` circle). Its circle needs no hue of its own.

## 24. Journey map: one person's experience, stage by stage

Example: `examples/type-journey-passkey-setup.svg`. Use for onboarding, sign-up, support and purchase experiences, seen from the user's side.

- **Stages** across the top: `box <hue>` headers 40 tall from x=136 to 736, 12 apart. Five stages leave 110 per header (about 13 name characters), four leave 141 (about 18): name the stage with a short noun ("Approval", not "Wait for approval").
- **Rows** under them, each labelled in a `note` in the left column (x=24): what the person is *doing* (`small`, 10 in from the column's left, two lines at most), how they *feel*, *pain points* and, only when the request gives some, *ideas*. Never invent ideas.
- **Feeling** is a 96-tall band with a dashed midline: a dot (`btn` r=5) per stage at its centre, 20 higher or lower per step from -2 to +2, joined by a plain polyline (the one diagonal line this style allows besides causal loops and Wardley maps). When the request names a feeling ("anxious"), write it as a `note mid` 12 above the dot, or 22 below when the dot is under the midline. Label the band's ends with words that fit the range ("Pleased"/"Frustrated", or "Positive"/"Negative" when the feelings are not about frustration).
- **Pain points** are `box rose`, **ideas** `box green`, only under the stages that have them; text 10 in from the box edge. **The accent** is the pain point the title is about.

## 25. Service blueprint: what the customer sees, and what happens behind it

Example: `examples/type-blueprint-recovery.svg`. Use when the point is a hand-off the customer never sees (a manual review, a warehouse check, a vendor).

- **Lanes**, top to bottom, 84 tall from y=80: Customer, Frontstage (what the customer interacts with), Backstage (people and steps they never see), Support systems. Lane names in `name` at x=24; drop any lane nothing uses.
- **The three lines between lanes** run full width: the *line of interaction* and the *internal line* are plain, the *line of visibility* is dashed. Name each in a `note` at x=24, just above it.
- **Steps** are columns from x=164 to 736, 12 apart (up to six steps; merge steps beyond that): a 48-tall `box <hue>` per lane that has something in that step (violet customer, teal frontstage, amber backstage, green systems), text in `small mid`, two lines at most.
- **Arrows follow what moves.** Requests go down a column, results that come back to the customer go up (refund issued, then email sent, then received), and the customer lane runs left to right. A hand-off inside a lane (warehouse to finance) is a horizontal arrow between cells; one that changes column and lane goes down, then across. A waiting cell ("Waits a day") gets no arrow out of it: nothing moves.
- **The accent** is the cell where things stall or fail; the title says why.

## 26. Byte layout: the fields of a format

Example: `examples/type-bytes-uuidv7.svg`. Use for IDs, packet headers, token formats and flag bytes.

- **Ruler**: bit or byte 0 is on the left (most significant first, as in RFC diagrams). A tick per unit along the top (y=98) and a number (`note mid`) every 8 units on 32- or 64-unit rows, every 4 on 16-unit rows, every unit on 8-unit rows.
- **Rows** of `per_row` units, 52 apart from y=112: each field a `box <hue>` (rx 4, 44 tall) as wide as its units, touching its neighbours. When there is more than one row, write each row's starting offset (0, 16, 32) as a `note end` in a narrow column on the left and start the grid at x=64. Pick the row width so the field that matters stays in one piece; a field that still runs past the end of a row continues as "cont.".
- **Labels**: the field name in `small mid` and its size ("41 bits") in `note mid` under it when the field is at least 56 wide; a short name only when it fits with 8 to spare; fields under about 24 wide (a 1-bit sign) carry no label at all, and their meaning goes in the notes.
- **Notes** under the grid in two columns, in field order, rows aligned across both columns: each field's name in `small strong` and what it means in a `note` (add its bit range, "bits 62-22", when that helps). **The accent** is the field the title is about.

## 27. Branch graph: how work flows between branches

Example: `examples/type-branches-release.svg`. Use for release strategies, hotfix flows, trunk-based development, feature flags.

- **Lanes**: one per branch, 84 apart, from y=104 (y=132 when the top branch has tags), the branch name in `small code` at x=24. Commits are spaced evenly from x=160 to 692 in time order across all branches.
- **Commits** are circles (`box <hue>`, r=7) with a short `note mid` label 16 above. Tags are `chip amber` pills with `small code mid` text above the label, on the commit that was tagged (a tag is not a commit of its own). Nothing goes below a commit: that is where connectors arrive.
- **Connectors**: a branch starts with a plain line straight down from its parent commit, then along its lane (lines may run into commit centres: the circle covers them). If the branch has no commit at the moment it was cut, label the parent commit ("cut release/3.4"). A merge is an arrow along the source lane to the target commit's x, then up or down into it, stopping 2 outside the circle; a merge label, when needed, sits above the source lane beside the turn.
- **The accent** is the commit the title is about, drawn as a `key` circle r=9 with its label in `small strong`.

## 28. Fishbone: causes grouped around one problem

Example: `examples/type-fishbone-login-outage.svg`. Use in postmortems and root-cause reviews.

- **The problem** sits on the right in a neutral `callout` (x=584 w=152): its name in `name` (about 18 characters per line, two lines at most) and a `small` line on scope, with a spine arrow from x=40 into it. Neutral, so the categories keep all four hues.
- **Categories** are boxes 32 tall (`box <hue>`, `name mid`) above and below the spine, filling x=24 to 568 with 16 between them: three per side are 168 wide, two per side 264. A bone runs straight from each box to the spine, 16 in from the box's left edge. Up to four categories each get their own hue; with more, they share one.
- **Causes** hang off their bone as `note` text 16 right of it, 24 apart, each with an 8px tick: only the causes the user gave, even if a category has just one. The spine sits 16 + 24 per cause + 12 below the top boxes, counting the category with the most causes, and the bottom boxes sit the same distance below it, so short lists make a short fish.
- **The accent** is the root cause that turned out to be true: a `key` rect (rx 4) from the tick's end to 8 past the text (measure the text with `check.py --labels` rather than estimating), its text in `small` (ink). The subtitle says that the highlight is the confirmed cause. Keep the problem's name short enough for its box, with the number in it ("Conversion −30%").

## 29. Causal loop: causes that feed back on themselves

Example: `examples/type-causal-tech-debt.svg` (a reinforcing loop with a balancing loop beside it). Use for vicious and virtuous circles, flywheels and unintended consequences.

- **Variables** are pills (`box <hue>`, rx 16, 32 tall) with the name in plain 13px ink, as wide as the text plus 32. Name things that can go up or down ("Tech debt", "Time per change"), not actions. A loop of four sits in a diamond: top and bottom 232 apart, left and right 360 apart.
- **Links** are curved arrows (the one place this style uses curves): a quadratic `Q` path whose control point sits 40 out from the midpoint between the two pills, perpendicular to the line joining them, away from the loop's centre; ends trimmed 4 outside the start pill and 6 outside the end pill. A `+` (they move together) or `−` (opposite) in `name mid` sits beside each arrowhead, about 78% along the curve and 12 out from it. A link shared by two loops can be straight.
- **Loop markers** sit in the middle of each loop: a 32px circle with `R` (reinforcing: an even number of `−` links) or `B` (balancing: an odd number), and the loop's name in a `note mid` 34 below its centre. A two-variable balancing loop is a lens: bow both links 80 so the marker and its name fit between them.
- **Closing a loop**: "X reduces incidents" is only a lever until something drives X; add that link (incidents prompt reliability work) so the loop is real, and say so in your reply.
- Four or five variables per loop, two loops at most. **The accent** is the variable or loop the title is about.

## 30. Wardley map: how visible and how mature each part is

Example: `examples/type-wardley-identity.svg`. Use for build-versus-buy and strategy discussions.

- **Axes**: a vertical arrow at x=136 from y=448 up to 84 ("Visible" at the top, "Invisible" at the bottom, "Value chain" between, all right-aligned in the left gutter) and a horizontal arrow along y=448 to 736. The four stages (Genesis, Custom-built, Product, Commodity) are `note mid` labels under equal quarters, with dashed dividers between them; the axis title "Evolution" sits under the right end.
- **Components** are circles (`box <hue>`, r=6) placed by how evolved they are (left to right) and how visible they are to the user (top to bottom). The user need goes at the top, above the part that serves it, in `violet`. Draw the real value chain: the need depends on what the user touches, which depends on what sits under it, rather than a line from the need to everything. Dependencies are plain lines (diagonal is fine here) stopping 3 outside each circle.
- **Labels** (`small`) go wherever they cross nothing: right of the circle first, then left, above or below. A divider breaks with a 4px gap around a label rather than running through it.
- **Movement** (a part becoming a commodity) is a dashed arrow (`life` with an arrowhead) from the circle to where it is heading, with an optional `note` label above it ("evolving fast"). **The accent** is the part the decision is about (`key` circle r=8, label in `small strong`, an optional `note` line under it).

## 31. Text fitting and spacing

SVG text never wraps, so fit it yourself. Average character widths in the system UI font:

| Style | Class | Avg px per character (plan with this) |
| --- | --- | --- |
| Title 15 semibold | `title` | 7.6 |
| Name 13 semibold | `name` | 6.8 |
| Label 13 regular | (none) | 6.4 |
| Note or small 11.5 | `note`, `small` | 5.8 |

Measured in Chrome with the system UI font and rounded up slightly, because Windows and Linux fonts run a little wider. With 12px padding each side: a 216 box holds about 28 name characters and 32 note characters per line; a 160 box about 20 and 23; a 136 box about 16 and 19. A chip is about `characters × 5.8 + 24` wide. The title should stay under about 85 characters (aim for 60–75).

The checker measures the real text, so trust it over this table when they disagree.

Wrap notes onto a second `<text>` 16 below the first (18 for 13px text). Two note lines per box is the ceiling; if you need a third, the box is doing too much.

Spacing rhythm: 24 outer margin, 16 between sibling boxes, 12 inner padding (16 in full-width bands), 8 between a label and the line it describes, 40–56 for an arrow that crosses open space. Align boxes on shared x columns and y rows; equal gaps matter more than any single number.
