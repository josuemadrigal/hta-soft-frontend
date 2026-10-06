import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { useCatalogoPermisos, useRol, useRoles } from '../api/consultas';
import { borrarRol, crearRol, editarRol, type DatosRol } from '../api/recursos';
import type { Rol } from '../api/tipos';
import { useConfirmar } from '../components/confirmar';
import { Boton, Campo, Cargando, EncabezadoPagina, Entrada, ErrorCarga, Insignia, Tabla, Tarjeta, Vacio } from '../components/ui';
import { cn } from '../lib/formato';

export function Roles() {
  const consulta = useRoles();
  const catalogo = useCatalogoPermisos();
  const cliente = useQueryClient();
  const navegar = useNavigate();
  const confirmar = useConfirmar();
  const total = catalogo.data?.reduce((a, g) => a + g.permisos.length, 0);

  const borrar = useMutation({
    mutationFn: borrarRol,
    onSuccess: () => {
      cliente.invalidateQueries({ queryKey: ['roles'] });
      toast.success('Rol eliminado');
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      <EncabezadoPagina
        titulo="Roles y permisos"
        descripcion="Cada usuario tiene un rol; el rol define qué puede ver y hacer."
        volver={{ a: '/usuarios', texto: 'Usuarios' }}
        acciones={
          <Boton icono={<Plus className="size-4" />} onClick={() => navegar('/roles/nuevo')}>
            Nuevo rol
          </Boton>
        }
      />
      <Tarjeta>
        {consulta.isPending ? (
          <Cargando />
        ) : consulta.isError ? (
          <ErrorCarga error={consulta.error} />
        ) : (
          <Tabla columnas={['Rol', 'Permisos', 'Usuarios', { texto: '', className: 'w-24' }]}>
            {consulta.data.map((r) => (
              <tr key={r.id} className="hover:bg-fondo">
                <td className="px-5 py-3">
                  <p className="flex items-center gap-1.5 font-medium">
                    {r.name} {r.isSystem && <Lock className="size-3.5 text-tenue" />}
                  </p>
                  {r.description && <p className="text-xs text-tenue">{r.description}</p>}
                </td>
                <td className="tabular px-5 py-3">
                  {r.permissions.length}
                  {total && <span className="text-tenue"> de {total}</span>}
                </td>
                <td className="tabular px-5 py-3">{r._count?.users ?? 0}</td>
                <td className="px-5 py-2 text-right whitespace-nowrap">
                  <Boton variante="fantasma" className="h-8 px-2" aria-label="Editar" onClick={() => navegar(`/roles/${r.id}`)}>
                    <Pencil className="size-4" />
                  </Boton>
                  {!r.isSystem && (
                    <Boton
                      variante="fantasma"
                      className="h-8 px-2 hover:text-red-600"
                      aria-label="Eliminar"
                      onClick={async () =>
                        (await confirmar({
                          titulo: `¿Eliminar el rol ${r.name}?`,
                          mensaje: r._count?.users ? `Tiene ${r._count.users} usuario(s): cámbialos de rol antes de eliminarlo.` : 'Nadie tiene este rol asignado.',
                        })) && borrar.mutate(r.id)
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

/** /roles/nuevo y /roles/:id */
export function RolEditor() {
  const id = Number(useParams().id) || undefined;
  const consulta = useRol(id);
  if (id && consulta.isPending) return <Cargando />;
  if (id && !consulta.data) return <Vacio titulo="Rol no encontrado" />;
  return <FormularioRol rol={consulta.data} />;
}

function FormularioRol({ rol }: { rol?: Rol }) {
  const cliente = useQueryClient();
  const navegar = useNavigate();
  const catalogo = useCatalogoPermisos();
  const bloqueado = !!rol?.isSystem;
  const { register, handleSubmit, formState, watch, setValue } = useForm<DatosRol>({
    defaultValues: rol ? { name: rol.name, description: rol.description ?? '', permissions: rol.permissions } : { name: '', description: '', permissions: [] },
  });
  const permisos = watch('permissions');

  const guardar = useMutation({
    mutationFn: (d: DatosRol) => {
      const datos = { ...d, name: d.name.trim(), description: d.description?.trim() || undefined };
      // El Administrador solo admite cambiar la descripción.
      return rol ? editarRol(rol.id, bloqueado ? { description: datos.description } : datos) : crearRol(datos);
    },
    onSuccess: () => {
      cliente.invalidateQueries({ queryKey: ['roles'] });
      cliente.invalidateQueries({ queryKey: ['usuarios'] });
      toast.success(rol ? 'Rol actualizado' : 'Rol creado');
      navegar('/roles');
    },
    onError: (e) => toast.error(e.message),
  });

  const alternarGrupo = (claves: string[], marcar: boolean) =>
    setValue('permissions', marcar ? [...new Set([...permisos, ...claves])] : permisos.filter((p) => !claves.includes(p)), { shouldDirty: true });

  return (
    <>
      <EncabezadoPagina titulo={rol ? `Rol ${rol.name}` : 'Nuevo rol'} volver={{ a: '/roles', texto: 'Roles y permisos' }} />
      <form onSubmit={handleSubmit((d) => guardar.mutate(d))} className="max-w-3xl space-y-4">
        <Tarjeta titulo="Rol">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Campo etiqueta="Nombre" error={formState.errors.name && 'Requerido'}>
              <Entrada disabled={bloqueado} {...register('name', { required: true, validate: (v) => !!v.trim() })} placeholder="Promotor de salud" />
            </Campo>
            <Campo etiqueta="Descripción" ayuda="Opcional">
              <Entrada {...register('description')} />
            </Campo>
          </div>
          {bloqueado && (
            <p className="flex items-center gap-2 border-t border-borde px-5 py-3 text-sm text-tenue">
              <Lock className="size-4" /> El Administrador siempre tiene todos los permisos, para que nunca se pierda el acceso a la configuración.
            </p>
          )}
        </Tarjeta>

        <Tarjeta titulo="Permisos" accion={<Insignia>{permisos.length} marcados</Insignia>}>
          {!catalogo.data ? (
            <Cargando />
          ) : (
            <div className="divide-y divide-borde">
              {catalogo.data.map((g) => {
                const claves = g.permisos.map((p) => p.clave);
                const todos = claves.every((c) => permisos.includes(c));
                return (
                  <fieldset key={g.grupo} disabled={bloqueado} className="px-5 py-4">
                    <div className="mb-3 flex items-center justify-between">
                      <legend className="text-xs font-semibold tracking-wider text-tenue uppercase">{g.grupo}</legend>
                      {!bloqueado && (
                        <button type="button" onClick={() => alternarGrupo(claves, !todos)} className="text-xs font-medium text-marca-700 hover:underline">
                          {todos ? 'Quitar todos' : 'Marcar todos'}
                        </button>
                      )}
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {g.permisos.map((p) => (
                        <label
                          key={p.clave}
                          className={cn(
                            'flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm transition-colors',
                            permisos.includes(p.clave) ? 'border-marca-200 bg-marca-50' : 'border-borde hover:bg-fondo',
                            bloqueado && 'cursor-default',
                          )}
                        >
                          <input type="checkbox" value={p.clave} {...register('permissions')} className="mt-0.5 size-4 accent-marca-600" />
                          <span>
                            {p.nombre}
                            <span className="block font-mono text-[11px] text-tenue">{p.clave}</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                );
              })}
            </div>
          )}
        </Tarjeta>

        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={() => navegar('/roles')}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={guardar.isPending}>
            {rol ? 'Guardar cambios' : 'Crear rol'}
          </Boton>
        </div>
      </form>
    </>
  );
}
