#!/bin/bash
# Crea (o rota la clave de) el rol de runtime de la app — separado del rol que corre las
# migraciones (DATABASE_URL, que sigue siendo dueño de las tablas). Ver docs/RLS.md.
#
# Este rol NO es dueño de ninguna tabla, así que queda sujeto a las políticas RLS sin necesitar
# FORCE ROW LEVEL SECURITY (FORCE solo hace falta para que un dueño/superusuario también quede
# sujeto — acá alcanza con ENABLE, que ya está en las migraciones anteriores).
#
# Uso: APP_ROLE_PASSWORD="..." DATABASE_URL="postgresql://postgres:postgres@localhost:5432/saas_erp_pe" ./scripts/setup-app-role.sh
set -euo pipefail

: "${APP_ROLE_PASSWORD:?Falta APP_ROLE_PASSWORD}"
: "${DATABASE_URL:?Falta DATABASE_URL}"

psql "$DATABASE_URL" <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'flashstock_app') THEN
    CREATE ROLE flashstock_app LOGIN PASSWORD '$APP_ROLE_PASSWORD' NOSUPERUSER NOBYPASSRLS;
  ELSE
    ALTER ROLE flashstock_app WITH PASSWORD '$APP_ROLE_PASSWORD' NOSUPERUSER NOBYPASSRLS;
  END IF;
END
\$\$;

GRANT USAGE ON SCHEMA public TO flashstock_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO flashstock_app;
-- Cualquier tabla que una migración futura cree (siempre corriendo como el rol dueño de
-- DATABASE_URL) le otorga estos mismos privilegios a flashstock_app automáticamente — sin esto,
-- habría que acordarse de correr este script de nuevo cada vez que se agrega una tabla.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO flashstock_app;
SQL

echo "Rol flashstock_app listo."
