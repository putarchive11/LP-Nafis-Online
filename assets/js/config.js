/* =========================================================
   PENGATURAN TOKO — cukup edit file ini
   ========================================================= */
window.STORE_CONFIG = {
  // Nama & tagline toko
  storeName: "Nafis Online",
  tagline: "Pesan via WhatsApp, dikirim JNE, bayar di tempat (COD).",

  // Nomor WA admin, format internasional TANPA + dan tanpa spasi (contoh: 6281234567890)
  waNumber: "6285156219748",

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
    // FLASH SALE — harga khusus per kode produk, otomatis aktif & berakhir sesuai tanggal (WIB)
    flashSale: {
      active: true,
      title: "Flash Sale",
      start: "2026-11-12T00:00:00+07:00",   // mulai
      end: "2026-12-12T23:59:59+07:00",     // berakhir
      items: {
        "HNF-12": 20000,    // Teh Celup Rimpang Hanifah 20 sachet
        "NFS-180": 20000,   // Teh Rimpang ala JSR Hanifah
        "HNF-15": 75000,    // Durusul Lughah Hard Cover jilid 1-4
        "DL-SC": 63000      // Durusul Lughah Softcover jilid 1-4 (Attuqa)
      }
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
