import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Camera, Check, KeyRound, Pencil, Plus, Trash2 } from 'lucide-react';
import { useRef } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { useCatalogoPermisos, useRoles, useUsuario, useUsuarios } from '../api/consultas';
import { borrarUsuario, crearUsuario, editarUsuario, subirFotoUsuario, type DatosUsuario } from '../api/recursos';
import type { Usuario } from '../api/tipos';
import { useSesion } from '../auth/sesion';
import { useConfirmar } from '../components/confirmar';
import { Avatar, Boton, Campo, Cargando, Casilla, EncabezadoPagina, Entrada, ErrorCarga, Insignia, Selector, Tabla, Tarjeta, Vacio } from '../components/ui';
import { cn, fecha, nombreCompleto } from '../lib/formato';

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
          <Tabla columnas={['Usuario', 'Rol', 'Estado', 'Alta', { texto: '', className: 'w-24' }]}>
            {consulta.data.data.map((u) => (
              <tr key={u.id} className="hover:bg-fondo">
                <td className="px-5 py-3">
                  <Link to={`/usuarios/${u.id}`} className="flex items-center gap-3">
                    <Avatar persona={u} foto={u.photoUrl} tamano="size-8" />
                    <div>
                      <p className="font-medium">
                        {nombreCompleto(u)} {u.id === yo?.id && <span className="text-xs font-normal text-tenue">(tú)</span>}
                      </p>
                      <p className="text-xs text-tenue">{u.email}</p>
                    </div>
                  </Link>
                </td>
                <td className="px-5 py-3">{u.role.name}</td>
                <td className="px-5 py-3">
                  <Insignia color={u.isActive ? '#15803d' : undefined}>{u.isActive ? 'Activo' : 'Inactivo'}</Insignia>
                </td>
                <td className="px-5 py-3 text-tenue">{fecha(u.createdAt)}</td>
                <td className="px-5 py-2 text-right whitespace-nowrap">
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
            ))}
          </Tabla>
        )}
      </Tarjeta>
    </>
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
  const sesion = useSesion();
  const roles = useRoles();
  const catalogo = useCatalogoPermisos();
  const esYo = usuario?.id === sesion.usuario?.id;

  const { register, handleSubmit, formState, watch, getValues } = useForm<Datos>({
    defaultValues: usuario
      ? { email: usuario.email, firstName: usuario.firstName, lastName: usuario.lastName, roleId: String(usuario.role.id), isActive: usuario.isActive, password: '', confirmar: '' }
      : { email: '', firstName: '', lastName: '', roleId: '', isActive: true, password: '', confirmar: '' },
  });
  const e = formState.errors;
  const rolElegido = roles.data?.find((r) => r.id === Number(watch('roleId')));

  const guardar = useMutation({
    mutationFn: ({ confirmar: _c, ...d }: Datos) => {
      const datos: Partial<DatosUsuario> = { ...d, roleId: Number(d.roleId), firstName: d.firstName.trim(), lastName: d.lastName.trim(), email: d.email.trim() };
      if (!datos.password) delete datos.password; // vacío = no se cambia
      return usuario ? editarUsuario(usuario.id, datos) : crearUsuario(datos as DatosUsuario);
    },
    onSuccess: (u) => {
      // Un cambio de nombre se propaga a sus visitas y pacientes: se refresca todo lo que lo muestra.
      for (const k of [['usuarios'], ['pacientes'], ['paciente'], ['visitas'], ['jornada'], ['medicos'], ['auditoria']]) cliente.invalidateQueries({ queryKey: k });
      if (u.id === sesion.usuario?.id) sesion.actualizarUsuario(u);
      toast.success(usuario ? 'Usuario actualizado' : 'Usuario creado');
      navegar('/usuarios');
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
              <Campo etiqueta="Correo (usuario para entrar)" error={e.email && 'Correo no válido'} className="sm:col-span-2">
                <Entrada type="email" autoComplete="off" {...register('email', { required: true, pattern: /^\S+@\S+\.\S+$/ })} aria-invalid={!!e.email} />
              </Campo>
            </div>
          </Tarjeta>

          <Tarjeta titulo={usuario ? 'Cambiar contraseña' : 'Contraseña'}>
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              <Campo etiqueta={usuario ? 'Nueva contraseña' : 'Contraseña'} error={e.password && 'Mínimo 6 caracteres'} ayuda={usuario ? 'Déjala vacía para no cambiarla.' : 'Mínimo 6 caracteres.'}>
                <Entrada
                  type="password"
                  autoComplete="new-password"
                  {...register('password', { required: !usuario, validate: (v) => !v || v.length >= 6 })}
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
            <FotoUsuario usuario={usuario} />
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
