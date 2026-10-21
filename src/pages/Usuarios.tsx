import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Check, KeyRound, LockOpen, LogOut, MailCheck, MailWarning, Pencil, Plus, Send, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { useCatalogoPermisos, useRoles, useUsuario, useUsuarios } from '../api/consultas';
import { borrarUsuario, cerrarSesionesUsuario, crearUsuario, desbloquearUsuario, editarUsuario, reenviarConfirmacion, subirFotoUsuario, type DatosUsuario } from '../api/recursos';
import type { Usuario } from '../api/tipos';
import { useSesion } from '../auth/sesion';
import { useConfirmar } from '../components/confirmar';
import { Avatar, Boton, Campo, Cargando, Casilla, EncabezadoPagina, Entrada, ErrorCarga, Insignia, Selector, Tabla, Tarjeta, Vacio } from '../components/ui';
import { cn, fecha, fechaYHora, nombreCompleto } from '../lib/formato';
import { useVolver } from '../lib/navegacion';

export function Usuarios() {
  const consulta = useUsuarios();
  const { usuario: yo, tiene } = useSesion();
  const cliente = useQueryClient();
  const navegar = useNavigate();
  const confirmar = useConfirmar();

  const borrar = useMutation({
    mutationFn: borrarUsuario,
    onSuccess: (r) => {
      for (const k of [['usuarios'], ['visitas'], ['medicos'], ['auditoria']]) cliente.invalidateQueries({ queryKey: k });
      toast.success(r.visitasReasignadas ? `Usuario eliminado. ${r.visitasReasignadas.toLocaleString('es-DO')} visitas reasignadas a ${r.reasignadasA.firstName}, con su historial intacto.` : 'Usuario eliminado');
    },
    onError: (e) => toast.error(e.message),
  });

  const desbloquear = useMutation({
    mutationFn: (u: Usuario) => desbloquearUsuario(u.id),
    onSuccess: (_, u) => {
      for (const k of [['usuarios'], ['auditoria']]) cliente.invalidateQueries({ queryKey: k });
      toast.success(`${nombreCompleto(u)} ya puede volver a entrar`);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      <EncabezadoPagina
        titulo="Usuarios"
        descripcion="Personal con acceso al sistema. Lo que cada quien puede hacer depende de su rol."
        acciones={
          <>
            {tiene('roles.gestionar') && (
              <Boton variante="secundario" icono={<KeyRound className="size-4" />} onClick={() => navegar('/roles')}>
                Roles y permisos
              </Boton>
            )}
            <Boton icono={<Plus className="size-4" />} onClick={() => navegar('/usuarios/nuevo')}>
              Nuevo usuario
            </Boton>
          </>
        }
      />
      <Tarjeta>
        {consulta.isPending ? (
          <Cargando />
        ) : consulta.isError ? (
          <ErrorCarga error={consulta.error} />
        ) : (
          <Tabla columnas={['Usuario', 'Rol', 'Estado', 'Conexión', 'Alta', { texto: '', className: 'w-24' }]}>
            {consulta.data.data.map((u) => {
              // Bloqueado por intentos fallidos: se le quita el bloqueo sin esperar los 15 minutos.
              const bloqueado = !!u.bloqueadoHasta && new Date(u.bloqueadoHasta) > new Date();
              return (
                <tr key={u.id} className="hover:bg-fondo">
                  <td className="px-5 py-3">
                    <Link to={`/usuarios/${u.id}`} className="flex items-center gap-3">
                      <Avatar persona={u} foto={u.photoUrl} tamano="size-8" />
                      <div>
                        <p className="font-medium">
                          {nombreCompleto(u)} {u.id === yo?.id && <span className="text-xs font-normal text-tenue">(tú)</span>}
                        </p>
                        <p className="text-xs text-tenue">
                          {u.usuario && <span className="font-mono text-tinta/70">{u.usuario} · </span>}
                          {u.email}
                          {!u.emailVerificadoEn && <span className="ml-1.5 text-amber-700">· sin confirmar</span>}
                        </p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-5 py-3">{u.role.name}</td>
                  <td className="px-5 py-3">
                    {bloqueado ? (
                      <div className="flex flex-col items-start gap-1">
                        <Insignia color="#dc2626">Bloqueado</Insignia>
                        <span className="text-xs whitespace-nowrap text-tenue">
                          Intentos fallidos · hasta las {new Date(u.bloqueadoHasta!).toLocaleTimeString('es-DO', { hour: 'numeric', minute: '2-digit' })}
                        </span>
                      </div>
                    ) : (
                      <Insignia color={u.isActive ? '#15803d' : undefined}>{u.isActive ? 'Activo' : 'Inactivo'}</Insignia>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <Conexion u={u} />
                  </td>
                  <td className="px-5 py-3 text-tenue">{fecha(u.createdAt)}</td>
                  <td className="px-5 py-2 text-right whitespace-nowrap">
                    {bloqueado && (
                      <Boton
                        variante="secundario"
                        className="mr-1 h-8 px-2.5 text-sm"
                        icono={<LockOpen className="size-4" />}
                        cargando={desbloquear.isPending && desbloquear.variables?.id === u.id}
                        onClick={() => desbloquear.mutate(u)}
                      >
                        Desbloquear
                      </Boton>
                    )}
                    <Boton variante="fantasma" className="h-8 px-2" aria-label="Editar" onClick={() => navegar(`/usuarios/${u.id}`)}>
                      <Pencil className="size-4" />
                    </Boton>
                    {u.id !== yo?.id && (
                      <Boton
                        variante="fantasma"
                        className="h-8 px-2 hover:text-red-600"
                        aria-label="Eliminar"
                        onClick={async () =>
                          (await confirmar({
                            titulo: `¿Eliminar a ${nombreCompleto(u)}?`,
                            mensaje: (
                              <>
                                <p>La cuenta se borra y no podrá volver a entrar.</p>
                                <p className="mt-2">
                                  Si atendió visitas, pasan a tu cuenta de administrador, pero <strong className="text-tinta">cada visita seguirá diciendo que la atendió {nombreCompleto(u)}</strong>{' '}
                                  y sus estadísticas siguen en Médicos. Queda registrado en Auditoría.
                                </p>
                                <p className="mt-2">Si solo quieres que no entre, mejor desactívalo.</p>
                              </>
                            ),
                          })) && borrar.mutate(u.id)
                        }
                      >
                        <Trash2 className="size-4" />
                      </Boton>
                    )}
                  </td>
                </tr>
              );
            })}
          </Tabla>
        )}
      </Tarjeta>
    </>
  );
}

const HACE = new Intl.RelativeTimeFormat('es-DO', { numeric: 'auto' });
/** "hace 3 minutos", "ayer", "hace 5 días"… */
function hace(iso: string) {
  const s = (new Date(iso).getTime() - Date.now()) / 1000;
  const pasos: [Intl.RelativeTimeFormatUnit, number][] = [
    ['minute', 60],
    ['hour', 3600],
    ['day', 86_400],
    ['month', 2_592_000],
  ];
  if (Math.abs(s) < 60) return 'hace un momento';
  for (let i = pasos.length - 1; i >= 0; i--) if (Math.abs(s) >= pasos[i][1]) return HACE.format(Math.round(s / pasos[i][1]), pasos[i][0]);
  return HACE.format(Math.round(s / 60), 'minute');
}

/** En línea (usó la app hace menos de 5 minutos) o cuándo fue la última vez, y cuándo inició sesión. */
function Conexion({ u }: { u: Usuario }) {
  const actividad = u.ultimaActividad ?? u.ultimoAcceso ?? null;
  const enLinea = !!u.ultimaActividad && Date.now() - new Date(u.ultimaActividad).getTime() < 5 * 60_000;
  return (
    <div className="text-sm whitespace-nowrap">
      {enLinea ? (
        <span className="flex items-center gap-1.5 font-medium text-green-700">
          <span className="relative flex size-2">
            <span className="absolute inline-flex size-full rounded-full bg-green-500 opacity-60 motion-safe:animate-ping" />
            <span className="relative inline-flex size-2 rounded-full bg-green-600" />
          </span>
          En línea
        </span>
      ) : (
        <span className="text-tenue" title={actividad ? fechaYHora(actividad) : undefined}>
          {actividad ? `Última vez ${hace(actividad)}` : 'Nunca ha entrado'}
        </span>
      )}
      {u.ultimoAcceso && <span className="block text-xs text-tenue">Entró: {fechaYHora(u.ultimoAcceso)}</span>}
    </div>
  );
}

/** /usuarios/nuevo y /usuarios/:id */
export function UsuarioEditor() {
  const id = Number(useParams().id) || undefined;
  const consulta = useUsuario(id);
  // El <select> de rol necesita sus opciones al montarse; si no, muestra el primero (Administrador).
  const roles = useRoles();
  if ((id && consulta.isPending) || !roles.data) return <Cargando />;
  if (id && !consulta.data) return <Vacio titulo="Usuario no encontrado" />;
  return <FormularioUsuario usuario={consulta.data ?? undefined} />;
}

type Datos = Omit<DatosUsuario, 'roleId'> & { roleId: string; confirmar?: string };

function FormularioUsuario({ usuario }: { usuario?: Usuario }) {
  const cliente = useQueryClient();
  const navegar = useNavigate();
  const volverA = useVolver();
  const sesion = useSesion();
  const roles = useRoles();
  const catalogo = useCatalogoPermisos();
  const esYo = usuario?.id === sesion.usuario?.id;

  const { register, handleSubmit, formState, watch, getValues } = useForm<Datos>({
    defaultValues: usuario
      ? { email: usuario.email, usuario: usuario.usuario ?? '', firstName: usuario.firstName, lastName: usuario.lastName, roleId: String(usuario.role.id), isActive: usuario.isActive, password: '', confirmar: '' }
      : { email: '', usuario: '', firstName: '', lastName: '', roleId: '', isActive: true, password: '', confirmar: '' },
  });
  const e = formState.errors;
  // La misma regla que el servidor: primer nombre.primer apellido, sin tildes.
  const limpio = (s: string) => (s.trim().split(/\s+/)[0] ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
  const sugerencia = [limpio(watch('firstName') ?? ''), limpio(watch('lastName') ?? '')].filter(Boolean).join('.');
  const rolElegido = roles.data?.find((r) => r.id === Number(watch('roleId')));

  const guardar = useMutation({
    mutationFn: ({ confirmar: _c, ...d }: Datos) => {
      const datos: Partial<DatosUsuario> = { ...d, roleId: Number(d.roleId), firstName: d.firstName.trim(), lastName: d.lastName.trim(), email: d.email.trim(), usuario: d.usuario?.trim().toLowerCase() };
      // Vacío al crear: el servidor lo arma con el nombre. Vacío al editar: se deja el que tenía.
      if (!datos.usuario) delete datos.usuario;
      if (!datos.password) delete datos.password; // vacío = no se cambia
      return usuario ? editarUsuario(usuario.id, datos) : crearUsuario(datos as DatosUsuario);
    },
    onSuccess: (u) => {
      // Un cambio de nombre se propaga a sus visitas y pacientes: se refresca todo lo que lo muestra.
      for (const k of [['usuarios'], ['pacientes'], ['paciente'], ['visitas'], ['jornada'], ['medicos'], ['auditoria']]) cliente.invalidateQueries({ queryKey: k });
      if (u.id === sesion.usuario?.id) sesion.actualizarUsuario(u);
      const r = u as Usuario & { confirmacionEnviada?: boolean };
      if (!usuario) toast.success(r.confirmacionEnviada ? `Usuario creado. Le enviamos un enlace a ${u.email} para confirmar su correo.` : 'Usuario creado. No se pudo enviar el correo de confirmación: reenvíalo desde su ficha.');
      else toast.success(u.email !== usuario.email ? `Usuario actualizado. Le enviamos un enlace a ${u.email} para confirmar el correo nuevo.` : 'Usuario actualizado');
      volverA('/usuarios');
    },
    onError: (err) => toast.error(err.message === 'User with this email already exists' ? 'Ya existe un usuario con ese correo.' : err.message),
  });

  return (
    <>
      <EncabezadoPagina titulo={usuario ? nombreCompleto(usuario) : 'Nuevo usuario'} volver={{ a: '/usuarios', texto: 'Usuarios' }} />
      <form onSubmit={handleSubmit((d) => guardar.mutate(d))} className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]" noValidate>
        <div className="space-y-4">
          <Tarjeta titulo="Datos personales">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Campo etiqueta="Nombres" error={e.firstName && 'Requerido'}>
                <Entrada {...register('firstName', { required: true, validate: (v) => !!v.trim() })} aria-invalid={!!e.firstName} />
              </Campo>
              <Campo etiqueta="Apellidos" error={e.lastName && 'Requerido'}>
                <Entrada {...register('lastName', { required: true, validate: (v) => !!v.trim() })} aria-invalid={!!e.lastName} />
              </Campo>
              <Campo
                etiqueta="Usuario para entrar"
                error={e.usuario && 'De 3 a 30 letras sin tilde, números, punto o guion'}
                ayuda={usuario ? 'Puede entrar con este usuario o con su correo.' : `Si lo dejas vacío: ${sugerencia || 'nombre.apellido'}`}
              >
                <Entrada
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder={sugerencia || 'nombre.apellido'}
                  className="font-mono"
                  {...register('usuario', { pattern: /^[a-zA-Z0-9._-]{3,30}$/ })}
                  aria-invalid={!!e.usuario}
                />
              </Campo>
              <Campo etiqueta="Correo" error={e.email && 'Correo no válido'} ayuda="Para recuperar la contraseña. También sirve para entrar.">
                <Entrada type="email" autoComplete="off" {...register('email', { required: true, pattern: /^\S+@\S+\.\S+$/ })} aria-invalid={!!e.email} />
              </Campo>
            </div>
          </Tarjeta>

          <Tarjeta titulo={usuario ? 'Cambiar contraseña' : 'Contraseña'}>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Campo etiqueta={usuario ? 'Nueva contraseña' : 'Contraseña'} error={e.password && 'Entre 8 y 72 caracteres'} ayuda={usuario ? 'Déjala vacía para no cambiarla. Se cerrarán sus sesiones abiertas.' : 'Al menos 8 caracteres.'}>
                <Entrada
                  type="password"
                  autoComplete="new-password"
                  {...register('password', { required: !usuario, validate: (v) => !v || (v.length >= 8 && v.length <= 72) })}
                  aria-invalid={!!e.password}
                />
              </Campo>
              <Campo etiqueta="Repetir contraseña" error={e.confirmar && 'No coincide'}>
                <Entrada
                  type="password"
                  autoComplete="new-password"
                  {...register('confirmar', { validate: (v) => (v ?? '') === (getValues('password') ?? '') })}
                  aria-invalid={!!e.confirmar}
                />
              </Campo>
            </div>
          </Tarjeta>

          <Tarjeta titulo="Acceso">
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Campo etiqueta="Rol" error={e.roleId && 'Elige un rol'} ayuda={esYo ? 'No puedes cambiar tu propio rol.' : rolElegido?.description ?? undefined}>
                <Selector
                  vacio={usuario ? undefined : 'Elegir…'}
                  disabled={esYo}
                  opciones={(roles.data ?? []).map((r) => ({ value: r.id, label: r.name }))}
                  {...register('roleId', { required: true })}
                  aria-invalid={!!e.roleId}
                />
              </Campo>
              <div className="flex items-end pb-2">
                <Casilla etiqueta="Activo (puede iniciar sesión)" disabled={esYo} {...register('isActive')} />
              </div>
            </div>
            {rolElegido && catalogo.data && (
              <div className="border-t border-borde px-5 py-4">
                <p className="mb-3 text-xs font-medium tracking-wide text-tenue uppercase">Lo que podrá hacer como {rolElegido.name}</p>
                <ul className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                  {catalogo.data.flatMap((g) => g.permisos).map((p) => {
                    const si = rolElegido.permissions.includes(p.clave);
                    return (
                      <li key={p.clave} className={cn('flex items-start gap-2', !si && 'text-tenue/60 line-through')}>
                        <Check className={cn('mt-0.5 size-4 shrink-0', si ? 'text-marca-600' : 'opacity-0')} />
                        {p.nombre}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </Tarjeta>

          <div className="flex justify-end gap-2">
            <Boton variante="secundario" onClick={() => navegar('/usuarios')}>
              Cancelar
            </Boton>
            <Boton type="submit" cargando={guardar.isPending}>
              {usuario ? 'Guardar cambios' : 'Crear usuario'}
            </Boton>
          </div>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          {usuario ? (
            <div className="space-y-4">
              <FotoUsuario usuario={usuario} />
              <CorreoUsuario usuario={usuario} />
              {!esYo && <SesionesUsuario usuario={usuario} />}
            </div>
          ) : (
            <Tarjeta titulo="Foto">
              <p className="p-5 text-sm text-tenue">Podrás subir la foto después de crear el usuario.</p>
            </Tarjeta>
          )}
        </aside>
      </form>
    </>
  );
}

function CorreoUsuario({ usuario }: { usuario: Usuario }) {
  const reenviar = useMutation({
    mutationFn: () => reenviarConfirmacion(usuario.id),
    onSuccess: (r) => toast.success(r.simulado ? 'Enlace generado: el servidor no tiene correo configurado (está en la consola del backend).' : `Enlace enviado a ${r.email}.`),
    onError: (e) => toast.error(e.message),
  });
  return (
    <Tarjeta titulo="Correo">
      <div className="space-y-3 p-5 text-sm">
        {usuario.emailVerificadoEn ? (
          <p className="flex items-center gap-2 text-green-800">
            <MailCheck className="size-4" /> Confirmado el {fecha(usuario.emailVerificadoEn)}
          </p>
        ) : (
          <>
            <p className="flex items-center gap-2 text-amber-800">
              <MailWarning className="size-4" /> Sin confirmar
            </p>
            <p className="text-tenue">Hasta que lo confirme no puede recibir los resúmenes de las jornadas.</p>
            <Boton variante="secundario" icono={<Send className="size-4" />} cargando={reenviar.isPending} onClick={() => reenviar.mutate()}>
              Reenviar enlace
            </Boton>
          </>
        )}
      </div>
    </Tarjeta>
  );
}

/** Cerrar todas sus sesiones: si se perdió o se robaron una tablet, o dejó una sesión abierta en otra computadora. */
function SesionesUsuario({ usuario }: { usuario: Usuario }) {
  const cliente = useQueryClient();
  const confirmar = useConfirmar();
  const cerrar = useMutation({
    mutationFn: () => cerrarSesionesUsuario(usuario.id),
    onSuccess: () => {
      for (const k of [['usuarios'], ['usuario', usuario.id], ['auditoria']]) cliente.invalidateQueries({ queryKey: k });
      toast.success(`Listo: a ${nombreCompleto(usuario)} se le cierra la app en todos sus dispositivos en unos segundos.`);
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Tarjeta titulo="Sesiones">
      <div className="space-y-3 p-5 text-sm">
        <p className="text-tenue">
          Último inicio de sesión: <span className="text-tinta">{usuario.ultimoAcceso ? fechaYHora(usuario.ultimoAcceso) : 'nunca'}</span>
        </p>
        <Boton
          variante="secundario"
          className="w-full"
          icono={<LogOut className="size-4" />}
          cargando={cerrar.isPending}
          onClick={async () =>
            (await confirmar({
              titulo: `¿Cerrar todas las sesiones de ${nombreCompleto(usuario)}?`,
              mensaje: (
                <>
                  <p>En cada tableta, teléfono o computadora donde tenga la app abierta se le cierra en unos segundos, y tendrá que volver a entrar con su contraseña.</p>
                  <p className="mt-2">Úsalo si se perdió una tableta o dejó una sesión abierta en otro equipo. Lo que haya guardado sin internet no se pierde: se envía cuando vuelva a entrar.</p>
                </>
              ),
              confirmar: 'Cerrar sesiones',
            })) && cerrar.mutate()
          }
        >
          Cerrar todas sus sesiones
        </Boton>
      </div>
    </Tarjeta>
  );
}

function FotoUsuario({ usuario }: { usuario: Usuario }) {
  const input = useRef<HTMLInputElement>(null);
  const cliente = useQueryClient();
  const sesion = useSesion();
  const subir = useMutation({
    mutationFn: (f: File) => subirFotoUsuario(usuario.id, f),
    onSuccess: (u) => {
      cliente.invalidateQueries({ queryKey: ['usuarios'] });
      if (u.id === sesion.usuario?.id) sesion.actualizarUsuario({ photoUrl: u.photoUrl });
      toast.success('Foto actualizada');
    },
    onError: (e) => toast.error(e.message),
  });
  const foto = subir.data?.photoUrl ?? usuario.photoUrl;
  return (
    <Tarjeta titulo="Foto">
      <div className="flex flex-col items-center gap-4 p-5">
        <Avatar persona={usuario} foto={foto} tamano="size-28 text-2xl" />
        <Boton variante="secundario" icono={<Camera className="size-4" />} cargando={subir.isPending} onClick={() => input.current?.click()}>
          {foto ? 'Cambiar foto' : 'Subir foto'}
        </Boton>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) subir.mutate(f);
            e.target.value = '';
          }}
        />
      </div>
    </Tarjeta>
  );
}
