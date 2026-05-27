# Tamiz Regulatorio - AMC Principal
## Next.js + Supabase + PostgreSQL Migration

**Versión:** 2.0 (En Desarrollo)  
**Estado:** Fase 1 - Setup Base ✅ Completada  
**Fecha Inicio:** 2026-05-27

---

## 📋 Tabla de Contenidos

1. [Descripción General](#descripción-general)
2. [Setup Inicial](#setup-inicial)
3. [Configuración de Variables de Entorno](#configuración-de-variables-de-entorno)
4. [Base de Datos](#base-de-datos)
5. [Estructura del Proyecto](#estructura-del-proyecto)
6. [Comandos Disponibles](#comandos-disponibles)
7. [Próximos Pasos](#próximos-pasos)

---

## 📌 Descripción General

**Tamiz Regulatorio** es una herramienta de diagnóstico de esquemas regulatorios en operaciones de energía. Esta es una migración completa del Tamiz v1.0 (HTML/CSS/JavaScript vanilla) a una arquitectura moderna con:

- **Frontend:** Next.js 14+ con TypeScript y Tailwind CSS
- **Backend:** Supabase (PostgreSQL + Auth + Storage)
- **Deploy:** Vercel
- **APIs Externas:** Brevo (emails) y Web3Forms (reportes)

### Características Principales

✅ Cuestionario de 6 pasos + 2 ramas condicionales  
✅ Gestión de sesiones con timeout (30 minutos)  
✅ Verificación de email con tokens (6 dígitos, 10 minutos)  
✅ Upload de documentos (hasta 10MB por archivo)  
✅ Diagnóstico y comparación con intuición inicial  
✅ Envío de reportes a operaciones y usuario  
✅ Protecciones de seguridad (bloqueo dev tools, context menu, etc.)  
✅ Responsive design con paleta de colores personalizada  

---

## 🚀 Setup Inicial

### Requisitos Previos

- Node.js 18+ con npm
- Git
- Cuenta en Supabase (supabase.com)
- Cuenta en Brevo (brevo.com)
- Cuenta en Web3Forms (web3forms.com)
- Cuenta en Vercel (vercel.com)

### Instalación

```bash
# 1. Navegar al proyecto
cd D:\OneDrive\AAA-Carpeta\ Trabajo\ 2026\1-Carperta\ Trabajo\ Colombia\ Principal\ 2026\Juan\tamiz-nextjs

# 2. Instalar dependencias (ya hecho en Fase 1)
npm install

# 3. Iniciar servidor de desarrollo
npm run dev

# La aplicación estará disponible en http://localhost:3000
```

---

## 🔐 Configuración de Variables de Entorno

### Paso 1: Crear Proyecto en Supabase

1. Ir a [supabase.com](https://supabase.com)
2. Crear nuevo proyecto
3. Copiar las credenciales:
   - `Project URL`
   - `Anon Key`
   - `Service Role Key`

### Paso 2: Ejecutar Schema de Base de Datos

1. Abrir Supabase SQL Editor
2. Copiar contenido de `database.sql`
3. Ejecutar el script completo
4. Verificar que se crearon:
   - Tabla `tamiz_sessions`
   - Tabla `tamiz_files`
   - Tabla `tamiz_diagnosticos`
   - Bucket `tamiz-files` en Storage

### Paso 3: Actualizar .env.local

Editar archivo `.env.local` con las credenciales:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-aqui
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-aqui

# Brevo (Email)
BREVO_API_KEY=tu-brevo-api-key-aqui
BREVO_SENDER_EMAIL=noreply@amcprincipal.com
BREVO_SENDER_NAME=AMC Principal

# Web3Forms (Reportes)
WEB3FORMS_ACCESS_KEY=tu-web3forms-key-aqui
WEB3FORMS_RECIPIENT_EMAIL=ops@amcprincipal.com

# Configuración de la App
NEXT_PUBLIC_SESSION_TIMEOUT_MINUTES=30
NEXT_PUBLIC_EMAIL_VERIFY_EXPIRY_MINUTES=10
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Entorno
NODE_ENV=development
```

---

## 🗄️ Base de Datos

### Tablas Creadas

#### `tamiz_sessions`
Gestiona las sesiones de usuarios en el cuestionario.

**Campos principales:**
- `id` (UUID) - ID único de la sesión
- `company_name` (TEXT) - Nombre de la empresa
- `contact_email` (TEXT) - Email de contacto
- `current_step` (TEXT) - Paso actual del cuestionario
- `email_verified` (BOOLEAN) - Confirmación de email
- `verify_token` (TEXT) - Token de verificación
- `answers_json` (JSONB) - Respuestas del cuestionario
- `preliminary_scheme` (TEXT) - Esquema diagnosticado
- `active_schemes` (TEXT[]) - Esquemas aún disponibles
- `created_at`, `updated_at`, `completed_at` (TIMESTAMPS)

#### `tamiz_files`
Metadata de archivos cargados en el cuestionario.

**Campos principales:**
- `id` (UUID) - ID único del archivo
- `session_id` (UUID FK) - Sesión asociada
- `file_name`, `file_type`, `file_size` - Metadata
- `supabase_path` (TEXT) - Ruta en Storage
- `expires_at` (TIMESTAMP) - Expiración (7 días por defecto)

#### `tamiz_diagnosticos`
Registro de diagnósticos completados.

**Campos principales:**
- `id` (UUID) - ID único del diagnóstico
- `session_id` (UUID FK) - Sesión asociada
- `company_name`, `contact_email` - Datos de la empresa
- `initial_intuition` (TEXT) - Intuición inicial (q0)
- `diagnosed_scheme` (TEXT) - Esquema final
- `all_answers` (JSONB) - Todas las respuestas
- `sent_to_ops`, `sent_to_user` (BOOLEAN) - Estados de envío

### Índices y Políticas RLS

- Índices en `email`, `current_step`, `created_at` para optimización
- Políticas RLS habilitadas (permitir todo por ahora, securizar después)
- Bucket Storage con políticas de lectura/escritura/eliminación

---

## 📁 Estructura del Proyecto

```
tamiz-nextjs/
├── app/
│   ├── api/
│   │   ├── health/route.ts          ✅ Health check
│   │   ├── sessions/route.ts        ✅ Crear sesión
│   │   ├── answers/route.ts         ✅ Guardar respuesta
│   │   ├── send-token/route.ts      ✅ Enviar token (skeleton)
│   │   ├── verify-email/route.ts    ✅ Verificar email
│   │   └── send-report/route.ts     ✅ Enviar diagnóstico (skeleton)
│   ├── questionnaire/
│   │   ├── layout.tsx               (Próximo - Phase 2)
│   │   ├── [step]/page.tsx          (Próximo - Phase 4)
│   │   └── result/page.tsx          (Próximo - Phase 6)
│   ├── globals.css                  ✅ Estilos migrados
│   ├── layout.tsx                   (Default)
│   └── page.tsx                     (Default)
│
├── lib/
│   ├── supabase.ts                  ✅ Cliente Supabase
│   ├── db.ts                        ✅ Funciones CRUD
│   ├── types.ts                     ✅ Tipos TypeScript
│   ├── constants.ts                 ✅ Configuración y esquemas
│   ├── logic.ts                     (Próximo - Phase 3)
│   ├── email.ts                     (Próximo - Phase 5)
│   └── state-manager.ts             (Próximo - Phase 3)
│
├── components/
│   ├── QuestionCard.tsx             (Próximo - Phase 2)
│   ├── ProgressBar.tsx              (Próximo - Phase 2)
│   ├── SchemePills.tsx              (Próximo - Phase 2)
│   └── steps/
│       ├── QName.tsx                (Próximo - Phase 4)
│       ├── QVerify.tsx              (Próximo - Phase 4)
│       ├── Q0.tsx                   (Próximo - Phase 4)
│       └── ...más componentes
│
├── hooks/
│   ├── useSessionState.ts           (Próximo - Phase 3)
│   ├── useTamizSession.ts           (Próximo - Phase 3)
│   └── useNavigation.ts             (Próximo - Phase 3)
│
├── public/
│   └── logo.svg                     (Próximo)
│
├── .env.local                       ✅ Variables de entorno (template)
├── database.sql                     ✅ Schema PostgreSQL
├── package.json                     ✅ Dependencias
├── tsconfig.json                    ✅ TypeScript config
├── next.config.ts                   ✅ Next.js config
├── tailwind.config.ts               ✅ Tailwind config
├── postcss.config.mjs               ✅ PostCSS config
├── PHASE1_COMPLETE.md               ✅ Resumen Fase 1
└── README_SETUP.md                  ✅ Este archivo
```

---

## 📝 Comandos Disponibles

```bash
# Desarrollo
npm run dev                    # Iniciar servidor de desarrollo (localhost:3000)

# Build
npm run build                  # Build para producción

# Start
npm start                      # Iniciar servidor de producción

# Linting
npm run lint                   # Ejecutar ESLint
npm run lint:fix              # Corregir problemas de linting

# Tipos
npm run type-check            # Verificar tipos TypeScript

# Database
# (Ejecutar manualmente en Supabase SQL Editor)
# Copiar contenido de database.sql y ejecutar
```

---

## 🔄 Próximos Pasos

### Fase 2: Componentes UI (1.5 semanas)
- [ ] QuestionCard, ProgressBar, SchemePills
- [ ] Sistema de notificaciones (Toast)
- [ ] Validación de inputs
- [ ] Layout persistente

### Fase 3: Lógica de Sesión (1 semana)
- [ ] Hook useSessionState
- [ ] State manager
- [ ] Lógica de routing

### Fase 4: Pasos del Cuestionario (2 semanas)
- [ ] Implementar todos los componentes de pasos
- [ ] Integrar con lógica de decisión

### Fase 5: Integraciones Email (1 semana)
- [ ] Brevo API para tokens
- [ ] Web3Forms para reportes

### Fases 6-10
- [ ] Resultado final
- [ ] Upload de documentos
- [ ] Navegación y casos edge
- [ ] Testing
- [ ] Deploy a Vercel

---

## 🔒 Seguridad

### Implementadas en Fase 1

- ✅ CORS configurado en Next.js
- ✅ Validación de entrada en API routes
- ✅ Tipos TypeScript para type safety
- ✅ RLS (Row Level Security) en Supabase
- ✅ CSS para bloquear user-select en body

### Por Implementar

- ⏳ Bloqueo de Dev Tools (F12, Ctrl+U, etc.)
- ⏳ Protección contra context menu
- ⏳ Rate limiting en endpoints
- ⏳ CSRF tokens
- ⏳ Content Security Policy (CSP)
- ⏳ Encrypting de tokens sensibles

---

## 📊 Checklist de Progreso

### Fase 1: Setup Base
- [x] Proyecto Next.js creado
- [x] Dependencias Supabase instaladas
- [x] Variables de entorno configuradas
- [x] Schema de base de datos creado
- [x] Cliente Supabase configurado
- [x] Tipos TypeScript definidos
- [x] Constantes y configuración
- [x] Estilos CSS migrados
- [x] Funciones CRUD de base de datos
- [x] API routes skeleton creadas

### Fase 2-10: Por Hacer
- [ ] Componentes React
- [ ] Lógica de flujo
- [ ] Integraciones email
- [ ] Upload de documentos
- [ ] Testing
- [ ] Deploy

---

## 🆘 Troubleshooting

### Error: "NEXT_PUBLIC_SUPABASE_URL not found"
- Verificar que `.env.local` existe en la raíz del proyecto
- Confirmar que las variables están configuradas correctamente
- Reiniciar servidor de desarrollo

### Error: "Could not connect to Supabase"
- Verificar URL y keys en `.env.local`
- Confirmar que el proyecto existe en Supabase
- Verificar que la red permite conexiones a supabase.co

### Error: "RLS policy violation"
- Esto es normal en desarrollo sin usuario autenticado
- Las políticas se actualizarán en fases posteriores

---

## 📞 Contacto y Soporte

- **Proyecto:** Tamiz Regulatorio v2.0
- **Organización:** AMC Principal
- **Repositorio:** (por configurar en Vercel)
- **Plan de Implementación:** 12-13 semanas
- **Responsable:** Juan (Colombia)

---

**Última actualización:** 2026-05-27  
**Siguiente revisión:** Después de completar Fase 2

