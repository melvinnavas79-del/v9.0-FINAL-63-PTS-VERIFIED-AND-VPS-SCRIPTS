# Política de Seguridad — Lluvia Live

**Titular:** Melvin H. Navas Hernández
**Producto:** Lluvia Live (plataforma de salas de audio en vivo)
**Versión:** v8.0

---

## 1. Propósito

Este documento establece los mecanismos de divulgación responsable de
vulnerabilidades de seguridad descubiertas en Lluvia Live. Agradecemos
profundamente a la comunidad de investigadores y auditores que colaboran
para mantener segura la plataforma y a sus usuarios.

## 2. Alcance

Esta política aplica a todos los componentes del producto:

- Backend FastAPI (`/backend`)
- Frontend React (`/frontend`)
- Apps móviles nativas iOS y Android (`/ios-project`, `/android-build`)
- Infraestructura gestionada por el Titular (servidores, DNS, almacenamiento)
- Endpoints REST y WebSocket expuestos por el producto

## 3. Versiones soportadas

| Versión | Estado         | Soporte de seguridad |
|---------|----------------|----------------------|
| 8.x     | ✅ Activa      | Sí, hasta nuevo aviso |
| < 8.0   | ❌ Obsoleta    | No                   |

## 4. Canal de reporte

Para reportar una vulnerabilidad, envía un correo a:

**security@lluvialive.com**

Tu reporte debe incluir, como mínimo:

1. Descripción técnica detallada de la vulnerabilidad.
2. Pasos de reproducción.
3. Impacto estimado (confidencialidad, integridad, disponibilidad).
4. Evidencia (capturas, logs, prueba de concepto).
5. Tu nombre o alias y canal de contacto.

Si el hallazgo es crítico, cifra tu correo con la clave PGP publicada en
`https://lluvialive.com/.well-known/pgp-key.asc`.

## 5. Compromiso de respuesta

- **24 horas** — Acuse de recibo del reporte.
- **72 horas** — Confirmación de reproducción y severidad preliminar.
- **30 días**  — Parche publicado o plan de mitigación comunicado al
  reportante, según severidad CVSS v3.1.

## 6. Puerto seguro (Safe Harbor)

No emprenderemos acciones legales contra quien reporte vulnerabilidades
siempre que respete estas reglas:

- No acceda ni exfiltre datos personales de usuarios reales.
- No interrumpa el servicio ni degrade su rendimiento.
- No ejecute ataques de denegación de servicio ni spam.
- No divulgue el hallazgo públicamente antes de que el Titular lo haya
  remediado y autorizado la publicación.

## 7. Reconocimiento

Con autorización del reportante, incluiremos su nombre y el hallazgo en
nuestro Salón de la Fama de Seguridad, disponible en
`https://lluvialive.com/security/hall-of-fame`.

## 8. Exclusiones

No se consideran vulnerabilidades reportables:

- Ataques que requieran acceso físico al dispositivo del usuario.
- Problemas de interfaz (UI/UX) sin impacto en seguridad.
- Rate limiting en endpoints públicos de bajo riesgo.
- Divulgación de versiones de librerías (banner disclosure).
- Ataques de ingeniería social contra empleados o usuarios.

## 9. Contacto

**Melvin H. Navas Hernández** — Titular y responsable de seguridad
Correo: security@lluvialive.com
Sitio: https://lluvialive.com
