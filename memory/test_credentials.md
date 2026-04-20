# Test Credentials — Lluvia Live

## Owner / Dueño (Super Admin)
- Username: `Melvin_Live`
- Password: `test123`
- Role: `dueño`
- Permissions: full admin, bot control, event approvals, device banning, **Script Runner (Consola Técnica)**

## Script Runner (Consola Técnica)
- Endpoint: `POST /api/admin/script-runner/execute`
- Header requerido: `X-Master-Key: <valor definido en /app/backend/.env MASTER_KEY>`
- Mínimo 20 caracteres. **El dueño lo define manualmente** (nunca en DB ni en repo).
- Estado actual: `MASTER_KEY=` vacío en `.env` — Melvin lo completa antes de usar la consola.
- Tras editar el .env: `sudo supervisorctl restart backend`

## Notes
- Login endpoint: `POST /api/login` con `{ username, password }` (NO `/api/auth/login`)
- Firebase login endpoint: `POST /api/auth/firebase` con token Firebase
- Melvin_Live user_id: `b45958bc-2c6b-49ea-8102-a11197001e53`
- Diagnostics URL (producción): `https://<tu-dominio>/api/diagnostics?user_id=b45958bc-2c6b-49ea-8102-a11197001e53`
