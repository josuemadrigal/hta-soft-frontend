import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Pencil, Plus } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { useComunidad, useComunidades } from '../api/consultas';
import { crearComunidad, editarComunidad } from '../api/recursos';
import type { Comunidad } from '../api/tipos';
import { useSesion } from '../auth/sesion';
import { SelectorUbicacion } from '../components/Mapa';
import { Boton, Campo, Cargando, Casilla, EncabezadoPagina, Entrada, ErrorCarga, Insignia, Tabla, Tarjeta, Vacio } from '../components/ui';

export function Comunidades() {
  const consulta = useComunidades();
  const navegar = useNavigate();
  const puedeGestionar = useSesion().tiene('comunidades.gestionar');

  return (
    <>
      <EncabezadoPagina
        titulo="Bateyes"
        descripcion="Cada batey tiene su propia secuencia de códigos de paciente."
        acciones={
          puedeGestionar && (
            <Boton icono={<Plus className="size-4" />} onClick={() => navegar('/comunidades/nueva')}>
              Nuevo batey
            </Boton>
          )
        }
      />
      <Tarjeta>
        {consulta.isPending ? (
          <Cargando />
        ) : consulta.isError ? (
          <ErrorCarga error={consulta.error} />
        ) : consulta.data.length === 0 ? (
          <Vacio icono={<MapPin className="size-8" />} titulo="Sin bateyes" />
        ) : (
          <Tabla columnas={['Batey', 'Prefijo', 'Municipio', 'Provincia', 'Próximo código', 'Estado', { texto: '', className: 'w-14' }]}>
            {consulta.data.map((c) => (
              <tr key={c.id} className="hover:bg-fondo">
                <td className="px-5 py-3 font-medium">{c.name}</td>
                <td className="px-5 py-3 font-mono text-[13px]">{c.abbreviation}</td>
                <td className="px-5 py-3">{c.municipality}</td>
                <td className="px-5 py-3">{c.province}</td>
                <td className="px-5 py-3 font-mono text-[13px] text-tenue">
                  {c.abbreviation}
                  {c.sequenceCounter + 1}
                </td>
                <td className="px-5 py-3">
                  <Insignia color={c.isActive ? '#15803d' : undefined}>{c.isActive ? 'Activo' : 'Inactivo'}</Insignia>
                </td>
                <td className="px-5 py-2 text-right">
                  {puedeGestionar && (
                    <Boton variante="fantasma" className="h-8 px-2" aria-label="Editar" onClick={() => navegar(`/comunidades/${c.id}`)}>
                      <Pencil className="size-4" />
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

/** /comunidades/nueva y /comunidades/:id */
export function ComunidadEditor() {
  const id = Number(useParams().id) || undefined;
  const consulta = useComunidad(id);
  if (id && consulta.isPending) return <Cargando />;
  if (id && !consulta.data) return <Vacio titulo="Batey no encontrado" />;
  return <FormularioComunidad comunidad={consulta.data ?? undefined} />;
}

type Datos = Omit<Comunidad, 'id'>;

function FormularioComunidad({ comunidad }: { comunidad?: Comunidad }) {
  const cliente = useQueryClient();
  const navegar = useNavigate();
  const { register, handleSubmit, watch, formState } = useForm<Datos>({
    defaultValues: comunidad ?? { name: '', abbreviation: '', municipality: '', province: '', sequenceCounter: 1000, isActive: true },
  });
  const [ubicacion, setUbicacion] = useState(comunidad?.latitud != null && comunidad.longitud != null ? { lat: comunidad.latitud, lng: comunidad.longitud } : null);
  const guardar = useMutation({
    mutationFn: (d: Datos) => {
      const base = {
        name: d.name.trim(),
        municipality: d.municipality.trim(),
        province: d.province.trim(),
        isActive: d.isActive,
        latitud: ubicacion?.lat ?? null,
        longitud: ubicacion?.lng ?? null,
      };
      return comunidad
        ? editarComunidad(comunidad.id, base)
        : crearComunidad({ ...base, abbreviation: d.abbreviation.trim().toUpperCase(), sequenceCounter: Number(d.sequenceCounter) });
    },
    onSuccess: () => {
      cliente.invalidateQueries({ queryKey: ['comunidades'] });
      cliente.invalidateQueries({ queryKey: ['bateyes-indicadores'] });
      toast.success(comunidad ? 'Batey actualizado' : 'Batey creado');
      navegar('/comunidades');
    },
    onError: (e) => toast.error(e.message === 'Abbreviation already exists' ? 'Ya existe un batey con ese prefijo.' : e.message),
  });
  const e = formState.errors;
  const requerido = { required: true, validate: (v: unknown) => typeof v === 'string' && !!v.trim() };
  const [abrev, seq] = watch(['abbreviation', 'sequenceCounter']);

  return (
    <>
      <EncabezadoPagina titulo={comunidad ? comunidad.name : 'Nuevo batey'} volver={{ a: '/comunidades', texto: 'Bateyes' }} />
      <form onSubmit={handleSubmit((d) => guardar.mutate(d))} className="max-w-2xl space-y-4">
        <Tarjeta titulo="Batey">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Campo etiqueta="Nombre" error={e.name && 'Requerido'} className="sm:col-span-2">
              <Entrada {...register('name', requerido)} aria-invalid={!!e.name} />
            </Campo>
            <Campo etiqueta="Municipio" error={e.municipality && 'Requerido'}>
              <Entrada {...register('municipality', requerido)} aria-invalid={!!e.municipality} />
            </Campo>
            <Campo etiqueta="Provincia" error={e.province && 'Requerida'}>
              <Entrada {...register('province', requerido)} aria-invalid={!!e.province} />
            </Campo>
            <Campo
              etiqueta="Prefijo de códigos"
              error={e.abbreviation && 'De 2 a 6 letras o números'}
              ayuda={comunidad ? 'No se cambia: ya hay códigos emitidos con este prefijo.' : 'Ej.: MG para Magdalena'}
            >
              <Entrada
                className="uppercase"
                maxLength={6}
                disabled={!!comunidad}
                {...register('abbreviation', { required: !comunidad, pattern: comunidad ? undefined : /^[A-Za-z0-9]{2,6}$/ })}
                aria-invalid={!!e.abbreviation}
              />
            </Campo>
            {!comunidad && (
              <Campo etiqueta="Secuencia inicial" ayuda={`Primer código: ${(abrev || 'XX').toUpperCase()}${Number(seq || 0) + 1}`}>
                <Entrada type="number" min={0} {...register('sequenceCounter', { valueAsNumber: true, min: 0 })} />
              </Campo>
            )}
            <Casilla etiqueta="Activo (aparece en la jornada y en los formularios)" className="sm:col-span-2" {...register('isActive')} />
          </div>
        </Tarjeta>
        <Tarjeta
          titulo="Ubicación en el mapa"
          accion={
            ubicacion ? (
              <button type="button" onClick={() => setUbicacion(null)} className="text-xs text-tenue hover:text-red-600">
                Quitar ubicación
              </button>
            ) : (
              <span className="text-xs text-tenue">Toca el mapa donde está el batey</span>
            )
          }
        >
          <div className="p-3">
            <SelectorUbicacion valor={ubicacion} alCambiar={setUbicacion} />
          </div>
          <p className="border-t border-borde px-5 py-2.5 text-xs text-tenue">
            {ubicacion ? `${ubicacion.lat}, ${ubicacion.lng} · toca otro punto para moverlo` : 'Sin ubicación: no aparece en el mapa de bateyes.'}
          </p>
        </Tarjeta>
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={() => navegar('/comunidades')}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={guardar.isPending}>
            {comunidad ? 'Guardar cambios' : 'Crear batey'}
          </Boton>
        </div>
      </form>
    </>
  );
}
