/*
 * DEPRECATED: unsafe SCR browser-local inventory collector
 *
 * Paste this file into the developer console on a user-validated
 * https://scr.sci.gov.in/scrsearch/ results page. It does not call any remote
 * service. Each result page is checkpointed in IndexedDB and the complete
 * inventory is exported as NDJSON when collection finishes. This version used
 * an insufficient page-readiness check and is retained only for provenance.
 */
throw new Error(
  "Deprecated collector: use scripts/scr-browser-2026-collector.js or a draw-event-verified successor",
);
(async () => {
  "use strict";

  const DATABASE_NAME = "the-legal-chronicles-scr-inventory";
  const DATABASE_VERSION = 1;
  const PAGE_STORE = "pages";
  const PAGE_SIZE = 1000;

  if (location.origin !== "https://scr.sci.gov.in") {
    throw new Error("Run this collector only on https://scr.sci.gov.in");
  }
  if (window.__scrInventoryCollectorRunning) {
    throw new Error("The SCR inventory collector is already running");
  }
  window.__scrInventoryCollectorRunning = true;

  const clean = (value) => (value || "").replace(/\s+/g, " ").trim();
  const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

  const overlay = document.createElement("aside");
  overlay.id = "scr-inventory-collector-status";
  overlay.setAttribute("role", "status");
  Object.assign(overlay.style, {
    position: "fixed",
    right: "16px",
    bottom: "16px",
    zIndex: "2147483647",
    width: "min(440px, calc(100vw - 32px))",
    padding: "14px 16px",
    borderRadius: "10px",
    background: "#111827",
    color: "#f9fafb",
    boxShadow: "0 12px 32px rgba(0,0,0,.28)",
    font: "14px/1.45 system-ui, sans-serif",
    whiteSpace: "pre-wrap",
  });
  document.body.append(overlay);
  const report = (message) => {
    overlay.textContent = message;
    console.log(`[SCR inventory] ${message}`);
  };

  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains(PAGE_STORE)) {
          database.createObjectStore(PAGE_STORE, { keyPath: "page" });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  function transact(database, mode, operation) {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(PAGE_STORE, mode);
      const store = transaction.objectStore(PAGE_STORE);
      let result;
      try {
        result = operation(store);
      } catch (error) {
        reject(error);
        return;
      }
      transaction.oncomplete = () => resolve(result?.result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("IndexedDB transaction aborted"));
    });
  }

  const savePage = (database, page, records, totalPages, totalRecords) => transact(
    database,
    "readwrite",
    (store) => store.put({
      page,
      records,
      total_pages: totalPages,
      total_records: totalRecords,
      collected_at: new Date().toISOString(),
    }),
  );

  const readPages = (database) => transact(database, "readonly", (store) => store.getAll());

  function pageIsValid(entry, totalPages, totalRecords) {
    if (!Number.isInteger(entry?.page) || entry.page < 0 || entry.page >= totalPages) return false;
    const expectedFirst = entry.page * PAGE_SIZE + 1;
    const expectedLength = Math.min(PAGE_SIZE, totalRecords - entry.page * PAGE_SIZE);
    if (!Array.isArray(entry.records) || entry.records.length !== expectedLength) return false;
    return entry.records.every(
      (record, index) => record?.position === expectedFirst + index && record.source_lookup?.path,
    );
  }

  function validPages(pages, totalPages, totalRecords) {
    return pages.filter((entry) => pageIsValid(entry, totalPages, totalRecords));
  }

  function firstMissingPage(pages, totalPages) {
    const savedPageNumbers = new Set(pages.map((entry) => entry.page));
    return Array.from({ length: totalPages }, (_, page) => page)
      .find((page) => !savedPageNumbers.has(page)) ?? totalPages;
  }

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
      throw new Error("SCR results are unavailable; the session may have expired");
    }
    return window.jQuery("#example_pdf").DataTable();
  }

  function sessionIsBlocked() {
    const hasResultRows = document.querySelectorAll("#example_pdf tbody tr").length > 0;
    const visibleCaptchaField = [...document.querySelectorAll(
      'input[id*="captcha" i], input[name*="captcha" i]',
    )].some((element) => element.offsetParent !== null);
    return !hasResultRows && (
      visibleCaptchaField || /session\s+(?:has\s+)?expired/i.test(document.body.innerText)
    );
  }

  async function waitForExpectedPosition(expectedPosition, timeoutMilliseconds = 90_000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMilliseconds) {
      const nextPosition = Number(document.querySelector("#example_pdf tbody tr td")?.textContent);
      if (nextPosition === expectedPosition) return;
      if (sessionIsBlocked()) {
        throw new Error("SCR session expired or requested a CAPTCHA");
      }
      await sleep(500);
    }
    throw new Error(`Timed out waiting for SCR position ${expectedPosition.toLocaleString()}`);
  }

  async function waitForRows(expectedRows, timeoutMilliseconds = 90_000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMilliseconds) {
      const rowCount = document.querySelectorAll("#example_pdf tbody tr").length;
      if (rowCount >= expectedRows) return;
      if (sessionIsBlocked()) {
        throw new Error("SCR session expired or requested a CAPTCHA");
      }
      await sleep(500);
    }
    throw new Error(`Timed out waiting for ${expectedRows} SCR rows`);
  }

  function exportNdjson(pages, expectedTotal) {
    const records = pages
      .sort((left, right) => left.page - right.page)
      .flatMap((entry) => entry.records)
      .sort((left, right) => left.position - right.position);
    const positionsAreComplete = records.length === expectedTotal && records.every(
      (record, index) => record.position === index + 1,
    );
    if (!positionsAreComplete) {
      throw new Error(
        `Export integrity check failed: expected ${expectedTotal.toLocaleString()} sequential SCR positions, ` +
        `found ${records.length.toLocaleString()} rows`,
      );
    }
    const sourceKeys = records.map((record) => [
      record.source_lookup.citation_year,
      record.source_lookup.path,
      record.source_lookup.neutral_key,
    ].join("|"));
    const repeatedSourceTupleRows = records.length - new Set(sourceKeys).size;
    const body = `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
    const blob = new Blob([body], { type: "application/x-ndjson" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `scr-inventory-complete-${records.length}.ndjson`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 60_000);
    return { count: records.length, repeatedSourceTupleRows };
  }

  let database;
  try {
    database = await openDatabase();
    const table = dataTable();
    if (table.page.len() !== PAGE_SIZE) {
      report("Loading 1,000 judgments per SCR page…");
      const expectedRows = Math.min(PAGE_SIZE, table.page.info().recordsDisplay);
      table.page.len(PAGE_SIZE).draw();
      await waitForRows(expectedRows);
    }

    let savedPages = await readPages(database);
    let info = table.page.info();
    let verifiedPages = validPages(savedPages, info.pages, info.recordsDisplay);
    let nextMissingPage = firstMissingPage(verifiedPages, info.pages);

    if (nextMissingPage >= info.pages) {
      const result = exportNdjson(verifiedPages, info.recordsDisplay);
      report(
        `Already complete. Exported ${result.count.toLocaleString()} judgments.\n` +
        `${result.repeatedSourceTupleRows.toLocaleString()} rows share an SCR source tuple; all were preserved.`,
      );
      return;
    }

    const resumePosition = nextMissingPage * PAGE_SIZE + 1;
    const visiblePosition = Number(document.querySelector("#example_pdf tbody tr td")?.textContent);
    if (info.page !== nextMissingPage || visiblePosition !== resumePosition) {
      report(`Resuming at SCR page ${nextMissingPage + 1} of ${info.pages}…`);
      table.page(nextMissingPage).draw("page");
      await waitForExpectedPosition(resumePosition);
      info = table.page.info();
    }

    while (true) {
      const rows = [...document.querySelectorAll("#example_pdf tbody tr")].map(parseRow);
      if (!rows.length || rows.some((record) => !record.position || !record.source_lookup.path)) {
        throw new Error("The current SCR page did not contain valid inventory rows");
      }
      const expectedPosition = info.page * PAGE_SIZE + 1;
      if (rows[0].position !== expectedPosition) {
        throw new Error(
          `SCR page mismatch: expected position ${expectedPosition.toLocaleString()}, ` +
          `received ${rows[0].position.toLocaleString()}`,
        );
      }

      await savePage(database, info.page, rows, info.pages, info.recordsDisplay);
      report(
        `Saved page ${info.page + 1} of ${info.pages} locally\n` +
        `Positions ${rows[0].position}–${rows.at(-1).position}`,
      );

      savedPages = await readPages(database);
      verifiedPages = validPages(savedPages, info.pages, info.recordsDisplay);
      nextMissingPage = firstMissingPage(verifiedPages, info.pages);
      if (nextMissingPage >= info.pages) {
        const result = exportNdjson(verifiedPages, info.recordsDisplay);
        report(
          `Complete. Exported ${result.count.toLocaleString()} judgments as NDJSON.\n` +
          `${result.repeatedSourceTupleRows.toLocaleString()} rows share an SCR source tuple; all were preserved.`,
        );
        break;
      }

      table.page(nextMissingPage).draw("page");
      await waitForExpectedPosition(nextMissingPage * PAGE_SIZE + 1);
      info = table.page.info();
    }
  } catch (error) {
    let savedCount = 0;
    try {
      if (database) {
        const savedPages = await readPages(database);
        const table = dataTable();
        const info = table.page.info();
        savedCount = validPages(savedPages, info.pages, info.recordsDisplay)
          .reduce((total, entry) => total + entry.records.length, 0);
      }
    } catch {
      // Preserve the original collection error.
    }
    report(
      `Stopped safely after checkpointing ${savedCount.toLocaleString()} rows: ${error.message}\n` +
      "Resolve the SCR session, then rerun this same script to resume.",
    );
    console.error(error);
  } finally {
    database?.close();
    window.__scrInventoryCollectorRunning = false;
  }
})();
