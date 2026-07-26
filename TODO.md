# TODO: Lock Manual (Tombol L) + Musuh Defensif

## Steps:
- [x] Analisis kode (app.js, entities.js)
- [x] Dapatkan persetujuan user
- [x] **Edit `js/entities.js`**: 
  - Tambah properti `hasBeenLockedBy = null` di class Aircraft
- [x] **Edit `js/app.js` - Constructor**:
  - Tambah `this.lockRequested = false`
- [x] **Edit `js/app.js` - initInputListeners()**:
  - Tambah listener tombol L untuk toggle lock
- [x] **Edit `js/app.js` - updateCombatSystems()**:
  - Player hanya lock jika `lockRequested = true`
  - Set `target.hasBeenLockedBy` saat lock selesai
  - AI hanya serang jika sudah di-lock player
- [x] **Edit `js/app.js` - updateGameLogic()**:
  - Update HUD untuk instruksi "Press L to lock"
- [ ] Testing: buka index.html dan coba fitur baru
