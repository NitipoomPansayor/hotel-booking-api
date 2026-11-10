# PAK — Design system

Based on the verified `ui-ux-pro-max` query `hotel directory minimal cards`:
Marketplace / Directory pattern, Flat Design. React stack guidance: semantic
HTML and explicit asynchronous error handling. The original storytelling/Aurora
result was unsuitable for browsing hotels and was narrowed before selection.

## Implementation palette

Adapt the directory palette to a quieter travel product with darker controls:

| Token | Color | Use |
| --- | --- | --- |
| --paper | #fcfcf8 | Page background |
| --surface | #ffffff | Cards and fields |
| --ink | #173d34 | Text and primary buttons |
| --muted | #596b63 | Secondary text |
| --green | #215943 | Hover and links |
| --green-soft | #e8efe6 | Subtle panels |
| --accent | #a5502c | Saved hearts and emphasis |
| --danger | #a72b2b | Errors, always with text |
| --line | #dfe5dc | Decorative separators |

Primary controls use paper on ink, secondary text uses muted on paper/surface.
The visible focus outline uses accent; form input boundaries are darker than
decorative separators. Verify text contrast >=4.5:1 independently of font size.

## Typography and layout

Use locally bundled Noto Sans Thai, weights 400/500/600/700, with Tahoma/sans-serif
fallback. Prices use tabular numerals and Intl.NumberFormat currency formatting.
Use 4/8px spacing increments, 1168px content width, 16px card radius and restrained
150?200ms state transitions. Grid: 3 desktop, 2 tablet, 1 small phone. Maintain
complete readable text and no horizontal overflow at 375px and landscape sizes.

## Interaction

- Lucide outline SVG icons; decorative icons are aria-hidden.
- Save controls are native buttons, >=44x44 CSS px, with aria-pressed and hotel name.
- Disable duplicate saves while pending; keep the state unchanged on API failure.
- Cookie-backed authentication, no token in browser storage.
- Announce completed actions with one polite status region without moving focus.
- Focus failed-auth error summary; keep field labels and browser validation.
- Route transitions focus main; include skip link and visible keyboard focus.
- Reduced motion removes transitions. No carousels, parallax or autoplay.
- Show loading, empty, failure and retry states for data requests.
- Hotel art is a decorative generic SVG, not a photograph of the actual hotel.

## Scope

Home (public Top 3 + paginated hotels), personal Favorites, login and registration.
Booking and admin report workflows remain in the backend/Postman. No invented
listings or popularity values appear in the production UI.
