# Sprint Change Proposal: Defer Story 4.4

**Date:** 2026-05-02
**Project:** Hammielion POS

## 1. Issue Summary

**Trigger:** Penundaan Story 4.4 (**Backoffice Retur Management**) keluar dari sprint saat ini.
**Reason:** Fitur ini memerlukan antarmuka Dashboard Backoffice yang belum ada. Epic 4 saat ini lebih terfokus pada fungsionalitas koreksi transaksi di sisi POS Desktop (Kasir). Mengerjakan Story 4.4 sekarang akan menyebabkan pengerjaan yang tidak fokus antara POS dan Backoffice.

## 2. Impact Analysis

- **Epic Impact:** Epic 4 ("Transaction Correction & Retur") akan dianggap selesai di sisi POS tanpa fungsionalitas Backoffice.
- **Story Impact:** Story 4.4 dipindahkan statusnya menjadi `deferred` dan akan ditinjau kembali saat inisialisasi Epic 5.
- **Artifact Conflicts:** `epics.md` telah diperbarui dengan catatan penundaan. `sprint-status.yaml` telah diperbarui menjadi `deferred`.
- **Technical Impact:** Tidak ada dampak teknis pada kode yang sudah ada. Menghindari pengembangan UI Backoffice yang terfragmentasi.

## 3. Recommended Approach

**Path:** Direct Adjustment (Deferral).
**Recommendation:** Pindahkan implementasi Retur Management ke dalam lingkup pengerjaan Backoffice yang lebih luas di Epic 5 atau Epic khusus Backoffice nantinya.

## 4. Detailed Change Proposals

### Artifact: `epics.md`
- **Section:** Epic 4
- **Change:** Ditambahkan label `(DEFERRED)` pada Story 4.4 dan catatan mengenai relokasi ke Epic 5.

### Artifact: `sprint-status.yaml`
- **Section:** development_status
- **Change:** `4-4-backoffice-retur-management: backlog` -> `4-4-backoffice-retur-management: deferred`

## 5. Implementation Handoff

- **Scope:** Minor (Deferral management).
- **Recipient:** Product Owner / Developer.
- **Success Criteria:** Daftar Epic dan status sprint mencerminkan penundaan Story 4.4 dengan jelas.
