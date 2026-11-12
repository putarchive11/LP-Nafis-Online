(function () {
  "use strict";
  var C = window.STORE_CONFIG || {};
  var $ = function (s) { return document.querySelector(s); };
  var products = [];
  var cart = loadCart();
  var activeCat = "Semua";
  var query = "";
  var lastWaUrl = "";

  /* ---------- Utilitas ---------- */
  var FL = (C.promos && C.promos.flashSale) || null;
  function flashLive() {
    if (!FL || !FL.active || !FL.items) return false;
    var now = Date.now(), s = Date.parse(FL.start), e = Date.parse(FL.end);
    return (isNaN(s) || now >= s) && !isNaN(e) && now < e;
  }
  function applyFlash(p) {
    var fp = flashLive() && Number(FL.items[p.kode]);
    if (fp && fp > 0 && fp < p.harga) { p.flash = true; p.harga_coret = p.harga; p.harga = fp; }
    else if (fp && fp > 0 && fp === p.harga && p.harga_coret > fp) { p.flash = true; }
    return p;
  }
  function rupiah(n) { return "Rp " + Number(n || 0).toLocaleString("id-ID"); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function initials(name) {
    return String(name).split(/\s+/).slice(0, 2).map(function (w) { return w.charAt(0); }).join("").toUpperCase();
  }
  function toast(msg) {
    var t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("show"); }, 1800);
  }
  function loadCart() {
    try { return JSON.parse(localStorage.getItem("hs_cart") || "{}"); } catch (e) { return {}; }
  }
  function saveCart() {
    try { localStorage.setItem("hs_cart", JSON.stringify(cart)); } catch (e) {}
  }
  /* ---------- Meta Pixel: pelacakan event ----------
     Event standar: ViewContent, AddToCart, InitiateCheckout, Contact, Lead.
     Purchase TIDAK dikirim dari website: pembelian baru sah setelah pembeli
     membalas "SETUJU" dan membayar COD. Purchase diunggah belakangan dari
     data pesanan (Events Manager > Offline / unggah CSV). */
  function eventId(prefix) {
    return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }
  function track(event, data, custom) {
    if (!window.fbq) return;
    try {
      window.fbq(custom ? "trackCustom" : "track", event, data || {}, { eventID: eventId(event) });
    } catch (e) {}
  }
  function cartContents() {
    return Object.keys(cart).map(function (k) {
      var p = findP(k); return p ? { id: p.kode, quantity: cart[k], item_price: p.harga } : null;
    }).filter(Boolean);
  }

  /* ---------- Sumber kunjungan (UTM dari iklan) ----------
     Disimpan per sesi agar admin tahu pesanan datang dari iklan mana
     (untuk menghitung biaya per pesanan & ROAS per iklan). */
  var SRC_KEY = "nf_src";
  function captureSource() {
    try {
      var q = new URLSearchParams(location.search), src = {};
      ["utm_source", "utm_campaign", "utm_content"].forEach(function (k) { if (q.get(k)) src[k] = q.get(k).slice(0, 60); });
      if (q.get("fbclid")) src.fb = 1;
      if (Object.keys(src).length) sessionStorage.setItem(SRC_KEY, JSON.stringify(src));
    } catch (e) {}
  }
  function sourceLabel() {
    try {
      var s = JSON.parse(sessionStorage.getItem(SRC_KEY) || "null"); if (!s) return "";
      var parts = [s.utm_source || (s.fb ? "facebook" : ""), s.utm_campaign, s.utm_content].filter(Boolean);
      return parts.join(" / ");
    } catch (e) { return ""; }
  }

  /* ---------- Parser CSV sederhana (mendukung tanda kutip) ---------- */
  function parseCSV(text) {
    var rows = [], row = [], field = "", inQ = false;
    text = text.replace(/^﻿/, "");
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (inQ) {
        if (ch === '"') {
          if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false;
        } else field += ch;
      } else if (ch === '"') inQ = true;
      else if (ch === ",") { row.push(field); field = ""; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(field); rows.push(row); row = []; field = "";
      } else field += ch;
    }
    if (field || row.length) { row.push(field); rows.push(row); }
    var head = rows.shift().map(function (h) { return h.trim().toLowerCase(); });
    return rows.filter(function (r) { return r.join("").trim(); }).map(function (r) {
      var o = {}; head.forEach(function (h, i) { o[h] = (r[i] || "").trim(); }); return o;
    });
  }

  /* ---------- Muat produk ---------- */
  function loadProducts() {
    fetch(C.productsCsvUrl || "data/products.csv", { cache: "no-store" })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (txt) {
        products = parseCSV(txt)
          .filter(function (p) { return p.kode && p.nama && String(p.aktif || "ya").toLowerCase() !== "tidak"; })
          .map(function (p) {
            p.harga = Number(String(p.harga).replace(/[^\d]/g, "")) || 0;
            p.harga_coret = Number(String(p.harga_coret || "").replace(/[^\d]/g, "")) || 0;
            if (p.foto && !/^(https?:)?\/\//.test(p.foto) && p.foto.indexOf("/") < 0) p.foto = "assets/img/produk/" + p.foto;
            p.kategori = p.kategori || "Lainnya";
            return applyFlash(p);
          });
        // bersihkan keranjang dari produk yang sudah tidak ada
        Object.keys(cart).forEach(function (k) { if (!findP(k)) delete cart[k]; });
        saveCart();
        renderCategories(); renderCatTiles(); renderFlash(); renderFeatured(); renderProducts(); renderCart();
      })
      .catch(function () {
        $("#productGrid").innerHTML = '<p class="muted center">Produk gagal dimuat. Pastikan situs dibuka lewat hosting (bukan klik file langsung) dan link CSV benar.</p>';
      });
  }
  function findP(kode) {
    for (var i = 0; i < products.length; i++) if (products[i].kode === kode) return products[i];
    return null;
  }

  /* ---------- Render katalog ---------- */
  function renderCategories() {
    var cats = ["Semua"];
    products.forEach(function (p) { if (cats.indexOf(p.kategori) < 0) cats.push(p.kategori); });
    $("#categories").innerHTML = cats.map(function (c) {
      return '<button class="chip' + (c === activeCat ? " active" : "") + '" data-cat="' + esc(c) + '">' + esc(c) + "</button>";
    }).join("");
  }
  /* Ubin kategori di bawah banner (foto contoh per kategori, urut jumlah produk) */
  var CAT_PICK = { "Buku": "HNF-15", "Madu": "HNF-01", "Kapsul Herbal": "HNF-23", "Minuman Herbal": "HNF-12", "Minyak Herbal": "HNF-19", "Kurma": "HNF-22", "Alat Bekam": "HNF-25" };
  function renderCatTiles() {
    var el = $("#catTiles"); if (!el) return;
    var count = {}, img = {};
    products.forEach(function (p) {
      count[p.kategori] = (count[p.kategori] || 0) + 1;
      if (p.foto && (!img[p.kategori] || CAT_PICK[p.kategori] === p.kode)) img[p.kategori] = p.foto;
    });
    var cats = Object.keys(count).sort(function (a, b) { return count[b] - count[a]; }).slice(0, 8);
    el.innerHTML = cats.map(function (c) {
      return '<button type="button" class="cat-tile" data-cat="' + esc(c) + '">' +
        '<span class="cat-img">' + (img[c] ? '<img src="' + esc(img[c]) + '" alt="" loading="lazy" onerror="this.remove()">' : "") + "</span>" +
        "<b>" + esc(c) + "</b><small>" + count[c] + " produk</small></button>";
    }).join("");
  }
  function imgHTML(p) {
    return p.foto
      ? '<img src="' + esc(p.foto) + '" alt="' + esc(p.nama) + '" loading="lazy" onerror="this.remove()">'
      : "";
  }
  /* Tombol di kartu: "+ Keranjang", atau pengatur jumlah jika sudah di keranjang */
  function actionHTML(kode) {
    var pr = findP(kode);
    if (pr && !pr.harga) return '<a class="btn btn-wa card-add" href="' + askWaUrl(pr) + '" target="_blank" rel="noopener">Tanya Harga</a>';
    var n = cart[kode] || 0;
    if (!n) return '<button class="btn btn-primary card-add" data-add="' + esc(kode) + '">+ Keranjang</button>';
    return '<div class="card-qty"><button data-dec="' + esc(kode) + '" aria-label="Kurangi">−</button>' +
      "<span><b>" + n + "</b><small> di keranjang</small></span>" +
      '<button data-inc="' + esc(kode) + '" aria-label="Tambah">+</button></div>';
  }
  function askWaUrl(p) {
    return "https://wa.me/" + C.waNumber + "?text=" + encodeURIComponent("Assalamu'alaikum, saya ingin tanya harga " + p.nama + " [" + p.kode + "]");
  }
  function priceHTML(p) {
    if (!p.harga) return '<div class="card-price price-ask">Harga via WA</div>';
    var hasDisc = p.harga_coret > p.harga && p.harga > 0;
    if (!hasDisc) return '<div class="card-price">' + rupiah(p.harga) + "</div>";
    var off = Math.round((1 - p.harga / p.harga_coret) * 100);
    return '<div class="card-price has-disc"><span class="price-now">' + rupiah(p.harga) + "</span>" +
      '<span class="price-was"><s>' + rupiah(p.harga_coret) + '</s><span class="price-off">-' + off + "%</span></span></div>";
  }
  function cardHTML(p, extraClass) {
    return '<article class="card' + (extraClass ? " " + extraClass : "") + '">' +
      '<div class="card-img" data-view="' + esc(p.kode) + '" role="button" tabindex="0" aria-label="Lihat detail ' + esc(p.nama) + '">' +
      '<span class="ph">' + esc(initials(p.nama)) + "</span>" + imgHTML(p) +
      (p.flash ? '<span class="flash-flag">' + esc(FL.title || "Flash Sale") + "</span>" : (extraClass ? '<span class="card-flag">Terlaris</span>' : "")) + ZOOM_ICON + "</div>" +
      '<div class="card-body">' +
      '<span class="card-cat">' + esc(p.kategori) + "</span>" +
      '<h3 class="card-name">' + esc(p.nama) + "</h3>" +
      (p.deskripsi ? '<p class="card-desc">' + esc(p.deskripsi) + "</p>" : "") +
      priceHTML(p) +
      '<div class="card-action" data-act="' + esc(p.kode) + '">' + actionHTML(p.kode) + "</div>" +
      "</div></article>";
  }
  var ZOOM_ICON = '<span class="card-zoom" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5M11 8v6M8 11h6"/></svg></span>';

  /* ---------- Pop-up detail produk ---------- */
  var pmLast = null, pmMoved = false, pmDown = null;
  function openProduct(kode, trigger) {
    var p = findP(kode); if (!p) return;
    pmLast = trigger || document.activeElement;
    var media = $("#pmMedia"), img = $("#pmImg");
    media.classList.remove("zoomed"); img.style.transformOrigin = "50% 50%";
    $("#pmPh").textContent = initials(p.nama);
    if (p.foto) { img.src = p.foto; img.alt = p.nama; img.hidden = false; $("#pmHint").hidden = false; }
    else { img.removeAttribute("src"); img.hidden = true; $("#pmHint").hidden = true; }
    $("#pmCat").textContent = p.kategori;
    $("#pmName").textContent = p.nama;
    $("#pmPrice").innerHTML = priceHTML(p);
    $("#pmDesc").textContent = p.deskripsi || "";
    $("#pmDesc").hidden = !p.deskripsi;
    var act = $("#pmAction"); act.setAttribute("data-act", p.kode); act.innerHTML = actionHTML(p.kode);
    $("#pmAsk").href = askWaUrl(p).replace("tanya harga", "tanya tentang");
    $("#pm").classList.add("open"); $("#pm").setAttribute("aria-hidden", "false");
    document.body.classList.add("pm-lock");
    setTimeout(function () { $("#pmClose").focus(); }, 30);
    track("ViewContent", { content_ids: [p.kode], content_name: p.nama, content_type: "product", value: p.harga, currency: "IDR" });
  }
  function closeProduct() {
    var m = $("#pm"); if (!m.classList.contains("open")) return false;
    m.classList.remove("open"); m.setAttribute("aria-hidden", "true");
    $("#pmAction").removeAttribute("data-act");
    document.body.classList.remove("pm-lock");
    if (pmLast && pmLast.focus) { try { pmLast.focus({ preventScroll: true }); } catch (e) {} }
    return true;
  }
  function pmOrigin(e) {
    var r = $("#pmMedia").getBoundingClientRect();
    var x = Math.min(100, Math.max(0, (e.clientX - r.left) / r.width * 100));
    var y = Math.min(100, Math.max(0, (e.clientY - r.top) / r.height * 100));
    $("#pmImg").style.transformOrigin = x + "% " + y + "%";
  }
  function initProductModal() {
    var media = $("#pmMedia");
    media.addEventListener("pointerdown", function (e) { pmDown = { x: e.clientX, y: e.clientY }; pmMoved = false; });
    media.addEventListener("pointermove", function (e) {
      if (pmDown && Math.abs(e.clientX - pmDown.x) + Math.abs(e.clientY - pmDown.y) > 8) pmMoved = true;
      if (media.classList.contains("zoomed") && (e.pointerType === "mouse" || pmDown)) pmOrigin(e);
    });
    media.addEventListener("pointerup", function () { pmDown = null; });
    media.addEventListener("click", function (e) {
      if ($("#pmImg").hidden) return;
      if (pmMoved && media.classList.contains("zoomed")) { pmMoved = false; return; }
      pmOrigin(e); media.classList.toggle("zoomed");
    });
    document.querySelectorAll("[data-pm-close]").forEach(function (el) { el.addEventListener("click", closeProduct); });
    // jaga fokus tetap di dalam pop-up
    $("#pm").addEventListener("keydown", function (e) {
      if (e.key !== "Tab") return;
      var f = Array.prototype.filter.call($("#pm").querySelectorAll("button, a[href]"), function (el) { return el.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  function updateActions() {
    document.querySelectorAll("[data-act]").forEach(function (el) {
      el.innerHTML = actionHTML(el.getAttribute("data-act"));
    });
  }

  /* ---------- Produk unggulan (carousel) ---------- */
  function renderFlash() {
    var sec = $("#flashSale"); if (!sec) return;
    var list = products.filter(function (p) { return p.flash; });
    if (!list.length) { sec.classList.add("hidden"); return; }
    $("#flashGrid").innerHTML = list.map(function (p) { return cardHTML(p); }).join("");
    var end = Date.parse(FL.end), el = $("#fsCountdown");
    var bulan = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
    var wib = new Date(end + 7 * 3600 * 1000);
    $("#fsUntil").textContent = "s.d. " + wib.getUTCDate() + " " + bulan[wib.getUTCMonth()] + " " + wib.getUTCFullYear() + " pukul " + ("0" + wib.getUTCHours()).slice(-2) + "." + ("0" + wib.getUTCMinutes()).slice(-2) + " WIB";
    var pad = function (n) { return ("0" + n).slice(-2); };
    var tick = function () {
      var ms = end - Date.now();
      if (ms <= 0) { clearInterval(renderFlash._t); location.reload(); return; }
      var s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec2 = s % 60;
      el.innerHTML = '<span><b>' + d + '</b>hari</span><span><b>' + pad(h) + '</b>jam</span><span><b>' + pad(m) + '</b>menit</span><span><b>' + pad(sec2) + '</b>detik</span>';
    };
    tick(); clearInterval(renderFlash._t); renderFlash._t = setInterval(tick, 1000);
    sec.classList.remove("hidden");
  }
  function isFeatured(p) { return /^(ya|y|1|true)$/i.test(String(p.unggulan || "").trim()); }
  function renderFeatured() {
    var wrap = $("#featured"); if (!wrap) return;
    var list = products.filter(isFeatured);
    if (!list.length) { wrap.classList.add("hidden"); return; }
    wrap.classList.remove("hidden");
    var track = $("#featuredTrack");
    track.innerHTML = list.map(function (p) { return cardHTML(p, "card-feat"); }).join("");
    track.scrollLeft = 0;
    updateFeaturedNav();
  }
  function featuredPages() {
    var t = $("#featuredTrack");
    return { page: Math.round(t.scrollLeft / t.clientWidth), total: Math.max(1, Math.ceil((t.scrollWidth - 4) / t.clientWidth)) };
  }
  function updateFeaturedNav() {
    var t = $("#featuredTrack"); if (!t) return;
    var s = featuredPages();
    var dots = "";
    for (var i = 0; i < s.total; i++) dots += '<button class="' + (i === s.page ? "on" : "") + '" data-fpage="' + i + '" aria-label="Halaman ' + (i + 1) + '"></button>';
    $("#featuredDots").innerHTML = s.total > 1 ? dots : "";
    $("#featPrev").disabled = t.scrollLeft <= 2;
    $("#featNext").disabled = t.scrollLeft + t.clientWidth >= t.scrollWidth - 2;
  }
  function scrollFeatured(dir) {
    var t = $("#featuredTrack");
    t.scrollBy({ left: dir * t.clientWidth, behavior: "smooth" });
  }

  /* ---------- Grid semua produk ---------- */
  var PAGE_SIZE = 12, shown = PAGE_SIZE;
  function renderProducts() {
    var q = query.toLowerCase();
    var list = products.filter(function (p) {
      return (activeCat === "Semua" || p.kategori === activeCat) &&
        (!q || (p.nama + " " + p.deskripsi + " " + p.kode).toLowerCase().indexOf(q) >= 0);
    });
    var more = $("#loadWrap");
    $("#resultInfo").textContent = list.length ? list.length + " produk" + (activeCat !== "Semua" ? " di " + activeCat : "") : "";
    if (!list.length) {
      $("#productGrid").innerHTML = '<p class="muted center grid-empty">Produk tidak ditemukan.</p>';
      more.classList.add("hidden");
      return;
    }
    $("#productGrid").innerHTML = list.slice(0, shown).map(function (p) { return cardHTML(p); }).join("");
    var rest = list.length - shown;
    more.classList.toggle("hidden", rest <= 0);
    $("#loadInfo").textContent = "Menampilkan " + Math.min(shown, list.length) + " dari " + list.length + " produk";
    $("#loadMore").textContent = "Muat " + Math.min(PAGE_SIZE, rest) + " lagi";
    $("#showAll").textContent = "Tampilkan semua (" + list.length + ")";
  }

  /* ---------- Keranjang ---------- */
  function cartCount() { return Object.keys(cart).reduce(function (s, k) { return s + cart[k]; }, 0); }
  function cartTotal() {
    return Object.keys(cart).reduce(function (s, k) { var p = findP(k); return s + (p ? p.harga * cart[k] : 0); }, 0);
  }

  /* ---------- Promo ---------- */
  var PR = C.promos || {};
  var FS = PR.freeShipping && PR.freeShipping.active ? PR.freeShipping : null;
  var DC = PR.discount && PR.discount.active ? PR.discount : null;
  function shortRp(n) { return n >= 1000 ? "Rp" + (n / 1000).toLocaleString("id-ID") + "rb" : rupiah(n); }
  /* ---------- Kirim instan (peta + jarak) ---------- */
  var ID = C.instantDelivery && C.instantDelivery.active && C.instantDelivery.origin ? C.instantDelivery : null;
  var inst = { map: null, marker: null, pos: null, km: null, loading: false };
  function shipMode() { var f = $("#stepCheckout"); var r = f && f.querySelector('input[name="kirim"]:checked'); return ID && r ? r.value : "jne"; }
  function haversineKm(a, b) {
    var R = 6371, rad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }
  function loadLeaflet(cb) {
    if (window.L) return cb();
    if (inst.loading) return; inst.loading = true;
    var css = document.createElement("link"); css.rel = "stylesheet";
    css.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"; document.head.appendChild(css);
    var s = document.createElement("script"); s.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
    s.onload = function () { inst.loading = false; cb(); };
    s.onerror = function () { inst.loading = false; $("#instantStatus").textContent = "Peta gagal dimuat. Tulis patokan lokasi di kolom catatan, admin akan membantu."; };
    document.head.appendChild(s);
  }
  function setInstantPos(lat, lng, fly) {
    inst.pos = { lat: lat, lng: lng };
    inst.km = haversineKm(ID.origin, inst.pos);
    var icon = L.divIcon({ className: "instant-pin", html: "<span></span>", iconSize: [28, 28], iconAnchor: [14, 28] });
    if (!inst.marker) {
      inst.marker = L.marker([lat, lng], { draggable: true, icon: icon, keyboard: true, title: "Lokasi pengiriman" }).addTo(inst.map);
      inst.marker.on("dragend", function () { var p = inst.marker.getLatLng(); setInstantPos(p.lat, p.lng, false); });
    } else inst.marker.setLatLng([lat, lng]);
    if (fly) inst.map.setView([lat, lng], Math.max(inst.map.getZoom(), 16));
    updateInstantStatus();
  }
  function updateInstantStatus() {
    var box = $("#instantStatus"); if (!box) return;
    box.classList.remove("ok", "bad");
    if (!inst.pos) { box.textContent = "Belum ada titik lokasi."; return; }
    var km = inst.km.toLocaleString("id-ID", { maximumFractionDigits: 1 });
    if (inst.km > ID.maxKm) { box.classList.add("bad"); box.textContent = "Jarak ±" + km + " km dari toko, di luar jangkauan kirim instan (maks. " + ID.maxKm + " km). Silakan pilih JNE."; }
    else { box.classList.add("ok"); box.textContent = "✔ Titik tersimpan · ±" + km + " km dari toko. Ongkir instan dikonfirmasi admin."; }
  }
  function initInstantMap() {
    loadLeaflet(function () {
      if (inst.map) { inst.map.invalidateSize(); return; }
      inst.map = L.map("instantMap", { zoomControl: true, attributionControl: true }).setView([ID.origin.lat, ID.origin.lng], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap" }).addTo(inst.map);
      if (ID.showOrigin) L.circleMarker([ID.origin.lat, ID.origin.lng], { radius: 7, color: "#E8602A", fillOpacity: 0.9 }).addTo(inst.map).bindTooltip("Toko Nafis Online");
      inst.map.on("click", function (e) { setInstantPos(e.latlng.lat, e.latlng.lng, false); });
      setTimeout(function () { inst.map.invalidateSize(); }, 200);
    });
  }
  function onShipModeChange() {
    var instant = shipMode() === "instan";
    $("#instantBox").classList.toggle("hidden", !instant);
    var note = $("#checkoutNote");
    if (instant) {
      note.innerHTML = "Pengiriman <b>" + esc(ID.title) + "</b> (" + esc(ID.couriers) + "). Admin akan membalas total barang + ongkir instan. Pembayaran: <b>" + esc(ID.payment) + "</b>.";
      $("#shipStatus").classList.add("hidden");
      initInstantMap();
    } else {
      note.innerHTML = "Pembayaran <b>COD</b>. Admin akan membalas rincian total (barang + ongkir JNE). Pesanan diproses setelah Anda membalas <b>SETUJU</b>.";
      updateShipStatus();
    }
  }
  function initInstant() {
    if (!ID) return;
    $("#shipMethod").classList.remove("hidden");
    $("#instantTitle").textContent = ID.title;
    $("#instantSub").textContent = ID.couriers + " · langsung diantar driver";
    $("#stepCheckout").querySelectorAll('input[name="kirim"]').forEach(function (r) { r.addEventListener("change", onShipModeChange); });
    $("#useMyLoc").addEventListener("click", function () {
      var box = $("#instantStatus");
      if (!navigator.geolocation) { box.textContent = "Perangkat tidak mendukung lokasi. Ketuk peta untuk menandai."; return; }
      box.textContent = "Mencari lokasi Anda…";
      navigator.geolocation.getCurrentPosition(function (p) {
        initInstantMap();
        var go = function () { if (!inst.map) return setTimeout(go, 150); setInstantPos(p.coords.latitude, p.coords.longitude, true); };
        go();
      }, function () { box.textContent = "Izin lokasi ditolak. Ketuk peta untuk menandai lokasi."; }, { enableHighAccuracy: true, timeout: 10000 });
    });
  }
  function isFreeArea(text) {
    if (!FS) return false;
    var t = String(text || "").toLowerCase();
    return (FS.areas || []).some(function (a) { return t.indexOf(a) >= 0; });
  }
  // Hitung semua angka promo dari subtotal (sebelum diskon) dan alamat
  function calc(areaText) {
    var sub = cartTotal();
    var disc = DC && sub >= DC.minPurchase ? Math.round(sub * DC.percent / 100) : 0;
    if (disc && DC.maxDiscount > 0) disc = Math.min(disc, DC.maxDiscount);
    var shipEligible = !!FS && sub >= FS.minPurchase;
    return {
      subtotal: sub,
      discount: disc,
      total: sub - disc,
      shipEligible: shipEligible,
      freeShip: shipEligible && areaText !== undefined && shipMode() !== "instan" && isFreeArea(areaText)
    };
  }
  function renderPromos() {
    var cards = [];
    if (FS) cards.push({
      icon: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 3h15v13H1z"/><path d="M16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
      title: FS.title,
      desc: "Untuk alamat Jakarta, Bogor, Depok, Tangerang, dan Bekasi.",
      term: "Min. belanja " + rupiah(FS.minPurchase)
    });
    if (DC) cards.push({
      icon: '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>',
      title: DC.title,
      desc: "Potongan " + DC.percent + "% dari total harga barang" + (DC.maxDiscount > 0 ? ", maksimal " + rupiah(DC.maxDiscount) : "") + ". Otomatis dihitung di keranjang.",
      term: "Min. belanja " + rupiah(DC.minPurchase) + (DC.maxDiscount > 0 ? " · Maks. potongan " + rupiah(DC.maxDiscount) : "")
    });
    var sec = $("#promo");
    if (!cards.length) { if (sec) sec.classList.add("hidden"); return; }
    $("#promoGrid").innerHTML = cards.map(function (c, i) {
      return '<div class="promo-card' + (i === 1 ? " alt" : "") + '"><div class="promo-icon">' + c.icon + "</div>" +
        '<div class="promo-text"><h3>' + esc(c.title) + "</h3><p>" + esc(c.desc) + "</p>" +
        '<span class="promo-term">' + esc(c.term) + "</span></div></div>";
    }).join("");
    var bar = $("#promoBar");
    if (bar) {
      // Teks berjalan: isi diulang supaya selalu memenuhi layar, lalu digandakan agar putarannya mulus
      var items = cards.map(function (c) {
        return "<span>" + esc(c.title) + " · " + esc(c.term.replace("Min. belanja ", "min. ")) + "</span>";
      }).concat(["<span>Bayar di tempat (COD) · Dikirim JNE</span>"]);
      if (flashLive()) items.unshift("<span>" + esc(FL.title || "Flash Sale") + " · harga spesial sampai " + (function () { var w = new Date(Date.parse(FL.end) + 7 * 3600 * 1000); return w.getUTCDate() + " " + ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"][w.getUTCMonth()]; })() + "</span>");
      var group = "";
      for (var r = 0; r < 3; r++) group += items.map(function (t) { return t + '<i aria-hidden="true">•</i>'; }).join("");
      bar.innerHTML = '<p class="sr-only">' + cards.map(function (c) { return esc(c.title) + ", " + esc(c.term); }).join(". ") + ".</p>" +
        '<div class="promo-track" aria-hidden="true"><div class="promo-group">' + group + '</div><div class="promo-group">' + group + "</div></div>";
      bar.classList.remove("hidden");
      document.body.classList.add("has-promo-bar");
    }
  }
  function promoHint(c) {
    if (!c.subtotal) return "";
    if (FS && c.subtotal < FS.minPurchase) return "Tambah " + rupiah(FS.minPurchase - c.subtotal) + " lagi untuk gratis ongkir Jabodetabek.";
    if (DC && c.subtotal < DC.minPurchase) return "Tambah " + rupiah(DC.minPurchase - c.subtotal) + " lagi untuk diskon " + DC.percent + "%" + (DC.maxDiscount > 0 ? " (maks. " + rupiah(DC.maxDiscount) + ")" : "") + ".";
    if (DC) return "Diskon " + DC.percent + "% sudah diterapkan" + (DC.maxDiscount > 0 && c.discount >= DC.maxDiscount ? " (potongan maksimal " + rupiah(DC.maxDiscount) + ")" : "") + ".";
    return "";
  }
  function updateShipStatus() {
    var box = $("#shipStatus"); if (!box || !FS) return;
    if (shipMode() === "instan") { box.classList.add("hidden"); return; }
    var f = $("#stepCheckout");
    var area = f.kota.value + " " + f.kecamatan.value;
    var c = calc(area);
    if (!f.kota.value.trim()) { box.classList.add("hidden"); return; }
    box.classList.remove("hidden", "ok");
    if (c.freeShip) { box.classList.add("ok"); box.textContent = "✔ Alamat Jabodetabek: ongkir GRATIS."; }
    else if (isFreeArea(area)) box.textContent = "Alamat Jabodetabek. Tambah " + rupiah(FS.minPurchase - c.subtotal) + " lagi untuk gratis ongkir.";
    else box.textContent = "Di luar Jabodetabek: ongkir JNE dikonfirmasi admin.";
  }
  function addToCart(kode) {
    var p = findP(kode); if (!p || !p.harga) return;
    cart[kode] = (cart[kode] || 0) + 1; saveCart(); renderCart();
    toast(p.nama + " masuk keranjang");
    track("AddToCart", { content_ids: [kode], content_name: p.nama, content_type: "product", contents: [{ id: kode, quantity: 1, item_price: p.harga }], value: p.harga, currency: "IDR" });
  }
  function changeQty(kode, d) {
    cart[kode] = (cart[kode] || 0) + d;
    if (cart[kode] <= 0) delete cart[kode];
    saveCart(); renderCart();
  }
  function renderCart() {
    $("#cartBadge").textContent = cartCount();
    var keys = Object.keys(cart);
    $("#cartItems").innerHTML = keys.length ? keys.map(function (k) {
      var p = findP(k); if (!p) return "";
      return '<div class="cart-item">' +
        '<div class="thumb">' + (p.foto ? imgHTML(p) : esc(initials(p.nama))) + "</div>" +
        '<div class="info"><div class="name">' + esc(p.nama) + "</div>" +
        '<div class="price">' + rupiah(p.harga) + " × " + cart[k] + " = <b>" + rupiah(p.harga * cart[k]) + "</b></div>" +
        '<div class="qty"><button data-dec="' + esc(k) + '" aria-label="Kurangi">−</button><span>' + cart[k] +
        '</span><button data-inc="' + esc(k) + '" aria-label="Tambah">+</button>' +
        '<button class="remove" data-del="' + esc(k) + '">Hapus</button></div></div></div>';
    }).join("") : '<p class="empty">Keranjang masih kosong.</p>';
    var c = calc();
    $("#cartSubtotal").textContent = rupiah(c.subtotal);
    $("#cartDiscountRow").classList.toggle("hidden", !c.discount);
    if (DC) $("#cartDiscountLabel").textContent = "Diskon " + DC.percent + "%";
    $("#cartDiscount").textContent = "−" + rupiah(c.discount);
    $("#cartTotal").textContent = rupiah(c.total);
    $("#cartShip").textContent = c.shipEligible ? "Gratis untuk Jabodetabek" : "Dikonfirmasi admin";
    $("#cartShip").classList.toggle("ok", c.shipEligible);
    var hint = promoHint(c), h = $("#promoHint");
    h.textContent = hint; h.classList.toggle("hidden", !hint);
    h.classList.toggle("ok", !!c.discount);
    var pb = $("#promoProgress");
    if (pb && DC) {
      pb.classList.toggle("hidden", !c.subtotal);
      pb.firstElementChild.style.width = Math.min(100, Math.round(c.subtotal / DC.minPurchase * 100)) + "%";
    }
    $("#toCheckout").disabled = !keys.length;
    updateShipStatus();
    updateActions();
  }

  /* ---------- Drawer ---------- */
  function showStep(id) {
    ["#stepCart", "#stepCheckout", "#stepDone"].forEach(function (s) { $(s).classList.toggle("hidden", s !== id); });
    $("#drawerTitle").textContent = id === "#stepCheckout" ? "Data Pengiriman" : id === "#stepDone" ? "Terima Kasih" : "Keranjang";
  }
  function openDrawer() {
    showStep("#stepCart");
    $("#drawer").classList.add("open"); $("#overlay").classList.add("show");
    $("#drawer").setAttribute("aria-hidden", "false");
  }
  function closeDrawer() {
    $("#drawer").classList.remove("open"); $("#overlay").classList.remove("show");
    $("#drawer").setAttribute("aria-hidden", "true");
  }

  /* ---------- Checkout ke WhatsApp ---------- */
  function normPhone(v) {
    v = String(v).replace(/[^\d]/g, "");
    if (v.indexOf("0") === 0) v = "62" + v.slice(1);
    if (v.indexOf("8") === 0) v = "62" + v;
    return v;
  }
  function buildMessage(d) {
    var lines = ["*PESANAN BARU - " + (C.storeName || "Nafis Online") + "*", ""];
    lines.push("*Data Pembeli*");
    lines.push("Nama: " + d.nama);
    lines.push("No. WA: " + d.wa);
    lines.push("Alamat: " + d.alamat);
    lines.push("Kec. " + d.kecamatan + ", " + d.kota + " " + d.kodepos);
    lines.push("", "*Pesanan*");
    var i = 1;
    Object.keys(cart).forEach(function (k) {
      var p = findP(k); if (!p) return;
      lines.push(i++ + ". [" + p.kode + "] " + p.nama + (p.flash ? " (" + (FL.title || "Flash Sale") + ")" : "") + " x" + cart[k] + " = " + rupiah(p.harga * cart[k]));
    });
    var c = calc(d.kota + " " + d.kecamatan);
    lines.push("", "Subtotal: " + rupiah(c.subtotal));
    if (c.discount) lines.push("Diskon " + DC.percent + "%" + (DC.maxDiscount > 0 ? " (maks. " + rupiah(DC.maxDiscount) + ")" : "") + ": -" + rupiah(c.discount));
    lines.push("Total barang: *" + rupiah(c.total) + "*");
    if (shipMode() === "instan") {
      lines.push("Pengiriman: *" + ID.title + " (" + ID.couriers + ")*");
      lines.push("Titik lokasi: https://maps.google.com/?q=" + inst.pos.lat.toFixed(6) + "," + inst.pos.lng.toFixed(6));
      lines.push("Jarak dari toko: ±" + inst.km.toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " km (garis lurus)");
      lines.push("Ongkir instan: menunggu konfirmasi admin");
      lines.push("Pembayaran: *" + ID.payment + "*");
    } else {
      if (c.freeShip) lines.push("Ongkir JNE: *GRATIS* (promo " + FS.title + ")");
      else lines.push("Ongkir JNE: menunggu konfirmasi admin");
      lines.push("Pembayaran: *COD (bayar di tempat)*");
    }
    if (d.catatan) lines.push("", "Catatan: " + d.catatan);
    lines.push("", "Mohon konfirmasi total pembayarannya. Terima kasih.");
    var ref = sourceLabel();
    if (ref) lines.push("", "_Ref: " + ref + "_");
    return lines.join("\n");
  }
  function submitOrder(e) {
    e.preventDefault();
    var f = e.target, d = {};
    ["nama", "wa", "alamat", "kecamatan", "kota", "kodepos", "catatan"].forEach(function (n) { d[n] = f[n].value.trim(); });
    var err = "";
    if (!d.nama || !d.alamat || !d.kecamatan || !d.kota) err = "Mohon lengkapi semua kolom bertanda *.";
    else if (!/^628\d{7,11}$/.test(normPhone(d.wa))) err = "Nomor WhatsApp tidak valid. Contoh: 081234567890";
    else if (!/^\d{5}$/.test(d.kodepos)) err = "Kode pos harus 5 angka.";
    else if (shipMode() === "instan" && !inst.pos) err = "Tandai lokasi pengiriman di peta untuk Kirim Instan.";
    else if (shipMode() === "instan" && inst.km > ID.maxKm) err = "Lokasi di luar jangkauan Kirim Instan. Silakan pilih JNE.";
    var box = $("#formError");
    if (err) { box.textContent = err; box.classList.remove("hidden"); return; }
    box.classList.add("hidden");
    d.wa = normPhone(d.wa);

    lastWaUrl = "https://wa.me/" + C.waNumber + "?text=" + encodeURIComponent(buildMessage(d));
    // Pencocokan lanjutan (advanced matching): Pixel meng-hash data ini (SHA-256) di browser sebelum dikirim.
    if (window.fbq && C.metaPixelId) {
      try {
        window.fbq("init", C.metaPixelId, {
          ph: d.wa, fn: d.nama.split(/\s+/)[0].toLowerCase(),
          ct: d.kota.toLowerCase().replace(/^(kota|kab\.?|kabupaten)\s+/, "").replace(/[^a-z]/g, ""),
          zp: d.kodepos, country: "id"
        });
      } catch (err) {}
    }
    var orderData = { content_ids: Object.keys(cart), contents: cartContents(), content_type: "product",
      value: calc(d.kota + " " + d.kecamatan).total, currency: "IDR", num_items: cartCount() };
    track("Lead", orderData);                 // event optimasi iklan: pesanan terkirim ke WA
    track("KirimPesananWA", orderData, true); // event kustom, untuk laporan
    window.open(lastWaUrl, "_blank");

    $("#retryWa").href = lastWaUrl;
    cart = {}; saveCart(); renderCart(); f.reset();
    if (ID) { inst.pos = null; inst.km = null; if (inst.marker) { inst.marker.remove(); inst.marker = null; } $("#instantBox").classList.add("hidden"); onShipModeChange(); }
    showStep("#stepDone");
  }

  /* ---------- Meta Pixel ---------- */
  function initPixel(id) {
    if (!id) return;
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    window.fbq("init", id); window.fbq("track", "PageView");
  }

  /* ---------- Teks berganti di judul hero ---------- */
  function initHeroRotator() {
    var box = $("#heroRotator"); if (!box) return;
    var words = box.querySelectorAll(".ht-word"); if (words.length < 2) return;
    var i = 0;
    setInterval(function () {
      var cur = words[i], next = words[(i + 1) % words.length];
      cur.classList.remove("is-active"); cur.classList.add("is-past");
      next.classList.remove("is-past"); void next.offsetWidth; next.classList.add("is-active");
      setTimeout(function () { cur.classList.remove("is-past"); }, 900);
      i = (i + 1) % words.length;
    }, 2500);
  }

  /* ---------- Carousel foto di hero ---------- */
  function initHeroSlider() {
    var root = $("#heroSlider"); if (!root) return;
    var track = $("#hsTrack"), slides = track.children, n = slides.length, dots = $("#hsDots");
    var cur = 0, timer = null, busy = false, busyT, reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    dots.innerHTML = Array.prototype.map.call(slides, function (_, i) {
      return '<button aria-label="Ke slide ' + (i + 1) + '" data-hs="' + i + '"></button>';
    }).join("");
    function go(i, smooth) {
      cur = (i + n) % n;
      busy = true; clearTimeout(busyT); busyT = setTimeout(function () { busy = false; }, 800);
      track.scrollTo({ left: cur * track.clientWidth, behavior: smooth === false ? "auto" : "smooth" });
      mark();
    }
    function mark() {
      Array.prototype.forEach.call(dots.children, function (d, i) { d.classList.toggle("on", i === cur); d.setAttribute("aria-current", i === cur ? "true" : "false"); });
    }
    function play() { if (reduce || n < 2) return; stop(); timer = setInterval(function () { go(cur + 1); }, 5000); }
    function stop() { if (timer) clearInterval(timer); timer = null; }
    dots.addEventListener("click", function (e) { var b = e.target.closest("[data-hs]"); if (b) { go(Number(b.dataset.hs)); play(); } });
    var st;
    track.addEventListener("scroll", function () {
      clearTimeout(st);
      st = setTimeout(function () { if (busy) return; var i = Math.round(track.scrollLeft / track.clientWidth); if (i !== cur) { cur = i; mark(); } }, 120);
    }, { passive: true });
    root.addEventListener("mouseenter", stop); root.addEventListener("mouseleave", play);
    root.addEventListener("touchstart", stop, { passive: true }); root.addEventListener("touchend", play);
    document.addEventListener("visibilitychange", function () { if (document.hidden) stop(); else play(); });
    window.addEventListener("resize", function () { go(cur, false); });
    mark(); play();
  }

  /* ---------- Inisialisasi ---------- */
  function init() {
    if (C.brandColor) document.documentElement.style.setProperty("--brand", C.brandColor);
    document.querySelectorAll("[data-store-name]").forEach(function (el) { el.textContent = C.storeName || el.textContent; });
    if (C.tagline && $("[data-tagline]")) $("[data-tagline]").textContent = C.tagline;
    var waLink = "https://wa.me/" + C.waNumber + "?text=" + encodeURIComponent("Assalamu'alaikum, saya ingin bertanya tentang produk " + (C.storeName || ""));
    $("#footerWa").href = waLink; $("#floatWa").href = waLink;
    if ($("#heroWa")) $("#heroWa").href = waLink;
    initHeroRotator();
    initHeroSlider();
    captureSource();
    initPixel(C.metaPixelId);

    document.addEventListener("click", function (e) {
      var wa = e.target.closest('a[href^="https://wa.me/"]');
      if (wa && wa.id !== "retryWa") track("Contact", { content_name: wa.id || "tanya-wa" });
      var v = e.target.closest("[data-view]");
      if (v) { openProduct(v.getAttribute("data-view"), v); return; }
      var t = e.target.closest("[data-add],[data-inc],[data-dec],[data-del],[data-cat],[data-fpage]");
      if (!t) return;
      if (t.dataset.add) addToCart(t.dataset.add);
      else if (t.dataset.inc) changeQty(t.dataset.inc, 1);
      else if (t.dataset.dec) changeQty(t.dataset.dec, -1);
      else if (t.dataset.del) { delete cart[t.dataset.del]; saveCart(); renderCart(); }
      else if (t.dataset.cat) {
        activeCat = t.dataset.cat; shown = PAGE_SIZE; renderCategories(); renderProducts();
        if (t.classList.contains("cat-tile")) $("#produk").scrollIntoView({ behavior: "smooth" });
      }
      else if (t.dataset.fpage) { var tr = $("#featuredTrack"); tr.scrollTo({ left: Number(t.dataset.fpage) * tr.clientWidth, behavior: "smooth" }); }
    });
    $("#search").addEventListener("input", function (e) { query = e.target.value; shown = PAGE_SIZE; renderProducts(); if ($("#hSearch")) $("#hSearch").value = query; });
    if ($("#hSearchForm")) {
      var hs = $("#hSearch"), hsT;
      var fromHeader = function () { query = hs.value; $("#search").value = query; shown = PAGE_SIZE; renderProducts(); };
      hs.addEventListener("input", function () { fromHeader(); clearTimeout(hsT); hsT = setTimeout(function () { if (hs.value.trim()) $("#produk").scrollIntoView({ behavior: "smooth" }); }, 700); });
      $("#hSearchForm").addEventListener("submit", function (e) { e.preventDefault(); clearTimeout(hsT); fromHeader(); $("#produk").scrollIntoView({ behavior: "smooth" }); });
    }
    $("#loadMore").addEventListener("click", function () { shown += PAGE_SIZE; renderProducts(); });
    $("#showAll").addEventListener("click", function () { shown = Infinity; renderProducts(); });
    $("#featPrev").addEventListener("click", function () { scrollFeatured(-1); });
    $("#featNext").addEventListener("click", function () { scrollFeatured(1); });
    var navT;
    $("#featuredTrack").addEventListener("scroll", function () { clearTimeout(navT); navT = setTimeout(updateFeaturedNav, 60); }, { passive: true });
    window.addEventListener("resize", function () { clearTimeout(navT); navT = setTimeout(updateFeaturedNav, 150); });
    $("#openCart").addEventListener("click", function () { closeProduct(); openDrawer(); });
    $("#closeCart").addEventListener("click", closeDrawer);
    $("#overlay").addEventListener("click", closeDrawer);
    $("#doneClose").addEventListener("click", closeDrawer);
    $("#toCheckout").addEventListener("click", function () {
      showStep("#stepCheckout");
      track("InitiateCheckout", { content_ids: Object.keys(cart), contents: cartContents(), content_type: "product", value: cartTotal(), currency: "IDR", num_items: cartCount() });
    });
    $("#backToCart").addEventListener("click", function () { showStep("#stepCart"); });
    $("#stepCheckout").addEventListener("submit", submitOrder);
    $("#stepCheckout").kota.addEventListener("input", updateShipStatus);
    $("#stepCheckout").kecamatan.addEventListener("input", updateShipStatus);
    renderPromos();
    initInstant();
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { if (!closeProduct()) closeDrawer(); return; }
      var v = (e.key === "Enter" || e.key === " ") && e.target.closest && e.target.closest("[data-view]");
      if (v) { e.preventDefault(); openProduct(v.getAttribute("data-view"), v); }
    });
    initProductModal();

    renderCart();
    loadProducts();
  }
  document.addEventListener("DOMContentLoaded", init);
})();
