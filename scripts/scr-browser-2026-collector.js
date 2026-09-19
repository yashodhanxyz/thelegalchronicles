/*
 * Verified SCR 2026 metadata collector
 *
 * Paste into the developer console on a user-validated SCR search page.
 * It applies each 2026 volume filter, waits for DataTables' server-side draw
 * event, validates every row, and exports one 279-row NDJSON file.
 */
(async () => {
  "use strict";

  const VOLUMES = new Map([
    [8, 31], [7, 34], [6, 22], [5, 30],
    [4, 32], [3, 32], [2, 34], [1, 64],
  ]);
  const EXPECTED_TOTAL = [...VOLUMES.values()].reduce((sum, count) => sum + count, 0);

  if (location.origin !== "https://scr.sci.gov.in") {
    throw new Error("Run this collector only on https://scr.sci.gov.in");
  }
  if (window.__scr2026CollectorRunning) {
    throw new Error("The SCR 2026 collector is already running");
  }
  window.__scr2026CollectorRunning = true;

  const clean = (value) => (value || "").replace(/\s+/g, " ").trim();
  const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const overlay = document.createElement("aside");
  overlay.setAttribute("role", "status");
  Object.assign(overlay.style, {
    position: "fixed", right: "16px", bottom: "16px", zIndex: "2147483647",
    width: "min(460px, calc(100vw - 32px))", padding: "14px 16px",
    borderRadius: "10px", background: "#111827", color: "#f9fafb",
    boxShadow: "0 12px 32px rgba(0,0,0,.28)",
    font: "14px/1.45 system-ui, sans-serif", whiteSpace: "pre-wrap",
  });
  document.body.append(overlay);
  const report = (message) => {
    overlay.textContent = message;
    console.log(`[SCR 2026] ${message}`);
  };

  function parseRow(row) {
    const cells = row.querySelectorAll(":scope > td");
    const cell = cells[1];
    const main = cell?.querySelector('button[onclick*="open_pdf"]');
    const call = (main?.getAttribute("onclick") || "").match(
      /\('([^']*)','([^']*)','([^']*)','([^']*)'/,
    );
    const actions = [...cell.querySelectorAll("[onclick]")];
    const detailMap = {};
    let label = null;
    for (const element of cell.querySelectorAll(".caseDetailsTD span, .caseDetailsTD font")) {
      if (element.tagName.toLowerCase() === "span") {
        label = clean(element.textContent)
          .replace(/^\|\s*/, "")
          .replace(/\s*:\s*$/, "")
          .toLowerCase();
      } else if (label) {
        detailMap[label] = clean(element.textContent);
      }
    }
    const coram = [...cell.querySelectorAll(":scope > strong")].find(
      (element) => !element.classList.contains("caseDetailsTD"),
    );
    const excerpt = [...cell.childNodes]
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => clean(node.textContent))
      .filter(Boolean)
      .join(" ");
    const actionListed = (labelText) => actions.some(
      (element) => clean(element.textContent) === labelText,
    );
    return {
      position: Number(cells[0]?.textContent?.trim()),
      title_source: clean(main?.querySelector("strong")?.textContent),
      scr_citation: clean(cell.querySelector(".escrText")?.textContent),
      neutral_citation: clean(cell.querySelector(".ncDisplay")?.textContent),
      coram_source: clean(coram?.textContent).replace(/^Coram\s*:\s*/i, ""),
      result_excerpt_source: excerpt,
      decision_date_source: detailMap["decision date"] || null,
      case_number_source: detailMap["case no"] || null,
      disposal_nature_source: detailMap["disposal nature"] || null,
      bench_size_source: detailMap.bench || null,
      source_lookup: {
        citation_year: call ? Number(call[2]) : null,
        path: call?.[3] || null,
        neutral_key: call?.[4] || null,
      },
      actions_listed: {
        split_view: actionListed("Split view"),
        html_view: actionListed("HTML view"),
        flip_view: actionListed("Flip view"),
        pdf: actionListed("PDF"),
      },
      languages: [],
    };
  }

  function table() {
    if (!window.jQuery?.fn?.dataTable?.isDataTable("#example_pdf")) {
      throw new Error("SCR results are unavailable; refresh and validate the session");
    }
    return window.jQuery("#example_pdf").DataTable();
  }

  function waitForNextDraw(action, timeoutMilliseconds = 120_000) {
    return new Promise((resolve, reject) => {
      let timer;
      const onDraw = () => {
        clearTimeout(timer);
        window.jQuery(document).off("draw.dt", "#example_pdf", onDraw);
        resolve();
      };
      window.jQuery(document).one("draw.dt", "#example_pdf", onDraw);
      timer = setTimeout(() => {
        window.jQuery(document).off("draw.dt", "#example_pdf", onDraw);
        reject(new Error("Timed out waiting for the SCR server response"));
      }, timeoutMilliseconds);
      try {
        action();
      } catch (error) {
        clearTimeout(timer);
        window.jQuery(document).off("draw.dt", "#example_pdf", onDraw);
        reject(error);
      }
    });
  }

  async function waitForVolume(volume, expectedCount, timeoutMilliseconds = 120_000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMilliseconds) {
      if (window.jQuery?.fn?.dataTable?.isDataTable("#example_pdf")) {
        const current = table();
        const info = current.page.info();
        const firstCitation = clean(document.querySelector("#example_pdf tbody .escrText")?.textContent);
        if (
          info.recordsDisplay === expectedCount &&
          firstCitation.startsWith(`[2026] ${volume} S.C.R.`)
        ) return current;
      }
      await sleep(250);
    }
    throw new Error(`Timed out applying the 2026 Volume ${volume} filter`);
  }

  async function captureVolumeFilters(timeoutMilliseconds = 60_000) {
    const readFilters = () => new Map([...VOLUMES.keys()].flatMap((volume) => {
      const selector = `#accordionCitVol a[href*="2026~${volume}"]`;
      const href = document.querySelector(selector)?.getAttribute("href");
      return href ? [[volume, href]] : [];
    }));

    let filters = readFilters();
    if (filters.size !== VOLUMES.size) {
      const yearButton = document.querySelector("#year_btn");
      if (!yearButton) throw new Error("SCR did not expose the Volume Year Show button");
      yearButton.click();
    }

    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMilliseconds) {
      filters = readFilters();
      if (filters.size === VOLUMES.size) return filters;
      await sleep(250);
    }
    throw new Error(`SCR exposed only ${filters.size} of ${VOLUMES.size} expected 2026 volume filters`);
  }

  function clickVolumeFilter(volume, volumeFilters) {
    const link = document.createElement("a");
    link.href = volumeFilters.get(volume);
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
  }

  function exportRows(rows) {
    const body = `${rows.map((record) => JSON.stringify(record)).join("\n")}\n`;
    const blob = new Blob([body], { type: "application/x-ndjson" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `scr-inventory-2026-${rows.length}.ndjson`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
  }

  try {
    const collected = [];
    const volumeFilters = await captureVolumeFilters();
    for (const [volume, expectedCount] of VOLUMES) {
      report(`Loading 2026 Volume ${volume}…`);
      await waitForNextDraw(() => clickVolumeFilter(volume, volumeFilters));
      let current = await waitForVolume(volume, expectedCount);
      if (current.page.len() !== 1000) {
        await waitForNextDraw(() => current.page.len(1000).draw());
        current = await waitForVolume(volume, expectedCount);
      }

      const rows = [...document.querySelectorAll("#example_pdf tbody tr")].map(parseRow);
      const citationPattern = new RegExp(`^\\[2026\\] ${volume} S\\.C\\.R\\.`);
      if (
        rows.length !== expectedCount ||
        rows.some((record) => (
          record.source_lookup.citation_year !== 2026 ||
          !record.source_lookup.path ||
          !citationPattern.test(record.scr_citation)
        ))
      ) {
        throw new Error(`Integrity check failed for 2026 Volume ${volume}`);
      }
      collected.push(...rows.map((record) => ({ ...record, collection_volume: volume })));
      report(
        `Verified 2026 Volume ${volume}: ${rows.length} judgments\n` +
        `Total collected: ${collected.length} of ${EXPECTED_TOTAL}`,
      );
    }

    const sourceKeys = collected.map((record) => [
      record.source_lookup.citation_year,
      record.source_lookup.path,
      record.source_lookup.neutral_key,
    ].join("|"));
    if (collected.length !== EXPECTED_TOTAL || new Set(sourceKeys).size !== EXPECTED_TOTAL) {
      throw new Error(
        `Final integrity check failed: expected ${EXPECTED_TOTAL} unique judgments, ` +
        `found ${new Set(sourceKeys).size}`,
      );
    }
    exportRows(collected);
    report(`Complete. Exported ${collected.length} verified 2026 judgments as NDJSON.`);
  } catch (error) {
    report(`Stopped safely: ${error.message}\nRefresh the SCR session before retrying.`);
    console.error(error);
  } finally {
    window.__scr2026CollectorRunning = false;
  }
})();
