/*
 * DEPRECATED: unsafe SCR inventory collector
 *
 * Position changes are not a valid readiness signal for SCR's server-side
 * DataTable and can pair new positions with stale judgment rows. Use the
 * draw-event-verified year collector instead.
 */
throw new Error(
  "Deprecated collector: use scripts/scr-browser-2026-collector.js or a draw-event-verified successor",
);
(async () => {
  "use strict";

  if (location.origin !== "https://scr.sci.gov.in") {
    throw new Error("Run this collector only on https://scr.sci.gov.in");
  }
  if (window.__scrInventoryCollectorRunning) {
    throw new Error("The SCR inventory collector is already running");
  }
  window.__scrInventoryCollectorRunning = true;

  const clean = (value) => (value || "").replace(/\s+/g, " ").trim();
  const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
  const bridgePageUrl = prompt("Paste the SCR bridge URL printed by npm run inventory:bridge");
  if (!bridgePageUrl) {
    window.__scrInventoryCollectorRunning = false;
    return;
  }

  const bridgeUrl = new URL(bridgePageUrl);
  if (bridgeUrl.hostname !== "127.0.0.1" || !bridgeUrl.searchParams.get("token")) {
    window.__scrInventoryCollectorRunning = false;
    throw new Error("Expected a tokenized http://127.0.0.1 SCR bridge URL");
  }
  const apiUrl = new URL("/api/import", bridgeUrl);
  apiUrl.searchParams.set("token", bridgeUrl.searchParams.get("token"));

  const overlay = document.createElement("aside");
  overlay.id = "scr-inventory-collector-status";
  overlay.setAttribute("role", "status");
  Object.assign(overlay.style, {
    position: "fixed",
    right: "16px",
    bottom: "16px",
    zIndex: "2147483647",
    width: "min(420px, calc(100vw - 32px))",
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

  async function waitForPage(firstPosition, timeoutMilliseconds = 90_000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMilliseconds) {
      const nextPosition = Number(document.querySelector("#example_pdf tbody tr td")?.textContent);
      if (nextPosition && nextPosition !== firstPosition) return;
      if (/captcha|session.*expir/i.test(document.body.innerText)) {
        throw new Error("SCR session expired or requested a CAPTCHA");
      }
      await sleep(500);
    }
    throw new Error("Timed out waiting for the next SCR result page");
  }

  async function waitForRows(expectedRows, timeoutMilliseconds = 90_000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMilliseconds) {
      const rowCount = document.querySelectorAll("#example_pdf tbody tr").length;
      if (rowCount >= expectedRows) return;
      if (/captcha|session.*expir/i.test(document.body.innerText)) {
        throw new Error("SCR session expired or requested a CAPTCHA");
      }
      await sleep(500);
    }
    throw new Error(`Timed out waiting for ${expectedRows} SCR rows`);
  }

  try {
    const table = dataTable();
    if (table.page.len() !== 1000) {
      report("Loading 1,000 judgments per SCR page…");
      const expectedRows = Math.min(1000, table.page.info().recordsDisplay);
      table.page.len(1000).draw();
      await waitForRows(expectedRows);
    }

    let info = table.page.info();
    while (true) {
      const rows = [...document.querySelectorAll("#example_pdf tbody tr")].map(parseRow);
      if (!rows.length || rows.some((record) => !record.position || !record.source_lookup.path)) {
        throw new Error("The current SCR page did not contain valid inventory rows");
      }

      report(
        `Importing page ${info.page + 1} of ${info.pages}\n` +
        `Positions ${rows[0].position}–${rows.at(-1).position}`,
      );
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(rows),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.error || "Local import failed");

      info = table.page.info();
      if (info.page >= info.pages - 1) {
        report(`Complete. Imported through position ${rows.at(-1).position}.`);
        break;
      }

      const firstPosition = rows[0].position;
      table.page("next").draw("page");
      await waitForPage(firstPosition);
      info = table.page.info();
    }
  } catch (error) {
    report(`Stopped safely: ${error.message}\nResolve the SCR session, then rerun to resume.`);
    console.error(error);
  } finally {
    window.__scrInventoryCollectorRunning = false;
  }
})();
