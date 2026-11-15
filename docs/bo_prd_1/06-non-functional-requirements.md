# 6. NON-FUNCTIONAL REQUIREMENTS (GENERAL)

## 6.1 Performance

| Metric | Target |
|--------|--------|
| Dashboard load (first paint) | < 2 detik |
| API response time (get data) | < 500 ms |
| API response time (write data) | < 1 detik |
| Report generation | < 10 detik |
| Concurrent users | 20+ users |

## 6.2 Security

**Authentication:**
- JWT token di HTTP-only cookie
- Token expiry: 30 menit idle
- Refresh token: 7 hari

**Authorization:**
- Role-based access control (RBAC)
- Granular permission per user (customizable)
- Audit log semua action kritikal

**Data Protection:**
- HTTPS only (no HTTP)
- Sensitive data encrypted at rest (database level)
- No sensitive data in URL params

**No 2FA/OTP** (sesuai requirement user)
**No IP Whitelist** (akses dari mana saja, sesuai requirement)

## 6.3 Scalability

**Horizontal Scaling:**
- Stateless API (bisa scale dengan load balancer)
- Database connection pooling
- Redis for session cache (optional)

**Database:**
- PostgreSQL (single source of truth)
- Indexing strategy untuk query performance
- Connection pool size: 20-50

## 6.4 Platform

**Web App:**
- **Desktop**: Full features (primary)
- **Mobile (PWA)**: Responsive, bisa "Add to Home Screen"
- **Browser Support**: Chrome, Firefox, Safari, Edge (latest 2 versions)

**No Native Mobile App** (sesuai keputusan user: "belum bisa putuskan sekarang")

## 6.5 Backup & Recovery

**Backup:**
- **Frequency**: Harian
- **Location**: Cloud storage berbayar (AWS/GCP)
- **Retention**:
  - 7 hari terakhir: backup harian
  - 30 hari terakhir: backup weekly
  - 1 tahun: backup monthly

**No Disaster Recovery Plan** (rely on cloud provider SLA, sesuai requirement)

## 6.6 Availability

**Target Uptime:** 99.5%

**Maintenance Window:**
- Off-peak hours (03:00 - 05:00 WIB)
- Advance notification (24 jam sebelumnya)
