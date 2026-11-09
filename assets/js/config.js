/* =========================================================
   PENGATURAN TOKO — cukup edit file ini
   ========================================================= */
window.STORE_CONFIG = {
  // Nama & tagline toko
  storeName: "Nafis Online",
  tagline: "Pesan via WhatsApp, dikirim JNE, bayar di tempat (COD).",

  // Nomor WA admin, format internasional TANPA + dan tanpa spasi (contoh: 6281234567890)
  waNumber: "6281282478009",

  // Sumber data produk:
  // - default: file lokal "data/products.csv"
  // - atau link Google Sheet: File > Bagikan > Publikasikan ke web > pilih format CSV, tempel link-nya di sini
  productsCsvUrl: "data/products.csv",

  // Meta Pixel ID (kosongkan jika belum ada)
  metaPixelId: "",

  // Warna utama toko (kode hex)
  brandColor: "#0F2A47",

  // =======================================================
  // PROMO — ubah angka di sini, atau set active: false untuk mematikan
  // =======================================================
  promos: {
    freeShipping: {
      active: true,
      minPurchase: 200000,          // minimal belanja (sebelum diskon)
      title: "Gratis Ongkir Jabodetabek",
      // kata kunci kota/kabupaten yang dapat gratis ongkir
      areas: ["jakarta", "bogor", "depok", "tangerang", "bekasi"]
    },
    discount: {
      active: true,
      minPurchase: 1000000,          // minimal belanja
      percent: 50,                  // besar diskon (%)
      maxDiscount: 50000,           // potongan maksimal (Rp); 0 = tanpa batas
      title: "Diskon 50%"
    }
  }
};
