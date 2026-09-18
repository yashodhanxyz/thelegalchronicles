# SCR Source Mapping

Observed on the public Supreme Court Reports search interface on 2026-09-16.
This is a pilot map, not a claim that every historical record uses the same
markup.

## Search result fields

| SCR source | Internal field | Notes |
| --- | --- | --- |
| Result button `strong` text | `title_source` | Preserve exactly; a separate slug is derived. |
| `.escrText` | `scr_citation` | Example: `[2026] 8 S.C.R. 480`. |
| `.ncDisplay` | `neutral_citation` | Example: `2026 INSC 839`. |
| `Coram` line | `coram_source` | Preserve raw spelling, order, punctuation, and author marker. |
| `Decision Date` | `decision_date` | Normalise only into an additional ISO date field. |
| `Case No` | `case_number_source` | Preserve raw value; derive case type separately. |
| `Disposal Nature` | `disposal_nature_source` | Source classification. |
| `Bench` | `bench_size_source` | Source label such as `2 Judges`. |
| Result preview | `result_excerpt_source` | Source text used for listing/search snippets. |

## Stable lookup identifiers observed in result actions

The HTML/Split View action calls:

```text
open_splitview(val, citation_year, path, nc_display, flag)
```

The pilot stores `citation_year`, `path`, and `nc_display`. `val` is the visible
row position and must not be treated as a permanent identifier. `flag=H` and
`flag=S` return the same document; Split View adds navigation.

For the first pilot record:

```text
citation_year = 2026
path          = 2026_8_480_488
nc_display    = 2026INSC839
```

The natural deduplication key is the unique source tuple composed from citation
year, source path, and source neutral citation key. Neutral citation must remain
indexed but non-unique: the first 1,000-row live inventory contained four
neutral citation values assigned to two different SCR paths and titles each.

## Judgment body fields

The representative 2026 response contained these source classes or anchors:

| Source section | Suggested representation |
| --- | --- |
| `.Issues-for-Consideration_Heading` | section boundary only |
| `.Headnote_Heading` | section boundary only |
| `.Case-Cited_Heading` | section boundary and cited-case extraction |
| `.Act_Heading` / Acts content | Act relationship extraction |
| `.Keywords_Heading` | keyword relationship extraction |
| `.Apeal-1_Heading` | originating-case text |
| `.Advocatees-Appeared_Heading` | appearances text |
| judgment content classes | immutable body content |
| `.Result-of-the-Case` | source result text |
| `._idFootnotes` and footnote anchors | preserved footnotes and backlinks |

The R2 source object must retain the exact returned document markup required to
reproduce the legal document. A separate render object may remove executable
scripts, inline event handlers, modal controls, and remote dependencies, but it
must not alter visible source text or its order.

## Source-access constraint discovered by the pilot

SCR returns search and Split/HTML View data through session-bound AJAX routes.
A direct request without a currently validated session returns a session-expiry
response containing a CAPTCHA challenge. The page does not expose a stable
public HTML asset URL for the returned judgment body.

Therefore:

- do not attempt to solve or bypass the CAPTCHA automatically;
- do not describe the ingestion pipeline as unattended until an approved source
  access method is established;
- allow a supervised browser-session import as a pilot option; and
- investigate an official bulk/API access arrangement before scheduling a
  Cloudflare production importer.

## Inventory and availability semantics

The result listing and the underlying asset response are measured separately.
An action button being present does not prove that its content is available.

- `action_status=listed` means the result row offered that action.
- `verification_status=available` means a supervised request returned the
  expected asset structure.
- `verification_status=unavailable` means the source answered successfully but
  did not contain that asset.
- `verification_status=session_expired` is a collection interruption, not an
  assertion that the judgment lacks the asset.
- `verification_status=error` records another failed check for later retry.

Coverage must be stored per judgment and only then aggregated by citation year.
This avoids incorrectly treating a mixed year as uniformly HTML-capable or
PDF-only.

## Verified 2026 inventory

The volume-filtered 2026 collection completed with 279 unique judgments across
all eight SCR citation volumes: V1 64, V2 34, V3 32, V4 32, V5 30, V6 22,
V7 34, and V8 31. Every collected row listed Split, HTML, Flip, and PDF actions.
One row omitted `coram_source` and 18 omitted `disposal_nature_source`; these
remain source-level unknowns rather than values to infer.

These action counts do not verify the corresponding asset response. Body and
PDF availability must still be requested and recorded per judgment.

SCR's result table uses server-side DataTables requests. A collection step must
wait for the table's completed `draw` event before reading rows. The displayed
positions can update before the AJAX response replaces the previous row
content, so position changes alone are not a valid readiness signal.

An earlier unfiltered closing-page sample was invalidated after this stale-row
race was discovered. Its availability claims must not be used. The source UI's
38,598 total is still a source-reported archive size, not a completed local
inventory.

## Attribution

Every published page and generated PDF must prominently acknowledge Supreme
Court Reports (SCR), link to the authoritative source, and state that the source
record prevails.
