/*
 * DEPRECATED: unsafe SCR tail recovery collector
 *
 * Collects the final ten 1,000-row SCR result pages by navigating backward
 * from DataTables' Last control. This avoids numeric resume-offset drift and
 * includes one overlap page for offline integrity verification. This strategy
 * was invalidated by SCR's stale-row race and is retained only for provenance.
 */
throw new Error(
  "Deprecated tail collector: use a draw-event-verified year collector",
);
(async () => {
  "use strict";

  const PAGE_SIZE = 1000;
  const PAGES_TO_COLLECT = 10;
  if (location.origin !== "https://scr.sci.gov.in") {
    throw new Error("Run this collector only on https://scr.sci.gov.in");
  }
  if (window.__scrTailCollectorRunning) {
    throw new Error("The SCR tail recovery collector is already running");
  }
  window.__scrTailCollectorRunning = true;

  const clean = (value) => (value || "").replace(/\s+/g, " ").trim();
  const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const overlay = document.createElement("aside");
  overlay.setAttribute("role", "status");
  Object.assign(overlay.style, {
    position: "fixed", right: "16px", bottom: "16px", zIndex: "2147483647",
    width: "min(440px, calc(100vw - 32px))", padding: "14px 16px",
    borderRadius: "10px", background: "#111827", color: "#f9fafb",
    boxShadow: "0 12px 32px rgba(0,0,0,.28)",
    font: "14px/1.45 system-ui, sans-serif", whiteSpace: "pre-wrap",
  });
  document.body.append(overlay);
  const report = (message) => {
    overlay.textContent = message;
    console.log(`[SCR tail recovery] ${message}`);
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

  function dataTable() {
    if (!window.jQuery?.fn?.dataTable?.isDataTable("#example_pdf")) {
      throw new Error("SCR results are unavailable; refresh and validate the session");
    }
    return window.jQuery("#example_pdf").DataTable();
  }

  async function waitForPage(page, timeoutMilliseconds = 120_000) {
    const expectedPosition = page * PAGE_SIZE + 1;
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMilliseconds) {
      const table = dataTable();
      const position = Number(document.querySelector("#example_pdf tbody tr td")?.textContent);
      if (table.page.info().page === page && position === expectedPosition) return;
      await sleep(500);
    }
    throw new Error(`Timed out waiting for displayed position ${expectedPosition.toLocaleString()}`);
  }

  function exportRows(rows) {
    const body = `${rows.map((record) => JSON.stringify(record)).join("\n")}\n`;
    const blob = new Blob([body], { type: "application/x-ndjson" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `scr-inventory-tail-recovery-${rows.length}.ndjson`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
  }

  try {
    const table = dataTable();
    if (table.page.len() !== PAGE_SIZE) {
      report("Loading 1,000 judgments per SCR page…");
      table.page.len(PAGE_SIZE).draw();
      const startedAt = Date.now();
      while (document.querySelectorAll("#example_pdf tbody tr").length < PAGE_SIZE) {
        if (Date.now() - startedAt > 120_000) throw new Error("Timed out loading 1,000 rows");
        await sleep(500);
      }
    }

    let info = table.page.info();
    const lastPage = info.pages - 1;
    const firstPage = Math.max(0, lastPage - PAGES_TO_COLLECT + 1);
    table.page("last").draw("page");
    await waitForPage(lastPage);

    const pages = [];
    for (let page = lastPage; page >= firstPage; page -= 1) {
      const rows = [...document.querySelectorAll("#example_pdf tbody tr")].map(parseRow);
      const expectedFirst = page * PAGE_SIZE + 1;
      const expectedLength = Math.min(PAGE_SIZE, info.recordsDisplay - page * PAGE_SIZE);
      if (
        rows.length !== expectedLength ||
        rows.some((record, index) => record.position !== expectedFirst + index || !record.source_lookup.path)
      ) {
        throw new Error(`Integrity check failed on displayed SCR page ${page + 1}`);
      }
      pages.push(...rows);
      report(
        `Recovered displayed page ${page + 1} of ${info.pages}\n` +
        `Positions ${rows[0].position}–${rows.at(-1).position}`,
      );
      if (page === firstPage) break;
      table.page("previous").draw("page");
      await waitForPage(page - 1);
      info = table.page.info();
    }

    pages.sort((left, right) => left.position - right.position);
    exportRows(pages);
    report(`Tail recovery complete. Exported ${pages.length.toLocaleString()} rows for offline merge validation.`);
  } catch (error) {
    report(`Tail recovery stopped safely: ${error.message}\nRefresh the SCR session and rerun.`);
    console.error(error);
  } finally {
    window.__scrTailCollectorRunning = false;
  }
})();
