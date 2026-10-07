import {
  Activity,
  Map as IconoMapa,
  Target,
  ShieldCheck,
  CalendarDays,
  ClipboardList,
  ChartColumn,
  KeyRound,
  Gauge,
  History,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Pill,
  Settings,
  Stethoscope,
  Tent,
  Users,
  UserRoundCog,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';
import { useConfirmar } from './confirmar';
import { useEstadoSincronizacion, usePendientes } from '../offline/cola';
import { useEnLinea } from '../offline/datos';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { useSesion } from '../auth/sesion';
import { cn, nombreCompleto } from '../lib/formato';
import { Avatar } from './ui';

type Enlace = { a: string; texto: string; icono: typeof Users; permiso?: string };

const SECCIONES: { titulo: string; enlaces: Enlace[] }[] = [
  {
    titulo: 'Atención',
    enlaces: [
      { a: '/', texto: 'Panel', icono: LayoutDashboard },
      { a: '/jornadas', texto: 'Jornadas', icono: CalendarDays, permiso: 'pacientes.ver' },
      { a: '/jornada', texto: 'Registro en jornada', icono: Tent, permiso: 'visitas.registrar' },
      { a: '/pacientes', texto: 'Pacientes', icono: Users, permiso: 'pacientes.ver' },
      { a: '/visitas', texto: 'Visitas', icono: ClipboardList, permiso: 'pacientes.ver' },
      { a: '/medicamentos', texto: 'Inventario', icono: Pill },
    ],
  },
  {
    titulo: 'Información',
    enlaces: [
      { a: '/reportes', texto: 'Reportes', icono: ChartColumn, permiso: 'reportes.ver' },
      { a: '/metas', texto: 'Metas', icono: Target, permiso: 'reportes.ver' },
      { a: '/mapa', texto: 'Mapa de bateyes', icono: IconoMapa, permiso: 'pacientes.ver' },
      { a: '/medicos', texto: 'Médicos', icono: Stethoscope, permiso: 'medicos.ver' },
      { a: '/auditoria', texto: 'Auditoría', icono: History, permiso: 'auditoria.ver' },
      { a: '/revision', texto: 'Revisión de datos', icono: ShieldCheck, permiso: 'datos.revisar' },
    ],
  },
  {
    titulo: 'Configuración',
    enlaces: [
      { a: '/comunidades', texto: 'Bateyes', icono: MapPin },
      { a: '/clasificacion', texto: 'Clasificación PA', icono: Gauge, permiso: 'clasificacion.gestionar' },
      { a: '/usuarios', texto: 'Usuarios', icono: UserRoundCog, permiso: 'usuarios.gestionar' },
      { a: '/roles', texto: 'Roles y permisos', icono: KeyRound, permiso: 'roles.gestionar' },
      { a: '/configuracion', texto: 'Configuración', icono: Settings, permiso: 'configuracion.gestionar' },
    ],
  },
];

function Navegacion({ alNavegar }: { alNavegar?: () => void }) {
  const { usuario, tiene, salir } = useSesion();
  const pendientes = usePendientes();
  const confirmar = useConfirmar();
  // Cerrar sesión borra lo descargado, pero no lo registrado sin internet (se envía al volver a entrar).
  const pedirSalir = async () => {
    if (
      pendientes.length &&
      !(await confirmar({
        titulo: 'Hay registros sin enviar',
        mensaje: `${pendientes.length} ${pendientes.length === 1 ? 'registro hecho' : 'registros hechos'} sin internet todavía no ${pendientes.length === 1 ? 'se ha enviado' : 'se han enviado'}. Quedan guardados en este dispositivo y se enviarán cuando alguien vuelva a entrar con conexión.`,
        confirmar: 'Cerrar sesión',
        peligro: false,
      }))
    )
      return;
    salir();
  };
  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pt-5 pb-4">
        <img src="/logo.webp" alt="Light a Candle · Dominican Republic" className="w-full max-w-[200px]" />
        <p className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-tenue">
          <Activity className="size-3.5" strokeWidth={2.5} /> HTA-Soft · Control de hipertensión
        </p>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2">
        {SECCIONES.map((s) => {
          const visibles = s.enlaces.filter((e) => !e.permiso || tiene(e.permiso));
          if (!visibles.length) return null;
          return (
            <div key={s.titulo}>
              <p className="mb-1.5 px-3 text-[11px] font-semibold tracking-wider text-tenue/80 uppercase">{s.titulo}</p>
              <ul className="space-y-0.5">
                {visibles.map(({ a, texto, icono: Icono }) => (
                  <li key={a}>
                    <NavLink
                      to={a}
                      end={a === '/'}
                      onClick={alNavegar}
                      className={({ isActive }) =>
                        cn(
                          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-marca-100 font-semibold text-tinta shadow-[inset_3px_0_0_var(--color-marca-500)]'
                            : 'text-tinta/70 hover:bg-black/[0.04] hover:text-tinta',
                        )
                      }
                    >
                      <Icono className="size-4" />
                      {texto}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>

      {usuario && (
        <div className="flex items-center gap-3 border-t border-borde px-4 py-4">
          <Avatar persona={usuario} foto={usuario.photoUrl} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium">{nombreCompleto(usuario)}</p>
            <p className="truncate text-xs text-tenue">{usuario.role?.name}</p>
          </div>
          <button onClick={() => void pedirSalir()} className="rounded-md p-2 text-tenue hover:bg-black/5 hover:text-tinta" title="Cerrar sesión" aria-label="Cerrar sesión">
            <LogOut className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}

export function Layout() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const { pathname } = useLocation();

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)] print:block">
      <aside className="sticky top-0 hidden h-dvh border-r border-borde bg-superficie lg:block print:hidden">
        <Navegacion />
      </aside>

      {/* Móvil: barra superior + cajón */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-borde bg-superficie/90 px-4 py-3 backdrop-blur lg:hidden print:hidden">
        <span className="flex items-center gap-2 font-semibold">
          <img src="/logo-mapa.png" alt="" className="h-6 w-auto" /> HTA-Soft
        </span>
        <button onClick={() => setMenuAbierto(true)} className="rounded-md p-1.5 hover:bg-black/5" aria-label="Abrir menú">
          <Menu className="size-5" />
        </button>
      </div>
      {menuAbierto && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-tinta/40" onClick={() => setMenuAbierto(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-superficie shadow-xl">
            <button onClick={() => setMenuAbierto(false)} className="absolute top-4 right-3 rounded-md p-1.5 hover:bg-black/5" aria-label="Cerrar menú">
              <X className="size-4" />
            </button>
            <Navegacion alNavegar={() => setMenuAbierto(false)} />
          </aside>
        </div>
      )}

      <main key={pathname} className="mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6 lg:px-10 lg:py-9 print:max-w-none print:p-0">
        <AvisoConexion />
        <Outlet />
      </main>
    </div>
  );
}

/** Barra de conexión: sin internet, o con registros esperando a enviarse. */
function AvisoConexion() {
  const enLinea = useEnLinea();
  const pendientes = usePendientes();
  const estado = useEstadoSincronizacion();
  const conError = pendientes.filter((p) => p.error).length;
  if (enLinea && !pendientes.length) return null;
  return (
    <Link
      to="/sincronizacion"
      className={cn(
        'mb-4 flex items-center gap-3 rounded-xl border px-4 py-2.5 text-sm print:hidden',
        !enLinea ? 'border-amber-300 bg-marca-50' : conError ? 'border-red-200 bg-red-50 text-red-800' : 'border-borde bg-superficie',
      )}
    >
      {enLinea ? <RefreshCw className={cn('size-4 shrink-0', estado.sincronizando && 'animate-spin')} /> : <CloudOff className="size-4 shrink-0" />}
      <span className="flex-1">
        {!enLinea ? <strong>Sin conexión.</strong> : estado.sincronizando ? 'Enviando lo registrado sin internet…' : null}{' '}
        {pendientes.length > 0
          ? `${pendientes.length} ${pendientes.length === 1 ? 'registro guardado' : 'registros guardados'} en este dispositivo${conError ? `, ${conError} con error` : ''}.`
          : 'Puedes seguir registrando en los bateyes descargados: se enviará solo al volver la señal.'}
      </span>
      <span className="text-xs font-medium underline">Ver</span>
    </Link>
  );
}
