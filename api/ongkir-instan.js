// Vercel Serverless Function: cek ongkir instan GoSend & GrabExpress lewat Biteship.
// API key disimpan aman di Vercel (Environment Variable BITESHIP_API_KEY), tidak pernah dikirim ke browser.
const ORIGIN = { lat: -6.36679, lng: 106.80056 }; // Jl. Fatahillah II No. 66, Tanah Baru, Beji, Depok
const MAX_KM = 25;
const GRAM_PER_ITEM = 400; // perkiraan berat rata-rata per barang (buku/botol/kapsul)

function km(a, b) {
  const R = 6371, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ ok: false, reason: "method" });
  const key = process.env.BITESHIP_API_KEY;
  if (!key) return res.status(200).json({ ok: false, reason: "nokey" });

  let b = req.body || {};
  if (typeof b === "string") { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  const lat = Number(b.lat), lng = Number(b.lng);
  if (!isFinite(lat) || !isFinite(lng) || lat < -11.5 || lat > 6.5 || lng < 94 || lng > 141.5)
    return res.status(400).json({ ok: false, reason: "coords" });
  if (km(ORIGIN, { lat, lng }) > MAX_KM) return res.status(200).json({ ok: false, reason: "far" });
  const qty = Math.min(50, Math.max(1, Math.round(Number(b.qty) || 1)));
  const value = Math.min(15000000, Math.max(10000, Math.round(Number(b.value) || 0)));

  try {
    const r = await fetch("https://api.biteship.com/v1/rates/couriers", {
      method: "POST",
      headers: { authorization: key, "content-type": "application/json" },
      body: JSON.stringify({
        origin_latitude: ORIGIN.lat, origin_longitude: ORIGIN.lng,
        destination_latitude: lat, destination_longitude: lng,
        couriers: "gojek,grab",
        items: [{ name: "Paket Nafis Online", value, quantity: 1, weight: Math.max(1000, qty * GRAM_PER_ITEM) }]
      })
    });
    const j = await r.json();
    if (!r.ok || !j.success || !Array.isArray(j.pricing)) return res.status(200).json({ ok: false, reason: "upstream", message: j && j.error });
    const nice = { gojek: "GoSend", grab: "GrabExpress" };
    const options = j.pricing
      .filter(p => /^(gojek|grab)$/.test(p.courier_code) && /instant|same_day/i.test(p.courier_service_code + " " + p.service_type))
      .map(p => ({
        courier: nice[p.courier_code] || p.courier_name,
        service: p.courier_service_name,
        code: p.courier_code + ":" + p.courier_service_code,
        price: Math.round(p.price),
        eta: p.duration || ""
      }))
      .sort((a, b) => a.price - b.price);
    return res.status(200).json({ ok: true, options });
  } catch (e) {
    return res.status(200).json({ ok: false, reason: "error" });
  }
};
