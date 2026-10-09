---
name: crisp-diagrams
argument-hint: "[what the diagram should show, or leave empty to be asked]"
description: Draw clean, minimal explanatory diagrams as standalone SVG files: thin warm-gray outlines, one blue accent on the idea that matters, a title that states the takeaway, automatic dark mode, optional pastel, gradient or tinted-zone themes and line icons. Covers architecture and anatomy, system context, sequence and auth flows, process flows and swimlanes, event-driven systems, state machines, data models, decision trees, journey maps, service blueprints, timelines and git branch graphs, quadrants and Wardley maps, fishbone and causal loop diagrams, trees, matrices, pyramids, cycles, concentric rings, boards, infrastructure maps, annotated tokens and requests, byte layouts, and scenes with device mockups. Use it whenever the user asks for a diagram, figure, schematic, flowchart or "a visual" for docs, a README, notes, a blog post or slides, even without saying SVG; to redraw a diagram in this style; or to match brand colors from a logo or slide (saved in DIAGRAM.md). Not for data charts.
---

# Crisp diagrams

These diagrams explain one idea at a glance. They look calm because almost everything is the same thin gray line and the same three type sizes, so the single accent and the title do all the talking. Keep that restraint: every rule below exists to protect it.

What you deliver is a standalone `.svg` file that renders the same in a browser, in GitHub or a Markdown viewer, and as an `<img>`. It switches to dark mode by itself, with no colors hard-coded.

## How to start

- **With a request** (`/crisp-diagrams the OAuth device flow for our login docs`, or any message asking for a diagram): go straight to the workflow below. Ask only if something essential is missing, such as what the diagram is about.
- **With no request** (just `/crisp-diagrams`): interview the user before drawing. One round with the AskUserQuestion tool (or a short numbered list if that tool isn't available):
  1. *What kind of diagram?* "How something is built (anatomy)", "A flow or sequence of steps", "A comparison", "A scene with devices (phones, screens, servers)".
  2. *Where will it be used?* "Docs, README or notes" (quiet), "Slides" (pastel), "Product or marketing page" (gradient), "Architecture or security review" (zones). When a DIAGRAM.md exists, offer "Our brand style (DIAGRAM.md)" first, marked as recommended.
  3. *How much detail?* "Simple, 4 to 6 boxes", "Detailed, up to 12", "You decide".

  Then ask in plain text: "What should it show? Name the parts or steps, how they connect, and the one thing a reader should remember." Turn the answer into a title and an outline, show them in two or three lines, and draw unless the user objects. Stop at these two rounds; more questions feel like a form.
- **With an image of their brand** (a logo, a slide, a screenshot of their site): set up the visual identity first (next section), then draw.

## Visual identity: DIAGRAM.md

Before drawing anything, look for `DIAGRAM.md` in the current directory and upward to the repository root. If it exists, it is the project's visual identity:
- Restyle every diagram with it: `python3 <skill-dir>/scripts/theme.py diagram.svg --brand DIAGRAM.md` (or `--theme brand`, which finds the file).
- Use its group colors for what it says they mean, and follow its project notes.
- Don't edit it unless the user asks. The exception is the file you just created: write the preferences the user actually stated ("subtle", "customers are always coral") into its Project notes so the next diagram follows them. Rules you think would help but the user didn't state go in your reply as suggestions, not into the file.

To create one from an image the user provides (logo, slide, website screenshot, a diagram they like):

```bash
python3 <skill-dir>/scripts/palette.py brand.png [slide.png] --out DIAGRAM.md --preview <scratch-dir>
```

The script clusters the image's colors and picks the most prominent saturated one as the accent, darkening it only if it wouldn't read on white. It maps the other brand colors to group slots, derives quiet hues for empty slots, builds subtle light and dark shades, and writes `DIAGRAM.md` at the project root. The background always stays white: brand colors reach only the accent, the soft group fills and the lines.

The default treatment is `pastel`, which suits a request for "subtle" brand colors; `quiet` would hide the group colors entirely, and `gradient` is for polished product pages. The class names in DIAGRAM.md are slots, not literal colors (in a purple brand, `violet` might draw coral): pick them by the meaning DIAGRAM.md lists.

Then show the user `palette.light.png` and one example from the preview folder (Read the PNGs), say which brand color became the accent, and offer adjustments: a different accent (`--accent "#4b2bb3"`), another treatment (`--treatment gradient`), or a single color edited in DIAGRAM.md's css block. If a DIAGRAM.md already exists, show what would change and ask before replacing it (`--force`).

## Workflow

### 1. Decide what the diagram says before drawing anything

- **Title = the takeaway**, written as a sentence a reader could repeat: "A smart speaker listens on the device, and audio leaves only after the wake word", not "Smart speaker architecture". It sits top-left and tells the reader what to see.
- **Subtitle = the scope**: what is being shown ("How a work agent gets a token for a SaaS app, step by step").
- **The one key element**: the mechanism, step or layer the diagram exists to show (the guard, the policy check, the shared identity layer). It gets the accent. If you can't name it, the diagram doesn't have a point yet.
- **List the content**: nodes (names of 2–4 words), at most two short note lines each, and arrows labelled with what moves along them. Aim for 12 boxes or fewer. If it won't fit, split it into two diagrams rather than shrinking things.

### 2. Pick a pattern

| The point is… | Pattern | Example to copy |
| --- | --- | --- |
| what something is made of and what it touches | Anatomy | `references/examples/smart-speaker-anatomy.svg` |
| where things sit between two parties | Lanes | `references/examples/integration-map.svg` |
| who talks to whom, in order | Sequence | `references/examples/cross-app-access-flow.svg` |
| steps from start to finish | Flow | (numbers in patterns.md) |
| how options differ | Comparison | (numbers in patterns.md) |
| which things live where, and what may cross | Zones | (numbers in patterns.md) |
| what sits on top of what | Layers | (numbers in patterns.md) |
| what people see on their devices, and what travels between systems | Scene | `references/visuals.md`, `references/examples/scene-*.svg` |
| the big picture: one system, its users and the systems it depends on | System context | `references/examples/type-system-payments.svg` |
| who publishes events and who reacts to them | Event-driven | `references/examples/type-events-orders.svg` |
| the states one thing moves through | State machine | `references/examples/type-states-order.svg` |
| who does which step in a cross-team process | Swimlane | `references/examples/type-swimlane-refund.svg` |
| how the data is structured | Data model | `references/examples/type-erd-commerce.svg` |
| what happens when (a roadmap, a rollout, an incident) | Timeline | `references/examples/type-timeline-roadmap.svg` |
| where items fall on two dimensions | Quadrant | `references/examples/type-quadrant-priorities.svg` |
| what contains or reports to what | Tree | `references/examples/type-tree-cloud.svg` |
| many yes/no facts about a few options | Feature matrix | `references/examples/type-matrix-auth.svg` |
| levels that build on each other | Pyramid | `references/examples/type-pyramid-tests.svg` |
| a loop that repeats | Cycle | `references/examples/type-cycle-product.svg` |
| work in flight, by status | Board | `references/examples/type-board-agent-tasks.svg` |
| where things run (networks, subnets, regions) | Infrastructure | `references/examples/type-infra-one-vpc.svg` (one network), `type-infra-two-regions.svg` (two regions) |
| how to read one real thing (a token, URL, request, command) | Annotated artifact | `references/examples/type-artifact-jwt.svg` (one line), `type-artifact-http-request.svg` (several lines) |
| which option to pick, by answering questions | Decision tree | `references/examples/type-decision-oauth-flow.svg` (a tree), `type-decision-login-method.svg` (a chain of questions) |
| what sits inside what (defense in depth, zero trust) | Concentric rings | `references/examples/type-rings-defense-in-depth.svg` |
| what a person goes through and feels, stage by stage | Journey map | `references/examples/type-journey-passkey-setup.svg` |
| what the customer sees versus what happens behind it | Service blueprint | `references/examples/type-blueprint-recovery.svg` |
| the fields of a binary or text format (IDs, headers, flags) | Byte layout | `references/examples/type-bytes-uuidv7.svg` |
| how changes move between git branches | Branch graph | `references/examples/type-branches-release.svg` |
| the possible causes of one problem (postmortems) | Fishbone | `references/examples/type-fishbone-login-outage.svg` |
| causes that feed back on themselves (spirals, flywheels) | Causal loop | `references/examples/type-causal-tech-debt.svg` |
| which parts to build or buy, by visibility and maturity | Wardley map | `references/examples/type-wardley-identity.svg` |

Read `references/patterns.md` for the chosen pattern's coordinates (or `references/visuals.md` for a scene), and open the matching example. Copying its structure is the fastest way to get the rhythm right.

### 3. Write the SVG

Start from `assets/template.svg`. It already holds the default (quiet) theme: palette tokens with light and dark values, plus the classes below. Then place elements on the pattern's grid in paint order: outer boxes first, then the boxes and highlights inside them, then connectors (SVG paints in order, and in the colorful themes a filled box hides whatever was drawn before it; the checker reports both cases), computing positions from a few constants (column x values, row y values, box size) rather than eyeballing each one. For repetitive layouts, a short script that prints the SVG is fine; what matters is the file.

The theme's classes are the whole visual vocabulary:

| Class | On | Use for |
| --- | --- | --- |
| `title` | text | the takeaway line (15, semibold) |
| `name` | text | box and container names (13, semibold) |
| (none) | text | plain 13px ink labels, such as centered node labels |
| `note` | text | subtitle, descriptions, arrow labels (11.5, quiet gray) |
| `small` | text | 11.5 ink: chip labels, sequence steps, text inside the accent box |
| `strong`, `mid`, `end` | text | add semibold, center or right-anchor |
| `code` | text | add monospace for literal values: field types, event names, ports, endpoints (`small code`, `note code`) |
| `box` | rect | every ordinary box and container: outline only, rx 8 |
| `key` | rect | the one accent: blue outline over a faint blue wash |
| `chip` | rect | pill (h 26, rx 13) for named standards, products and examples |
| `callout` | rect | gray-washed band for a takeaway or footnote |
| `line` | g/path | connectors: wrap the paths in `<g class="line">` and add `marker-end` |
| `life` | g/line | dashed sequence lifelines |
| `zone` | rect | add to a container (`box zone`) that encloses a group of parts |
| `blue` `green` `violet` `amber` `rose` `teal` | rect | the group a box or chip belongs to (`box teal`, `chip amber`) |
| `icon`, `badge` | g, rect | optional line icons and their tinted tiles; build them with `icon()` and `badge()` from `scripts/components.py` (see Icons in `references/visuals.md`) |

Scenes add device classes (`device`, `screen`, `island`, `field`, `btn`, `ui`, `glyph`, and the 10px `uitext`, `uinote`, `btn-text`); `references/visuals.md` has ready-made snippets for each device and screen, and `scripts/components.py` builds them from Python.

Always mark groups, even for the default theme. The quiet theme ignores `zone` and the hue classes, but marking them costs nothing and lets anyone switch the diagram to a colorful theme later without touching it. Things of the same kind share a hue: all the parts inside the system in one, all outside systems in another, people in a third (violet). Your own company's other systems (the apps that call a platform) are systems, not people: give them their own hue rather than violet. When the parts sit in areas (subnets, zones, lanes), a hue per area is fine too; four hues is the ceiling either way. Mark every box except the `key`. An unmarked box shows as plain white in the colorful themes and looks like a mistake. A few boxes are neutral by design, and the patterns say so: decision-tree questions, the card under an accented artifact part, a fishbone's problem box (a `callout`) and the ring that carries the accent.

### 4. Check it, then look at it

```bash
python3 <skill-dir>/scripts/check.py path/to/diagram.svg --png <scratch-dir>
```

The checker uses headless Chrome to measure every label as the browser draws it. It reports text that overflows or crosses a box, overlapping labels, lines running through labels, half-overlapping boxes, content off the canvas, colors outside the palette, and font sizes off the scale. Fix every ERROR and re-run until it's clean. Add `--labels` to print where each label starts and ends, which helps when placing text right after another label. Read the warnings, which are judgment calls (a dashed lifeline through a label is normal in a sequence diagram).

Then open both PNGs (`<name>.light.png`, `<name>.dark.png`) with the Read tool and look at them as a reader would. The checker can't judge these: are columns aligned and gaps equal? Do arrows start and end on box edges? Is there a lopsided empty area? Does the accent land on the thing the title talks about? Fix and re-check. Write the previews to a scratch directory, not next to the deliverable.

### 5. Deliver

If the project has a DIAGRAM.md, make sure the delivered file was restyled with `--brand` (and re-run the checker after theming). Save the `.svg` where it belongs. Next to the document it illustrates (for example `diagrams/<short-name>.svg`) is usually right. Give the user the path and an embed line: `![<title>](diagrams/<short-name>.svg)` for Markdown, or `<img src="…" alt="<title>">` for HTML.

## Themes: when the user wants more color

The default theme is `quiet`: use it unless the user asks for color or the project's DIAGRAM.md says otherwise (a word like "explainer" or "slide" alone isn't a request for color). When the user asks for color (pastel, gradients, "more colorful", "for a slide" or "for the product page"), write the diagram exactly as usual, with groups marked, then restyle it:

```bash
python3 <skill-dir>/scripts/theme.py diagram.svg --theme pastel        # in place, or -o out.svg
python3 <skill-dir>/scripts/theme.py diagram.svg --all <scratch-dir>   # every theme, to compare
```

| Theme | Look | Good for |
| --- | --- | --- |
| `quiet` | outlines only, one blue accent | docs, research notes, READMEs |
| `pastel` | flat soft fills per group, colored outlines | slides, onboarding, friendly explainers |
| `gradient` | light top-to-bottom gradients in boxes | product pages, polished decks |
| `zones` | pastel washes on areas, white boxes inside | showing which parts belong where (inside vs outside, teams, trust zones) |

If the user isn't sure, run `--all` and show them the PNG previews of each, or pick `pastel`. A project with a DIAGRAM.md uses `--brand DIAGRAM.md` instead of a stock theme; `--brand DIAGRAM.md --all <dir>` shows its palette in every treatment. Colorful themes keep everything else: same layout, same type, automatic dark mode, and still one blue `key`. That's why the groups avoid `blue`: in a colorful theme, blue fills next to the key would drown the accent. Use the other five hues first.

Color in these themes means "belongs to this group", never decoration. Use two or three group hues per diagram, four at most, not counting the blue accent. Text stays ink and gray, never colored. Don't hand-edit colors or write your own gradients: the theme defines them for both light and dark mode, and the checker rejects anything else.

## Style rules, and why

- **Outlines, not fills** (in the default theme). Boxes are thin gray outlines (`box`). Filled shapes compete with each other; outlines let structure recede so that words carry the meaning.
- **One accent.** `key` marks the single thing to remember. Two accents make the reader choose; zero makes every box equal. Text inside `key` uses ink (`name`, `small`), never quiet gray.
- **Gray wash for supporting detail.** `chip` for concrete names (MCP, OAuth, Slack), and `callout` for a closing takeaway. They read as "examples" or "aside" without adding a color.
- **Three sizes, two weights.** 15 for the title, 13 for names and labels, 11.5 for notes (plus 10, only inside device screens and code chips). Semibold only for title and names. Hierarchy comes from size, weight and gray, not color.
- **Plain words in sentence case.** Labels are short phrases with no final period. Notes say what a part does ("Runs jobs on a timer or when something changes"), not what it's called again. Use jargon only where the reader would use it.
- **Arrows only where something moves.** They are thin, gray, orthogonal (no diagonals or curves, except where a pattern needs them: causal loop links, a journey map's feeling line, Wardley dependencies) and have a small solid head. Label them with what moves, in `note`, 8px from the line. Leave arrows unlabelled when the boxes already make it obvious.
- **Aligned and evenly spaced.** Use a 24 outer margin, 16 between siblings and 12 inner padding, and share columns and rows. Uneven gaps are the most visible flaw in a sparse diagram.
- **Nothing decorative.** No emoji, shadows, 3D, legends or hand-drawn pictograms. The device mockups and the icon set in `references/visuals.md` are the exception because they carry meaning (this is the person's phone, this box is the vault) and share the line style: one icon per box at most, never in place of its name. Gradients and fills come only from a theme. If a category matters, mark it as a group (the colorful themes show it) and say it in words or with a labelled container.
- **Never hard-code a color.** Use only the theme's classes or `var(--token)`. Hard-coded colors break dark mode.

## Fitting text

SVG never wraps text, so you break lines yourself: one `<text>` per line, 16 apart for 11.5px. In a 216-wide box, plan for about 28 characters of name and 32 of note per line; `references/patterns.md` has the full table. When text doesn't fit, shorten the words first, widen the box second, and add a line last.

## Variations

- **Inline in an HTML page** instead of a separate file: paste the `<svg>` as is. If the page has its own dark-mode toggle (a class such as `.dark`), add that selector to the theme's dark block, for example `@media (prefers-color-scheme:dark){svg{…}} .dark svg{…same values…}`. Keep marker ids unique per diagram on a page.
- **A user asks for their brand colors** without an image: `palette.py --accent "#hex" --out DIAGRAM.md` builds the same subtle palette from a single color. With an image, use the visual identity flow above.
- **Redrawing an existing diagram** (a whiteboard photo, Mermaid or a busy figure): extract the takeaway and the nodes first, then rebuild with a pattern. Don't trace the original layout.
