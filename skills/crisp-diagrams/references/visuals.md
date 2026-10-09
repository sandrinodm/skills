# Visual scenes: devices, screens and systems

Use a scene when the reader needs to recognize *things*: the phone in someone's hand, the login page they see, the server and database behind it, the agent in the middle. Boxes explain structure; scenes show what people and systems look like and what travels between them. The style doesn't change: thin lines, the theme's palette, three type sizes (plus 10px inside screens and chips), one accent.

Contents:
1. When a scene beats boxes
2. Rules for mockups
3. The scene layout
4. Components (phone and screens, laptop, windows, server, database, agent, person, QR, code chip)
5. Icons
6. Building with scripts/components.py

## 1. When a scene beats boxes

- The point involves **what a person sees or does** on a device (a consent screen, a passkey prompt, a push approval, a code to type).
- **Devices or systems talk to each other** and the reader should see which is which (phone → API → database, agent → MCP server → API).
- The audience is **non-specialist** (product pages, onboarding, slides), where a recognizable phone does more than a box labelled "Client".

Stay with boxes when the point is internal structure (anatomy, layers) or many parts; more than four objects in one row gets crowded. You can mix: a phone on the left feeding an anatomy container is fine.

## 2. Rules for mockups

- **Draw only what the point needs.** One screen, one task. A login screen shows the fields and buttons that matter, not a whole app. Gray `ui` bars are fine as filler where text would distract (an earlier message in a channel, a list's other rows).
- **Real words on screens** ("Sign in to Acme", "Approve €120 to Luca's?"), never lorem ipsum.
- **Text inside a phone is narrow.** The screen is 116 wide: about 20 characters per 10px line in a notification or bubble, about 22 in a full-width button. Shorten the wording before you widen anything; a button may grow to the full 116 but never past the screen.
- **10px text lives only inside device screens and code chips** (`uitext`, `uinote`, `btn-text`, `uitext code`). Everything outside screens keeps the normal scale.
- **Buttons are ink, not accent** (`btn` with `btn-text`), so the accent stays free. The accent is still one thing: wrap the element that matters in a `key` ring drawn *before* it (6 to 8px larger on each side, rx +3), or make a code chip the key with `chip(..., key=True)`. Don't echo the accented thing in a second chip for no reason; a token that is returned and then used is two events, so showing it twice is fine.
- **Devices stay neutral**; systems may carry a group hue (`rack("teal")`, `database("green")`, `bot("violet")`) so the colorful themes can tell them apart. The quiet theme ignores the hue.
- **Captions name each object** under it, on one shared baseline: `name` then `note`, centered. A short object (a server) next to a phone will have air above its caption; that's expected.
- **What travels is a code chip** on the arrow: request above, response below. Short and literal: `GET /orders`, `challenge`, `201 Created`, `WDJB-MJHT`.
- **When order matters, number the chips** (`chip(..., num=1)`, `two_way(..., nums=(1, 4))`): "1 new sign-in", "2 Is this you?". A loop that comes back along the bottom row reads correctly once numbered. The diagram's prose can then refer to the steps.

## 3. The scene layout

All objects in one row, centered on a shared horizontal **axis**. With a phone (300 tall) placed at y=80, the axis is y=230, captions sit at y=404 and 420, and the canvas ends near 448.

| Object | Size | Place it at (for axis 230) |
| --- | --- | --- |
| Phone | 150 x 300 | y=80 |
| Laptop | 268 x 184 | y=145 (screen center at the axis) |
| Browser window | 260 x 170 | y=145 |
| Terminal | 240 x 150 | y=155 |
| Server | 100 x 84 | y=188 |
| Database | 84 x 96 | y=182 |
| Agent | 56 x 52 | y=198 (body 210..250) |

- **Columns: let `row()` space them.** `xs, gap = row([150, 56, 100, 84], captions=[...])` returns x positions that spread the objects evenly, and the gap between them. Pass each object's longest caption line: a narrow object at either end (a server, a database) is then pulled in so its centered caption stays inside the margins.
- **Every chip must fit inside the gap between its two objects** (not just the arrow, which is 24 shorter). A chip is `len(text) x 6 + 16` wide. If one doesn't fit: shorten the text first, then drop an object or make the phone the only large one; with four objects and two-way arrows everywhere, keep chips under about 14 characters.
- **Arrows** start and stop 12 from the objects. Request at axis-12, response at axis+12; a one-way arrow sits on the axis.
- **Chips**: request chip top at axis-40, response chip top at axis+18, one-way chip top at axis-28. A second chip that rides along with the request (the token over `GET /orders`) goes at axis-68: `two_way(..., stack="Bearer eyJ...")`.
- **Two exchanges in one gap** (a token swap, then an API call): use a taller server (`rack(units=6)`, 174 tall) and run the second pair of arrows 90 lower, with its own chips; 132 lower if the second pair carries a stacked chip.
- Put the phone wherever the person is in the story: left when they start the flow, right when they're asked to approve.
- **Two moments on one device** (the app, then Google's sign-in opening over it): prefer one phone with the second moment as a sheet sliding up over the lower part of the screen (a `field` rect with rx 14 and a small `ui` grabber at its top). If you need two phones, caption the second one so it's clearly the same device a moment later.
- **Devices can be resized** to make room: `laptop(content, w=240, h=160)` keeps its look. Measure arrow gaps from the screen frame, not the wider base.
- Check text against the margins: nothing may pass x=736. The checker warns when a label enters the 24px margin.

Examples: `examples/scene-phone-api.svg`, `examples/scene-agent-mcp-api.svg`, `examples/scene-passkey-login.svg`.

## 4. Components

Each snippet is in local coordinates; wrap it in `<g transform="translate(x y)">…</g>` to place it. The Python names in the headings are the matching functions in `scripts/components.py`.

### Phone frame: `phone(screen)`

150 x 300. The screen content area is x 17..133, y 36..276 (116 wide). The `island` stays dark in both themes.

```svg
  <rect class="device" x="0" y="0" width="150" height="300" rx="24"/>
  <rect class="screen" x="7" y="7" width="136" height="286" rx="18"/>
  <rect class="island" x="56" y="15" width="38" height="11" rx="5.5"/>
  <!-- screen content here: x 17..133, y 36..276 -->
  <rect class="ui" x="56" y="283" width="38" height="3" rx="1.5"/>
```

### Login screen: `scr_login("Acme", key_alt=True)`

```svg
  <circle class="ui" cx="75" cy="66" r="13"/>
  <text class="uitext strong mid" x="75" y="100">Sign in to Acme</text>
  <rect class="field" x="17" y="114" width="116" height="26" rx="7"/>
  <text class="uinote" x="27" y="131">you@example.com</text>
  <rect class="btn" x="17" y="148" width="116" height="26" rx="7"/>
  <text class="btn-text mid" x="75" y="165">Continue</text>
  <text class="uinote mid" x="75" y="194">or</text>
  <rect class="key" x="11" y="198" width="128" height="38" rx="10"/>
  <rect class="field" x="17" y="204" width="116" height="26" rx="7"/>
  <text class="uitext mid" x="75" y="221">Use a passkey</text>
```

### App list screen: `scr_list("Orders", rows)`

```svg
  <text class="uitext strong" x="17" y="52">Orders</text>
  <rect class="field" x="17" y="64" width="116" height="38" rx="8"/>
  <circle class="ui" cx="33" cy="83" r="8"/>
  <text class="uitext" x="47" y="80">Order #1042</text>
  <text class="uinote" x="47" y="93">Shipped</text>
  <rect class="field" x="17" y="110" width="116" height="38" rx="8"/>
  <circle class="ui" cx="33" cy="129" r="8"/>
  <text class="uitext" x="47" y="126">Order #1039</text>
  <text class="uinote" x="47" y="139">Delivered</text>
  <path class="line" d="M17 250H133"/>
  <circle class="btn" cx="43" cy="264" r="4"/>
  <circle class="ui" cx="75" cy="264" r="4"/>
  <circle class="ui" cx="107" cy="264" r="4"/>
```

### Chat with an assistant screen: `scr_chat("Assistant", msgs)`

```svg
  <text class="uitext strong mid" x="75" y="52">Assistant</text>
  <rect class="btn" x="31.8" y="66" width="101.2" height="36" rx="9"/>
  <text class="uitext inv" x="40.8" y="82">Table for 4 at 8</text>
  <text class="uitext inv" x="40.8" y="95">tonight?</text>
  <rect class="field" x="17" y="110" width="106.4" height="36" rx="9"/>
  <text class="uitext" x="26" y="126">Booked: Luca's at</text>
  <text class="uitext" x="26" y="139">20:00.</text>
  <rect class="field" x="17" y="248" width="116" height="24" rx="12"/>
  <text class="uinote" x="29" y="264">Message</text>
```

### Team channel (Slack-style) screen: `scr_channel("support", msgs)`

```svg
  <text class="uitext strong" x="17" y="52"># support</text>
  <path class="line" d="M17 60H133"/>
  <circle class="ui" cx="25" cy="78" r="6"/>
  <rect class="ui" x="36" y="72" width="60" height="5" rx="2.5"/>
  <rect class="ui" x="36" y="81" width="88" height="5" rx="2.5"/>
  <circle class="ui" cx="25" cy="104" r="6"/>
  <text class="uitext strong" x="36" y="107">Maya</text>
  <text class="uitext" x="36" y="120">How many refunds</text>
  <text class="uitext" x="36" y="133">did Acme get?</text>
  <circle class="ui" cx="25" cy="162" r="6"/>
  <text class="uitext strong" x="36" y="165">Support agent</text>
  <text class="uitext" x="36" y="178">3 refunds, €420.</text>
  <rect class="field" x="17" y="248" width="116" height="24" rx="12"/>
  <text class="uinote" x="29" y="264">Message #support</text>
```

### Consent screen: `scr_consent("Budget app", scopes)`

```svg
  <circle class="ui" cx="75" cy="60" r="12"/>
  <text class="uitext strong mid" x="75" y="90">Budget app</text>
  <text class="uinote mid" x="75" y="104">wants to:</text>
  <rect class="key" x="11" y="114" width="128" height="60" rx="10"/>
  <rect class="btn" x="19" y="122" width="12" height="12" rx="3"/>
  <path class="tick" d="M22 128.5 l2.5 2.5 l4.5 -5"/>
  <text class="uitext" x="38" y="132">See balances</text>
  <rect class="field" x="19" y="146" width="12" height="12" rx="3"/>
  <text class="uitext" x="38" y="156">Make payments</text>
  <rect class="field" x="17" y="194" width="54" height="26" rx="7"/>
  <text class="uitext mid" x="44" y="211">Cancel</text>
  <rect class="btn" x="79" y="194" width="54" height="26" rx="7"/>
  <text class="btn-text mid" x="106" y="211">Allow</text>
```

### Push approval screen: `scr_push("Acme Bank", title, body)`

```svg
  <text class="uitext strong mid" x="75" y="50">14:02</text>
  <text class="uinote mid" x="75" y="63">Tuesday 8 October</text>
  <rect class="key" x="9" y="74" width="132" height="122" rx="14"/>
  <rect class="field" x="15" y="80" width="120" height="110" rx="12"/>
  <circle class="ui" cx="29" cy="96" r="6"/>
  <text class="uitext strong" x="41" y="99">Acme Bank</text>
  <text class="uitext" x="23" y="120">Approve €120 to</text>
  <text class="uitext" x="23" y="133">Luca's?</text>
  <text class="uinote" x="23" y="146">From your assistant</text>
  <rect class="field" x="19" y="160" width="54" height="22" rx="6"/>
  <text class="uitext mid" x="46" y="175">Decline</text>
  <rect class="btn" x="77" y="160" width="54" height="22" rx="6"/>
  <text class="btn-text mid" x="104" y="175">Approve</text>
```

### Code entry screen: `scr_code("WDJB-MJHT")`

```svg
  <circle class="ui" cx="75" cy="66" r="13"/>
  <text class="uitext strong mid" x="75" y="100">Connect a device</text>
  <text class="uinote mid" x="75" y="114">Enter the code shown</text>
  <rect class="key" x="11" y="124" width="128" height="38" rx="10"/>
  <rect class="field" x="17" y="130" width="116" height="26" rx="7"/>
  <text class="uitext code strong mid" x="75" y="147">WDJB-MJHT</text>
  <rect class="btn" x="17" y="176" width="116" height="26" rx="7"/>
  <text class="btn-text mid" x="75" y="193">Continue</text>
```

### Approve sign-in screen: `scr_approve(title, sub)`

```svg
  <circle class="ui" cx="75" cy="70" r="14"/>
  <text class="uitext strong mid" x="75" y="106">Sign in on your</text>
  <text class="uitext strong mid" x="75" y="119">laptop?</text>
  <text class="uinote mid" x="75" y="136">Chrome on MacBook Air</text>
  <rect class="field" x="17" y="170" width="116" height="26" rx="7"/>
  <text class="uitext mid" x="75" y="187">Not me</text>
  <rect class="key" x="11" y="206" width="128" height="38" rx="10"/>
  <rect class="btn" x="17" y="212" width="116" height="26" rx="7"/>
  <text class="btn-text mid" x="75" y="229">Sign in</text>
```

### Laptop (268 x 184): `laptop(content)`

```svg
  <rect class="device" x="6" y="0" width="256" height="170" rx="10"/>
  <rect class="screen" x="14" y="10" width="240" height="150" rx="4"/>
  <!-- screen content: x 14..254, y 10..160 -->
  <path class="device" d="M0 170 H268 L264 180 Q262 184 256 184 H12 Q6 184 0 170 Z"/>
```

### Browser window (260 x 170): `browser(url, content)`

```svg
  <rect class="device" x="0" y="0" width="260" height="170" rx="10"/>
  <circle class="ui" cx="14" cy="14" r="3.5"/>
  <circle class="ui" cx="26" cy="14" r="3.5"/>
  <circle class="ui" cx="38" cy="14" r="3.5"/>
  <path class="line" d="M0 28H260"/>
  <rect class="field" x="52" y="6" width="196" height="16" rx="8"/>
  <text class="uinote" x="62" y="18">acme.com/login</text>
  <!-- page content: x 16..244, y 36..160 -->
```

### Terminal (240 x 150): `terminal(lines)`

```svg
  <rect class="device" x="0" y="0" width="240" height="150" rx="10"/>
  <circle class="ui" cx="14" cy="14" r="3.5"/>
  <circle class="ui" cx="26" cy="14" r="3.5"/>
  <circle class="ui" cx="38" cy="14" r="3.5"/>
  <path class="line" d="M0 28H240"/>
  <text class="uitext code" x="14" y="50">$ acme login</text>
  <text class="uitext code" x="14" y="66">Waiting for approval...</text>
```

### Server (100 x 84): `rack("teal")`

```svg
  <rect class="device teal" x="0" y="0" width="100" height="24" rx="6"/>
  <circle class="ui" cx="14" cy="12" r="3"/>
  <circle class="ui" cx="25" cy="12" r="3"/>
  <rect class="ui" x="62" y="10" width="26" height="4" rx="2"/>
  <rect class="device teal" x="0" y="30" width="100" height="24" rx="6"/>
  <circle class="ui" cx="14" cy="42" r="3"/>
  <circle class="ui" cx="25" cy="42" r="3"/>
  <rect class="ui" x="62" y="40" width="26" height="4" rx="2"/>
  <rect class="device teal" x="0" y="60" width="100" height="24" rx="6"/>
  <circle class="ui" cx="14" cy="72" r="3"/>
  <circle class="ui" cx="25" cy="72" r="3"/>
  <rect class="ui" x="62" y="70" width="26" height="4" rx="2"/>
```

### Database (84 x 96): `database("green")`

```svg
  <path class="device green" d="M0 12 A42 12 0 0 1 84 12 V84 A42 12 0 0 1 0 84 Z"/>
  <path class="glyph" d="M0 12 A42 12 0 0 0 84 12"/>
```

### Agent (56 x 52, body y 12..52): `bot("violet")`

```svg
  <path class="glyph" d="M28 3V12"/>
  <circle class="btn" cx="28" cy="3" r="3"/>
  <rect class="device violet" x="4" y="12" width="48" height="40" rx="12"/>
  <circle class="btn" cx="20" cy="31" r="3.5"/>
  <circle class="btn" cx="36" cy="31" r="3.5"/>
  <path class="glyph" d="M22 41H34"/>
```

### Person (48 x 50): `person()`

```svg
  <circle class="glyph" cx="24" cy="14" r="10"/>
  <path class="glyph" d="M4 50C4 37 13 31 24 31C35 31 44 37 44 50"/>
```

### QR code (64 x 64): `qr()`

```svg
  <rect class="field" x="0" y="0" width="64" height="64" rx="4"/>
  <rect class="btn" x="6" y="6" width="14" height="14" rx="2"/>
  <rect class="field" x="9" y="9" width="8" height="8" rx="1"/>
  <rect class="btn" x="11" y="11" width="4" height="4" rx="1"/>
  <!-- ...two more finder patterns and a few 4x4 modules -->
```

### Code chip (scene coordinates): `chip(cx, y, text, key=False, num=None)`

```svg
  <rect class="field" x="229" y="190" width="82" height="22" rx="6"/>
  <text class="uitext code mid" x="270" y="205">GET /orders</text>
```

## 5. Icons

Icons help a reader recognize a box faster: a lock on the credential vault, a clock on the scheduler. They're optional, drawn in the same line weight as everything else, and they follow the theme and dark mode. See all of them in `examples/icon-set.svg`.

**Rules**
- **One icon per box, never instead of its name.** The label still says what the thing is; the icon only speeds up recognition.
- **Same size and style in a whole diagram.** Pick one style and use it for every box that has an icon.
- **Only icons from the set** (`scripts/icons.py`); don't draw your own or use emoji. If nothing fits, leave the box without an icon rather than forcing a vague one.
- **The accent stays one thing.** Inside the `key` element, draw the icon with `accent=True`; everywhere else, pass the box's group hue so colorful themes tint it.

**Three styles** (component functions in `scripts/components.py`):

| Style | How | Text starts at | Box height |
| --- | --- | --- | --- |
| Badge | `badge(name, x+12, y+12, hue)`: icon on a 32px tinted tile | x+56 | at least 56 |
| Plain | `icon(name, x+12, y+11, 20, hue)`: line icon alone | x+42 | 40 + 16 per note line |
| Card (icon on top) | `badge(...)` at the top-left, name below at y+64 | x+12 | 76 + 16 per note line |

Badges and cards narrow the note column (a 216 box keeps about 24 note characters per line with a badge), so check the wrap. In a full-width key band, put a 22px accent icon at (x+16, y+12) and start the name at x+48 (as in `examples/type-events-orders.svg`). Cards suit flows and 4-step rows best; plain icons suit narrow boxes and lanes.

**Names:** `user`, `users`, `phone`, `laptop`, `monitor`, `headset`, `bot`, `sparkle`, `mic`, `speaker`, `camera`, `video`, `server`, `database`, `cloud`, `globe`, `cpu`, `code`, `terminal`, `api`, `plug`, `link`, `network`, `git`, `layers`, `package`, `queue`, `settings`, `sliders`, `refresh`, `filter`, `search`, `lock`, `unlock`, `key`, `shield`, `shield-check`, `fingerprint`, `id`, `eye`, `eye-off`, `policy`, `qr`, `mail`, `chat`, `bell`, `send`, `inbox`, `calendar`, `clock`, `file`, `folder`, `clipboard`, `book`, `archive`, `trash`, `list`, `bookmark`, `help`, `card`, `wallet`, `money`, `cart`, `store`, `receipt`, `tag`, `truck`, `check`, `check-circle`, `x-circle`, `alert`, `flag`, `star`, `zap`, `chart`, `trend`, `upload`, `download`, `home`, `building`, `pin`, `wifi`.

## 6. Building with scripts/components.py

For anything beyond a single object, generating the SVG from Python is faster and keeps coordinates consistent. `scripts/components.py` has every component above plus scene helpers: `row(widths)`, `arrow(d, slug)`, `chip(cx, y, text, key, num)`, `caption(cx, name, note, y)`, `two_way(x1, x2, req, resp, slug, stack=, nums=)` and `one_way(x1, x2, label, slug, num=)`. Its docstring shows a full example. Write the elements into a copy of `assets/template.svg` (keep its `<style>`, set the marker id to `<slug>-arrow`), then run `scripts/check.py` and look at the PNGs as usual, and `scripts/theme.py --style` if the user wants color or the library's STYLE.md sets a theme or palette.
