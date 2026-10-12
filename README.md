# 🧾 Gastos del Restaurante

App web para registrar y controlar los gastos del restaurante desde el celular o el computador.

- **Registro rápido:** monto + categoría y listo. Proveedor, fecha, forma de pago y nota son opcionales.
- **Caja menor y jefe:** cada gasto indica si lo pagó el cajero (🪙 caja menor) o el jefe (👔). El inicio, el historial y la exportación los muestran juntos o por separado.
- **Foto de la factura:** se toma al registrar el gasto y queda guardada como soporte, en un almacenamiento privado que solo ve su dueño.
- **Gastos fijos:** arriendo, servicios, nómina… Se definen una vez y cada mes el inicio muestra cuáles faltan por registrar, con los datos ya llenos.
- **Resumen del mes** por categoría, comparado con los mismos días del mes anterior.
- **Presupuesto mensual** por categoría, con aviso cuando te pasas.
- **Historial** por mes o por días (hoy, ayer, los últimos días o un tramo exacto), con búsqueda por proveedor, nota o monto; editar y eliminar gastos.
- **Proveedores** que recuerdan su categoría habitual y la eligen solos.
- **Exportar** un mes a Excel (.xlsx) con tres hojas: el detalle, el resumen por categoría y el total de cada día.
- **Se instala en el celular** como una app (PWA).

**Tecnología:** Next.js 16 · Supabase (base de datos y login) · Tailwind CSS · Vercel.

---

## 1. Configurar Supabase (una sola vez)

1. Crea un proyecto **nuevo y exclusivo** para el restaurante en [supabase.com](https://supabase.com). No reutilices el proyecto de otro sistema: los usuarios de ambos quedarían mezclados.
2. Ve a **SQL Editor → New query**, pega todo el contenido de [`supabase/schema.sql`](supabase/schema.sql) y toca **Run**.
3. Crea tu usuario: **Authentication → Users → Add user → Create new user**. Escribe tu correo y contraseña y marca **Auto Confirm User**.
4. Bloquea registros nuevos: **Authentication → Sign In / Providers** → desactiva **Allow new users to sign up**. Así nadie más puede crear una cuenta.
5. En **Project Settings → API Keys** copia la **Project URL** y la **Publishable key** (o la `anon` key si tu proyecto usa las llaves antiguas).

> En el plan gratis, Supabase pausa los proyectos que pasan 7 días sin uso. Si registras gastos a diario no pasa; si se pausa, se reactiva desde el panel.

## 2. Correr la app en tu computador

Copia `.env.example` como `.env.local` y completa tus llaves. Luego:

```bash
npm install
npm run dev
```

Abre http://localhost:3000 e inicia sesión. La primera vez se crean 12 categorías sugeridas para restaurante; puedes editarlas, reordenarlas o archivarlas.

## 3. Publicar en Vercel

El proyecto ya está listo para Vercel: `vercel.json` ubica la app en la región `iad1`, la misma zona del proyecto de Supabase (`us-east-1`), para que las consultas sean rápidas, y `package.json` fija Node 24. Vercel detecta Next.js solo; no hay que cambiar comandos.

1. Sube el proyecto a un repositorio de GitHub.
2. En [vercel.com](https://vercel.com) → **Add New → Project** → importa el repositorio.
3. En **Environment Variables** agrega estas variables (para Production, Preview y Development):

   | Variable | Valor |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL de Supabase |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key de Supabase |
   | `NEXT_PUBLIC_CURRENCY` | `COP` |
   | `NEXT_PUBLIC_CURRENCY_DECIMALS` | `0` |
   | `NEXT_PUBLIC_LOCALE` | `es-CO` |
   | `NEXT_PUBLIC_TIME_ZONE` | `America/Bogota` |

   Las variables `NEXT_PUBLIC_*` se incluyen al compilar: si cambias alguna después, vuelve a desplegar.
4. Toca **Deploy**.
5. En Supabase → **Authentication → URL Configuration**, pon la URL de Vercel (por ejemplo `https://tu-app.vercel.app`) como **Site URL**.

Cada vez que subas cambios a la rama `main`, Vercel publica una versión nueva automáticamente.

## 4. Instalar en el celular

Abre la URL de Vercel en el celular e inicia sesión:

- **Android (Chrome):** menú ⋮ → **Agregar a la pantalla principal**.
- **iPhone (Safari):** botón Compartir → **Agregar a inicio**.

## Ajustes regionales

| Variable | Por defecto | Otros ejemplos |
| --- | --- | --- |
| `NEXT_PUBLIC_CURRENCY` | `COP` | `MXN`, `USD`, `EUR` |
| `NEXT_PUBLIC_CURRENCY_DECIMALS` | `0` | `2` |
| `NEXT_PUBLIC_LOCALE` | `es-CO` | `es-MX`, `es-ES` |
| `NEXT_PUBLIC_TIME_ZONE` | `America/Bogota` | `America/Mexico_City` |

Si las cambias en Vercel, vuelve a desplegar para que tomen efecto.

## Estructura del proyecto

```text
supabase/schema.sql       Tablas, seguridad por usuario (RLS) y totales por categoría
src/proxy.ts              Protege todas las páginas: sin sesión → /login
src/actions/              Acciones del servidor: guardar, editar, eliminar
src/lib/                  Consultas, formato de dinero y fechas, configuración
src/components/           Formulario de gasto, historial, resumen, categorías, proveedores
src/app/(app)/            Páginas con menú inferior: inicio, historial, categorías, ajustes
src/app/(form)/           Pantallas de registrar y editar un gasto
src/app/api/exportar/     Descarga el Excel del mes (se arma en src/lib/excel.ts)
```

## Scripts

- `npm run dev` — servidor de desarrollo
- `npm run build` — compila para producción
- `npm run lint` — revisa el código
- `npm run icons` — regenera los íconos de la app
