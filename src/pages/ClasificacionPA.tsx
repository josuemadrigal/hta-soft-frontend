import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { useConfigPA, useConfigPAUna } from '../api/consultas';
import { borrarConfigPA, crearConfigPA, editarConfigPA } from '../api/recursos';
import type { ConfigPA } from '../api/tipos';
import { useConfirmar } from '../components/confirmar';
import { Boton, Campo, Cargando, EncabezadoPagina, Entrada, ErrorCarga, InsigniaCategoria, Selector, Tabla, Tarjeta, Vacio } from '../components/ui';
import { CATEGORIAS, colorCategoria, opciones } from '../lib/etiquetas';

export function ClasificacionPA() {
  const consulta = useConfigPA();
  const cliente = useQueryClient();
  const navegar = useNavigate();
  const confirmar = useConfirmar();

  const borrar = useMutation({
    mutationFn: borrarConfigPA,
    onSuccess: () => {
      cliente.invalidateQueries({ queryKey: ['config-pa'] });
      toast.success('Rango eliminado');
    },
    onError: () => toast.error('No se puede eliminar: hay visitas clasificadas con este rango.'),
  });

  const lista = [...(consulta.data ?? [])].sort((a, b) => a.priority - b.priority);

  return (
    <>
      <EncabezadoPagina
        titulo="Clasificación de la presión arterial"
        descripcion="Rangos (ESH) que usa el sistema para clasificar cada toma. Si la sistólica y la diastólica caen en categorías distintas, gana la más alta."
        acciones={
          <Boton icono={<Plus className="size-4" />} onClick={() => navegar('/clasificacion/nueva')}>
            Nuevo rango
          </Boton>
        }
      />
      <Tarjeta>
        {consulta.isPending ? (
          <Cargando />
        ) : consulta.isError ? (
          <ErrorCarga error={consulta.error} />
        ) : (
          <Tabla columnas={['Categoría', 'Sistólica', 'Diastólica', 'Prioridad', { texto: '', className: 'w-24' }]}>
            {lista.map((c) => (
              <tr key={c.id} className="hover:bg-fondo">
                <td className="px-5 py-3">
                  <InsigniaCategoria config={c} />
                </td>
                <td className="tabular px-5 py-3 font-mono">
                  {c.systolicMin}–{c.systolicMax}
                </td>
                <td className="tabular px-5 py-3 font-mono">
                  {c.diastolicMin}–{c.diastolicMax}
                </td>
                <td className="tabular px-5 py-3">{c.priority}</td>
                <td className="px-5 py-2 text-right whitespace-nowrap">
                  <Boton variante="fantasma" className="h-8 px-2" aria-label="Editar" onClick={() => navegar(`/clasificacion/${c.id}`)}>
                    <Pencil className="size-4" />
                  </Boton>
                  <Boton
                    variante="fantasma"
                    className="h-8 px-2 hover:text-red-600"
                    aria-label="Eliminar"
                    onClick={async () =>
                      (await confirmar({ titulo: `¿Eliminar el rango ${CATEGORIAS[c.categoryName]}?`, mensaje: 'Las tomas nuevas que caigan en estos valores ya no tendrán esta clasificación.' })) &&
                      borrar.mutate(c.id)
                    }
                  >
                    <Trash2 className="size-4" />
                  </Boton>
                </td>
              </tr>
            ))}
          </Tabla>
        )}
      </Tarjeta>
    </>
  );
}

/** /clasificacion/nueva y /clasificacion/:id */
export function ClasificacionEditor() {
  const id = Number(useParams().id) || undefined;
  const consulta = useConfigPAUna(id);
  if (id && consulta.isPending) return <Cargando />;
  if (id && !consulta.data) return <Vacio titulo="Rango no encontrado" />;
  return <FormularioConfig config={consulta.data ?? undefined} />;
}

type Datos = Omit<ConfigPA, 'id'>;

function FormularioConfig({ config }: { config?: ConfigPA }) {
  const cliente = useQueryClient();
  const navegar = useNavigate();
  const { register, handleSubmit, formState, getValues } = useForm<Datos>({
    defaultValues: config
      ? { ...config, colorHex: colorCategoria(config) }
      : { categoryName: 'NORMAL', systolicMin: 0, systolicMax: 0, diastolicMin: 0, diastolicMax: 0, priority: 1, colorHex: '#15803d' },
  });
  const guardar = useMutation({
    mutationFn: (d: Datos) => (config ? editarConfigPA(config.id, d) : crearConfigPA(d)),
    onSuccess: () => {
      cliente.invalidateQueries({ queryKey: ['config-pa'] });
      toast.success('Rango guardado');
      navegar('/clasificacion');
    },
    onError: (e) => toast.error(e.message),
  });
  const e = formState.errors;
  const n = { valueAsNumber: true, required: true, min: 0 } as const;

  return (
    <>
      <EncabezadoPagina
        titulo={config ? `Rango ${CATEGORIAS[config.categoryName]}` : 'Nuevo rango'}
        volver={{ a: '/clasificacion', texto: 'Clasificación PA' }}
      />
      <form onSubmit={handleSubmit((d) => guardar.mutate(d))} className="max-w-2xl space-y-4">
        <Tarjeta titulo="Rango">
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Campo etiqueta="Categoría">
              <Selector opciones={opciones(CATEGORIAS)} {...register('categoryName')} />
            </Campo>
            <Campo etiqueta="Prioridad" ayuda="Mayor número = más grave. Decide cuando una toma cae en dos rangos." error={e.priority && 'Requerida'}>
              <Entrada type="number" {...register('priority', { valueAsNumber: true, required: true })} />
            </Campo>
            <Campo etiqueta="Sistólica mínima" error={e.systolicMin && 'Valor no válido'}>
              <Entrada type="number" {...register('systolicMin', n)} />
            </Campo>
            <Campo etiqueta="Sistólica máxima" error={e.systolicMax && 'Debe ser ≥ a la mínima'}>
              <Entrada type="number" {...register('systolicMax', { ...n, validate: (v) => v >= getValues('systolicMin') })} />
            </Campo>
            <Campo etiqueta="Diastólica mínima" error={e.diastolicMin && 'Valor no válido'}>
              <Entrada type="number" {...register('diastolicMin', n)} />
            </Campo>
            <Campo etiqueta="Diastólica máxima" error={e.diastolicMax && 'Debe ser ≥ a la mínima'}>
              <Entrada type="number" {...register('diastolicMax', { ...n, validate: (v) => v >= getValues('diastolicMin') })} />
            </Campo>
            <Campo etiqueta="Color">
              <Entrada type="color" className="h-9 p-1" {...register('colorHex')} />
            </Campo>
          </div>
        </Tarjeta>
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={() => navegar('/clasificacion')}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={guardar.isPending}>
            Guardar
          </Boton>
        </div>
      </form>
    </>
  );
}
