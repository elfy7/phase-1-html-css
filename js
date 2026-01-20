const $ = (id) => document.getElementById(id);

const form = $("form");
const balanceEl = $("balance");
const riskPctEl = $("riskPct");
const entryEl = $("entry");
const slEl = $("sl");
const tpEl = $("tp");
const sideEl = $("side");

const riskUsdOut = $("riskUsd");
const posOzOut = $("posOz");
const posLotsOut = $("posLots");
const slDistOut = $("slDist");
const tpDistOut = $("tpDist");
const rrOut = $("rr");
const validOut = $("valid");

// ========== SHARED UTILITIES ==========
function fmt(n) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

function roundToStep(value, step) {
  return Math.round(value / step) * step;
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ========== RISK CALCULATOR (Page 1) ==========
(function() {
  const $ = (id) => document.getElementById(id);

  const form = $("form");
  if (!form) return; // Skip if not on this page

  const balanceEl = $("balance");
  const riskPctEl = $("riskPct");
  const entryEl = $("entry");
  const slEl = $("sl");
  const tpEl = $("tp");
  const sideEl = $("side");

  const riskUsdOut = $("riskUsd");
  const posOzOut = $("posOz");
  const posLotsOut = $("posLots");
  const slDistOut = $("slDist");
  const tpDistOut = $("tpDist");
  const rrOut = $("rr");
  const validOut = $("valid");

  function isValidSetup(side, entry, sl, tp) {
    if (side === "buy") return sl < entry && entry < tp;
    return tp < entry && entry < sl;
  }

  function calcPositionOz(riskUsd, slDist) {
    if (!(riskUsd > 0) || !(slDist > 0)) return NaN;
    return riskUsd / slDist;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const balance = Number(balanceEl.value);
    const riskPct = Number(riskPctEl.value);
    const entry = Number(entryEl.value);
    const sl = Number(slEl.value);
    const tp = Number(tpEl.value);
    const side = sideEl.value;

    const riskUsd = (balance * riskPct) / 100;
    const slDist = Math.abs(entry - sl);
    const tpDist = Math.abs(tp - entry);
    const rr = slDist > 0 ? (tpDist / slDist) : NaN;

    const ok =
      balance > 0 &&
      riskPct > 0 &&
      slDist > 0 &&
      tpDist > 0 &&
      isValidSetup(side, entry, sl, tp);

    const posOz = ok ? calcPositionOz(riskUsd, slDist) : NaN;
    const rawLots = Number.isFinite(posOz) ? (posOz / 100) : NaN;
    const posLots = Number.isFinite(rawLots) ? roundToStep(rawLots, 0.01) : NaN;

    riskUsdOut.textContent = `$${fmt(riskUsd)}`;
    posOzOut.textContent = Number.isFinite(posOz) ? `${fmt(posOz)} oz` : "—";
    posLotsOut.textContent = Number.isFinite(posLots) ? `${posLots.toFixed(3)} lots` : "—";
    slDistOut.textContent = `$${fmt(slDist)}`;
    tpDistOut.textContent = `$${fmt(tpDist)}`;
    rrOut.textContent = Number.isFinite(rr) ? rr.toFixed(2) : "—";
    validOut.textContent = ok ? "YES ✅" : "NO ❌";
  });
})();

// ========== TRADE JOURNAL v2 (Main App) ==========
(function() {
  const STORAGE_KEY = "tradeJournal_v2";
  const $ = (id) => document.getElementById(id);

  // form
  const form = $("tradeForm");
  if (!form) return; // Skip if not on this page

  const formTitle = $("formTitle");
  const editBadge = $("editBadge");
  const saveBtn = $("saveBtn");
  const cancelEditBtn = $("cancelEditBtn");

  const dateEl = $("date");
  const symbolEl = $("symbol");
  const sideEl = $("side");
  const resultEl = $("result");
  const entryEl = $("entry");
  const slEl = $("sl");
  const tpEl = $("tp");
  const notesEl = $("notes");

  const resetBtn = $("resetBtn");

  // filters
  const fSymbolEl = $("fSymbol");
  const fSideEl = $("fSide");
  const fResultEl = $("fResult");
  const fTagEl = $("fTag");
  const fSortEl = $("fSort");

  const tbody = $("tbody");
  const countLabel = $("countLabel");

  // stats
  const stTotal = $("stTotal");
  const stWinrate = $("stWinrate");
  const stNetR = $("stNetR");
  const stAvgRR = $("stAvgRR");

  // actions
  const clearBtn = $("clearBtn");
  const exportBtn = $("exportBtn");

  // charts
  const cNetR = $("cNetR");
  const cWinrate = $("cWinrate");
  const ctxNetR = cNetR?.getContext("2d");
  const ctxWinrate = cWinrate?.getContext("2d");

  let editingId = null;

  function uid() {
    return (crypto?.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
  }

  function loadTrades() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function saveTrades(trades) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
  }

  function safeNum(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
  }

  function rr(entry, sl, tp) {
    const slDist = Math.abs(entry - sl);
    const tpDist = Math.abs(tp - entry);
    if (!(slDist > 0) || !(tpDist > 0)) return NaN;
    return tpDist / slDist;
  }

  function rResult(result, rrVal) {
    if (result === "tp") return Number.isFinite(rrVal) ? rrVal : NaN;
    if (result === "sl") return -1;
    return 0;
  }

  function validSetup(side, entry, sl, tp) {
    if (side === "buy") return sl < entry && entry < tp;
    return tp < entry && entry < sl;
  }

  function autoTag(symbol) {
    const s = String(symbol || "").toUpperCase().replaceAll(" ", "");
    if (s.includes("XAU") || s.includes("GOLD")) return "gold";
    return "crypto";
  }

  function badge(text, cls) {
    return `<span class="badge ${cls}">${text}</span>`;
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function computeStats(trades) {
    const closed = trades.filter(t => t.result === "tp" || t.result === "sl");
    const wins = closed.filter(t => t.result === "tp").length;
    const losses = closed.filter(t => t.result === "sl").length;

    const netR = trades.reduce((acc, t) => acc + (Number.isFinite(t.r) ? t.r : 0), 0);

    const rrVals = trades
      .map(t => t.rr)
      .filter(v => Number.isFinite(v) && v > 0);

    const avgRR = rrVals.length ? (rrVals.reduce((a,b)=>a+b,0) / rrVals.length) : NaN;

    const winrate = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : NaN;

    return { total: trades.length, winrate, netR, avgRR };
  }

  function normalizeTrades(trades) {
    return trades.map(t => {
      const tag = t.tag || autoTag(t.symbol);
      return { ...t, tag };
    });
  }

  function applyFilters(trades) {
    const sym = (fSymbolEl.value || "").trim().toLowerCase();
    const side = fSideEl.value;
    const res = fResultEl.value;
    const tag = fTagEl.value;
    const sort = fSortEl.value;

    let out = [...trades];

    if (sym) out = out.filter(t => (t.symbol || "").toLowerCase().includes(sym));
    if (tag !== "all") out = out.filter(t => t.tag === tag);
    if (side !== "all") out = out.filter(t => t.side === side);
    if (res !== "all") out = out.filter(t => t.result === res);

    if (sort === "newest") out.sort((a,b) => (b.date || "").localeCompare(a.date || ""));
    if (sort === "oldest") out.sort((a,b) => (a.date || "").localeCompare(b.date || ""));
    if (sort === "bestR") out.sort((a,b) => (b.r ?? 0) - (a.r ?? 0));
    if (sort === "worstR") out.sort((a,b) => (a.r ?? 0) - (b.r ?? 0));

    return out;
  }

  function setEditMode(idOrNull) {
    editingId = idOrNull;

    const isEdit = Boolean(editingId);
    formTitle.textContent = isEdit ? "Edit trade" : "Add trade";
    editBadge.classList.toggle("hidden", !isEdit);
    cancelEditBtn.classList.toggle("hidden", !isEdit);
    saveBtn.textContent = isEdit ? "Update trade" : "Save trade";
  }

  function loadTradeIntoForm(trade) {
    dateEl.value = trade.date || todayISO();
    symbolEl.value = trade.symbol || "";
    sideEl.value = trade.side || "buy";
    resultEl.value = trade.result || "open";
    entryEl.value = trade.entry ?? "";
    slEl.value = trade.sl ?? "";
    tpEl.value = trade.tp ?? "";
    notesEl.value = trade.notes || "";
  }

  function resetForm() {
    form.reset();
    dateEl.value = todayISO();
    symbolEl.value = "XAUUSDT";
    sideEl.value = "buy";
    resultEl.value = "open";
    setEditMode(null);
  }

  // -------- Charts ----------
  function clearCanvas(ctx, w, h) {
    ctx.clearRect(0, 0, w, h);
  }

  function drawAxes(ctx, w, h) {
    ctx.globalAlpha = 1;
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 10);
    ctx.lineTo(40, h - 30);
    ctx.lineTo(w - 10, h - 30);
    ctx.stroke();
  }

  function drawBarChart(ctx, w, h, labels, values) {
    clearCanvas(ctx, w, h);
    drawAxes(ctx, w, h);

    const left = 50, top = 14, bottom = 36, right = 12;
    const innerW = w - left - right;
    const innerH = h - top - bottom;

    if (!values.length) {
      ctx.fillStyle = "rgba(255,255,255,.6)";
      ctx.font = "12px system-ui";
      ctx.fillText("No data", left, top + 20);
      return;
    }

    const maxAbs = Math.max(1, ...values.map(v => Math.abs(v)));
    const n = values.length;
    const gap = 6;
    const barW = Math.max(6, (innerW - gap * (n - 1)) / n);

    const zeroY = top + innerH / 2;
    ctx.strokeStyle = "rgba(255,255,255,.12)";
    ctx.beginPath();
    ctx.moveTo(left, zeroY);
    ctx.lineTo(left + innerW, zeroY);
    ctx.stroke();

    for (let i = 0; i < n; i++) {
      const v = values[i];
      const x = left + i * (barW + gap);

      const scaled = (Math.abs(v) / maxAbs) * (innerH / 2 - 6);
      const y = v >= 0 ? (zeroY - scaled) : zeroY;
      const barH = scaled;

      ctx.fillStyle = v >= 0 ? "rgba(66,211,146,.85)" : "rgba(255,92,122,.85)";
      ctx.fillRect(x, y, barW, barH);

      ctx.fillStyle = "rgba(255,255,255,.65)";
      ctx.font = "10px system-ui";
      const lab = labels[i];
      ctx.save();
      ctx.translate(x + barW / 2, h - 12);
      ctx.rotate(-0.35);
      ctx.textAlign = "center";
      ctx.fillText(lab, 0, 0);
      ctx.restore();
    }
  }

  function drawWinrateChart(ctx, w, h, labels, winrates) {
    clearCanvas(ctx, w, h);
    drawAxes(ctx, w, h);

    const left = 50, top = 14, bottom = 36, right = 12;
    const innerW = w - left - right;
    const innerH = h - top - bottom;

    if (!winrates.length) {
      ctx.fillStyle = "rgba(255,255,255,.6)";
      ctx.font = "12px system-ui";
      ctx.fillText("No closed trades (TP/SL) yet", left, top + 20);
      return;
    }

    const n = winrates.length;
    const gap = 6;
    const barW = Math.max(6, (innerW - gap * (n - 1)) / n);

    ctx.strokeStyle = "rgba(255,255,255,.12)";
    ctx.beginPath();
    ctx.moveTo(left, top);
    ctx.lineTo(left + innerW, top);
    ctx.stroke();

    for (let i = 0; i < n; i++) {
      const wr = Math.max(0, Math.min(100, winrates[i]));
      const x = left + i * (barW + gap);

      const barH = (wr / 100) * innerH;
      const y = top + (innerH - barH);

      ctx.fillStyle = "rgba(246,198,91,.85)";
      ctx.fillRect(x, y, barW, barH);

      ctx.fillStyle = "rgba(255,255,255,.75)";
      ctx.font = "10px system-ui";
      ctx.textAlign = "center";
      ctx.fillText(`${wr.toFixed(0)}%`, x + barW / 2, y - 4);

      ctx.fillStyle = "rgba(255,255,255,.65)";
      ctx.save();
      ctx.translate(x + barW / 2, h - 12);
      ctx.rotate(-0.35);
      ctx.textAlign = "center";
      ctx.fillText(labels[i], 0, 0);
      ctx.restore();
    }
  }

  function buildNetRByDate(trades) {
    const map = new Map();
    for (const t of trades) {
      const d = t.date || "";
      const r = Number.isFinite(t.r) ? t.r : 0;
      map.set(d, (map.get(d) || 0) + r);
    }
    const sortedDates = [...map.keys()].sort((a,b)=>a.localeCompare(b));
    const last = sortedDates.slice(Math.max(0, sortedDates.length - 12));
    return {
      labels: last.map(d => d.slice(5)),
      values: last.map(d => map.get(d) || 0)
    };
  }

  function buildWinrateBySymbol(trades) {
    const closed = trades.filter(t => t.result === "tp" || t.result === "sl");
    const map = new Map();
    for (const t of closed) {
      const sym = (t.symbol || "").toUpperCase();
      if (!sym) continue;
      if (!map.has(sym)) map.set(sym, { w:0, l:0 });
      const obj = map.get(sym);
      if (t.result === "tp") obj.w++;
      else obj.l++;
    }
    const rows = [...map.entries()].map(([sym, v]) => {
      const total = v.w + v.l;
      const wr = total ? (v.w / total) * 100 : 0;
      return { sym, wr, total };
    });

    rows.sort((a,b)=> b.total - a.total);
    const top = rows.slice(0, 8);

    return {
      labels: top.map(x => x.sym.length > 8 ? x.sym.slice(0,8) + "…" : x.sym),
      winrates: top.map(x => x.wr)
    };
  }

  function render() {
    let trades = normalizeTrades(loadTrades());
    saveTrades(trades);

    const filtered = applyFilters(trades);

    const s = computeStats(trades);
    stTotal.textContent = String(s.total);
    stWinrate.textContent = Number.isFinite(s.winrate) ? `${s.winrate.toFixed(1)}%` : "—";
    stNetR.textContent = Number.isFinite(s.netR) ? s.netR.toFixed(2) : "—";
    stAvgRR.textContent = Number.isFinite(s.avgRR) ? s.avgRR.toFixed(2) : "—";

    countLabel.textContent = `Showing ${filtered.length} / ${trades.length}`;

    tbody.innerHTML = filtered.map(t => {
      const sideBadge = t.side === "buy" ? badge("BUY", "buy") : badge("SELL", "sell");
      const resBadge =
        t.result === "tp" ? badge("TP", "buy") :
        t.result === "sl" ? badge("SL", "sell") :
        badge("OPEN", "open");

      const tagBadge = t.tag === "gold" ? badge("GOLD", "gold") : badge("CRYPTO", "crypto");

      const rrTxt = Number.isFinite(t.rr) ? t.rr.toFixed(2) : "—";
      const rTxt = Number.isFinite(t.r) ? t.r.toFixed(2) : "—";

      return `
        <tr>
          <td>${escapeHtml(t.date)}</td>
          <td>${escapeHtml(t.symbol)}</td>
          <td>${tagBadge}</td>
          <td>${sideBadge}</td>
          <td>${escapeHtml(t.entry)}</td>
          <td>${escapeHtml(t.sl)}</td>
          <td>${escapeHtml(t.tp)}</td>
          <td>${rrTxt}</td>
          <td>${resBadge}</td>
          <td>${rTxt}</td>
          <td>${escapeHtml(t.notes || "")}</td>
          <td>
            <button class="smallbtn" data-edit="${t.id}">Edit</button>
            <button class="smallbtn danger" data-del="${t.id}">Delete</button>
          </td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-del");
        const all = loadTrades();
        const next = all.filter(x => x.id !== id);
        saveTrades(next);
        if (editingId === id) resetForm();
        render();
      });
    });

    tbody.querySelectorAll("[data-edit]").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-edit");
        const all = normalizeTrades(loadTrades());
        const t = all.find(x => x.id === id);
        if (!t) return;

        setEditMode(id);
        loadTradeIntoForm(t);
        window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });

    if (ctxNetR) {
      const net = buildNetRByDate(trades);
      drawBarChart(ctxNetR, cNetR.width, cNetR.height, net.labels, net.values);
    }
    if (ctxWinrate) {
      const wr = buildWinrateBySymbol(trades);
      drawWinrateChart(ctxWinrate, cWinrate.width, cWinrate.height, wr.labels, wr.winrates);
    }
  }

  function toCSV(trades) {
    const header = ["date","symbol","tag","side","entry","sl","tp","rr","result","r","notes"];
    const lines = [header.join(",")];

    for (const t of trades) {
      const row = [
        t.date, t.symbol, t.tag, t.side, t.entry, t.sl, t.tp,
        Number.isFinite(t.rr) ? t.rr : "",
        t.result,
        Number.isFinite(t.r) ? t.r : "",
        (t.notes || "").replaceAll("\n"," ").replaceAll("\r"," ")
      ].map(v => `"${String(v ?? "").replaceAll('"','""')}"`);
      lines.push(row.join(","));
    }
    return lines.join("\n");
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  dateEl.value = todayISO();
  symbolEl.value = "XAUUSDT";

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const date = (dateEl.value || "").trim();
    const symbol = (symbolEl.value || "").trim();
    const side = sideEl.value;
    const result = resultEl.value;

    const entry = safeNum(entryEl.value);
    const sl = safeNum(slEl.value);
    const tp = safeNum(tpEl.value);

    const notes = (notesEl.value || "").trim();

    const rrVal = rr(entry, sl, tp);
    const rVal = rResult(result, rrVal);

    const ok =
      date &&
      symbol &&
      Number.isFinite(entry) &&
      Number.isFinite(sl) &&
      Number.isFinite(tp) &&
      validSetup(side, entry, sl, tp) &&
      Number.isFinite(rrVal);

    if (!ok) {
      alert("Kontrollo inputet: BUY duhet SL < Entry < TP, SELL duhet TP < Entry < SL.");
      return;
    }

    const tag = autoTag(symbol);

    const trade = {
      id: editingId || uid(),
      date,
      symbol: symbol.toUpperCase(),
      tag,
      side,
      result,
      entry: entry.toFixed(2),
      sl: sl.toFixed(2),
      tp: tp.toFixed(2),
      rr: Number(rrVal.toFixed(6)),
      r: Number(rVal.toFixed(6)),
      notes
    };

    const all = normalizeTrades(loadTrades());

    if (editingId) {
      const idx = all.findIndex(t => t.id === editingId);
      if (idx >= 0) all[idx] = trade;
      setEditMode(null);
    } else {
      all.push(trade);
    }

    saveTrades(all);

    entryEl.value = "";
    slEl.value = "";
    tpEl.value = "";
    notesEl.value = "";
    resultEl.value = "open";

    render();
  });

  resetBtn.addEventListener("click", resetForm);
  cancelEditBtn.addEventListener("click", resetForm);

  [fSymbolEl, fSideEl, fResultEl, fTagEl, fSortEl].forEach(el => {
    el.addEventListener("input", render);
    el.addEventListener("change", render);
  });

  clearBtn.addEventListener("click", () => {
    const ok = confirm("A je i sigurt që do me i fshi krejt trades?");
    if (!ok) return;
    saveTrades([]);
    resetForm();
    render();
  });

  exportBtn.addEventListener("click", () => {
    const trades = normalizeTrades(loadTrades());
    const csv = toCSV(trades);
    downloadText("trade-journal.csv", csv);
  });

  render();
})();

// ========== LANDING PAGE ==========
(function() {
  const $ = (id) => document.getElementById(id);

  document.getElementById("year").textContent = new Date().getFullYear();

  const menuBtn = document.getElementById("menuBtn");
  const navLinks = document.getElementById("navLinks");

  menuBtn?.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("open");
    menuBtn.setAttribute("aria-expanded", String(isOpen));
  });

  navLinks?.querySelectorAll("a.navlink, a.btn").forEach(a => {
    a.addEventListener("click", () => {
      if (window.innerWidth < 900) {
        navLinks.classList.remove("open");
        menuBtn?.setAttribute("aria-expanded", "false");
      }
    });
  });

  let yearly = false;
  const billingSwitch = document.getElementById("billingSwitch");
  const perTextEls = document.querySelectorAll(".perText");
  const priceNums = document.querySelectorAll(".num");

  function setBillingUI() {
    billingSwitch.classList.toggle("on", yearly);

    priceNums.forEach(el => {
      const m = el.getAttribute("data-month");
      const y = el.getAttribute("data-year");
      el.textContent = yearly ? y : m;
    });

    perTextEls.forEach(el => el.textContent = yearly ? "yr" : "mo");
  }

  billingSwitch?.addEventListener("click", () => {
    yearly = !yearly;
    setBillingUI();
  });
  setBillingUI();

  document.querySelectorAll(".faq-q").forEach(btn => {
    btn.addEventListener("click", () => {
      const expanded = btn.getAttribute("aria-expanded") === "true";
      document.querySelectorAll(".faq-q").forEach(b => b.setAttribute("aria-expanded","false"));
      btn.setAttribute("aria-expanded", expanded ? "false" : "true");
    });
  });

  document.querySelectorAll("[data-cta]").forEach(btn => {
    btn.addEventListener("click", () => {
      const plan = btn.getAttribute("data-cta");
      alert(`Demo checkout: ${plan} (${yearly ? "Yearly" : "Monthly"})`);
    });
  });

  document.getElementById("copyCheckout")?.addEventListener("click", async () => {
    const link = "https://your-checkout-link.com";
    try {
      await navigator.clipboard.writeText(link);
      alert("Checkout link copied ✅");
    } catch {
      alert("S'u kopjua (browser). Copy manual: " + link);
    }
  });

  const canvas = document.getElementById("chart");
  const ctx = canvas?.getContext("2d");

  function drawChart() {
    if (!ctx || !canvas) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0,0,w,h);
    ctx.fillStyle = "rgba(255,255,255,.02)";
    ctx.fillRect(0,0,w,h);

    ctx.strokeStyle = "rgba(255,255,255,.14)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(40, 14);
    ctx.lineTo(40, h-30);
    ctx.lineTo(w-14, h-30);
    ctx.stroke();

    const data = [0.2, 1.2, -0.6, 1.8, 0.9, -0.3, 1.4, 2.1, -0.4, 1.0, 1.6, 2.3];
    const maxAbs = Math.max(1, ...data.map(v => Math.abs(v)));

    const left = 50, top = 18, right = 16, bottom = 36;
    const innerW = w - left - right;
    const innerH = h - top - bottom;

    const zeroY = top + innerH/2;
    ctx.strokeStyle = "rgba(255,255,255,.10)";
    ctx.beginPath();
    ctx.moveTo(left, zeroY);
    ctx.lineTo(left + innerW, zeroY);
    ctx.stroke();

    const n = data.length;
    const gap = 8;
    const barW = (innerW - gap*(n-1)) / n;

    for (let i=0;i<n;i++){
      const v = data[i];
      const x = left + i*(barW+gap);
      const scaled = (Math.abs(v)/maxAbs) * (innerH/2 - 6);
      const y = v >= 0 ? (zeroY - scaled) : zeroY;

      ctx.fillStyle = v >= 0 ? "rgba(66,211,146,.85)" : "rgba(255,92,122,.85)";
      ctx.fillRect(x, y, barW, scaled);
    }

    ctx.fillStyle = "rgba(255,255,255,.70)";
    ctx.font = "12px system-ui";
    ctx.fillText("Demo Net R (placeholder)", 50, 14);
  }

  drawChart();
  window.addEventListener("resize", drawChart);
})();