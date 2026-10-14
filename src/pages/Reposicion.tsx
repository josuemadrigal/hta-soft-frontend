import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardPlus, PackagePlus, Plus, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { useMedicamentos, usePaciente } from '../api/consultas';
import { entregasDelPaciente, registrarReposicion } from '../api/recursos';
import type { MotivoReposicion, RecibioEntrega } from '../api/tipos';
import { AreaTexto, Boton, Campo, Cargando, EncabezadoPagina, Entrada, ErrorCarga, Selector, Tarjeta, Vacio } from '../components/ui';
import { cantidadPorDias, MARGEN_POR_DEFECTO, margenDe, mensajeEntrega } from '../lib/entregas';
import { MOTIVOS_REPOSICION } from '../lib/etiquetas';
import { cn, nombreCompleto } from '../lib/formato';
import { agregarPendiente, esFaltaDeConexion, nuevoId } from '../offline/cola';
import { QuienRecibe } from './Entregas';

type CuerpoReposicion = Parameters<typeof registrarReposicion>[0];
type Fila = { clave: string; medicationId: number | ''; dosis: number | null; margen: number; cantidad: string };

const DIAS = [30, 60, 90] as const;

/** /pacientes/:id/reposicion — pastillas sin consulta (las recoge un familiar, se le acabaron, a domicilio). */
export function Reposicion() {
  const id = Number(useParams().id);
  const paciente = usePaciente(id);
  const datos = useQuery({ queryKey: ['entregas', 'paciente', id], queryFn: () => entregasDelPaciente(id) });
  const medicamentos = useMedicamentos();
  const navegar = useNavigate();
  const cliente = useQueryClient();

  const [dias, setDias] = useState<number>(30);
  const [filas, setFilas] = useState<Fila[] | null>(null);
  const [motivo, setMotivo] = useState<MotivoReposicion | ''>('');
  const [recibio, setRecibio] = useState<RecibioEntrega>('PACIENTE');
  const [nombre, setNombre] = useState('');
  const [nota, setNota] = useState('');
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(false);

  const ultimaReceta = datos.data?.reposicion.ultimaReceta;
  // Se arranca con la última receta, una sola vez: después manda lo que la persona edite.
  useEffect(() => {
    if (ultimaReceta && filas === null)
      setFilas(ultimaReceta.map((u) => ({ clave: nuevoId(), medicationId: u.medicationId, dosis: u.dailyDose, margen: margenDe(u), cantidad: String(cantidadPorDias(u.dailyDose, 30, margenDe(u))) })));
  }, [ultimaReceta, filas]);

  if (paciente.isPending || datos.isPending) return <Cargando />;
  if (datos.isError) return <ErrorCarga error={datos.error} />;
  const p = paciente.data;
  if (!p) return <Vacio titulo="Paciente no encontrado" />;
  const encabezado = (
    <EncabezadoPagina
      titulo="Reposición sin consulta"
      descripcion={
        <>
          {nombreCompleto(p)} · <span className="font-mono">{p.patientCode}</span>
          {p.community && ` · ${p.community.name}`}
        </>
      }
      volver={{ a: `/pacientes/${id}`, texto: nombreCompleto(p) }}
    />
  );

  const regla = datos.data.reposicion;
  if (!regla.permitida)
    return (
      <>
        {encabezado}
        <Tarjeta className="max-w-2xl">
          <Vacio icono={<PackagePlus className="size-8" />} titulo="No se le puede reponer sin consulta">
            <p>{regla.motivo ?? `Su última consulta fue hace más de ${regla.mesesMaximo} meses.`}</p>
            <Boton className="mt-4" icono={<ClipboardPlus className="size-4" />} onClick={() => navegar(`/pacientes/${id}/visita`)}>
              Registrar una visita
            </Boton>
          </Vacio>
        </Tarjeta>
      </>
    );

  const lista = filas ?? [];
  const catalogo = (medicamentos.data ?? []).filter((m) => m.activo);
  const hayDe = (medId: number) => {
    const m = medicamentos.data?.find((x) => x.id === medId);
    return m ? (m.vigente ?? m.currentStock) : undefined;
  };
  const cambiar = (clave: string, c: Partial<Fila>) => setFilas((fs) => (fs ?? []).map((f) => (f.clave === clave ? { ...f, ...c } : f)));
  const elegirDias = (d: number) => {
    setDias(d);
    // Solo se recalculan las filas con dosis conocida; las agregadas a mano se quedan como están.
    setFilas((fs) => (fs ?? []).map((f) => (f.dosis ? { ...f, cantidad: String(cantidadPorDias(f.dosis, d, f.margen)) } : f)));
  };
  const elegirMotivo = (m: MotivoReposicion) => {
    setMotivo(m);
    if (m === 'FAMILIAR_RECOGE' && recibio === 'PACIENTE') setRecibio('FAMILIAR');
  };

  const items = lista.filter((f) => f.medicationId !== '').map((f) => ({ medicationId: f.medicationId as number, cantidad: Math.floor(Number(f.cantidad) || 0) }));
  const incompleta = lista.some((f) => (f.medicationId === '') !== (f.cantidad.trim() === '') || (f.medicationId !== '' && !(Number(f.cantidad) >= 1)));
  const total = items.reduce((s, i) => s + i.cantidad, 0);
  const sinStock = items.some((i) => i.cantidad > (hayDe(i.medicationId) ?? Infinity));
  const listo = !!motivo && items.length > 0 && !incompleta && !sinStock;

  const registrar = async () => {
    if (!motivo) return;
    setError('');
    const cuerpo: CuerpoReposicion = {
      clienteId: nuevoId(),
      patientId: id,
      motivo,
      items,
      recibio,
      recibioNombre: recibio !== 'PACIENTE' ? nombre.trim() || undefined : undefined,
      nota: nota.trim() || undefined,
    };
    const terminar = () => {
      for (const k of [['paciente', id], ['entregas'], ['medicamentos']]) void cliente.invalidateQueries({ queryKey: k });
      navegar(`/pacientes/${id}`);
    };
    const guardarEnCola = async () => {
      await agregarPendiente({
        id: cuerpo.clienteId!,
        tipo: 'reposicion',
        ruta: '/entregas/reposicion',
        metodo: 'POST',
        cuerpo,
        resumen: { pacienteId: id, paciente: `${nombreCompleto(p)} · ${p.patientCode}`, detalle: `Reposición de ${total} pastillas (${MOTIVOS_REPOSICION[motivo].toLowerCase()})` },
      });
      toast.success('Sin conexión: la reposición quedó guardada en este dispositivo y se enviará sola al volver la señal.');
      terminar();
    };
    setEnviando(true);
    try {
      if (!navigator.onLine) return await guardarEnCola();
      await registrarReposicion(cuerpo);
      toast.success(`Reposición registrada: ${total} pastillas.`);
      terminar();
    } catch (e) {
      if (esFaltaDeConexion(e)) return await guardarEnCola();
      setError(mensajeEntrega(e instanceof Error ? e.message : '') || 'No se pudo registrar la reposición.');
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      {encabezado}
      <div className="max-w-3xl space-y-4">
        <Tarjeta
          titulo="Medicamentos"
          accion={
            <div className="flex items-center gap-2 text-sm">
              <span className="text-tenue">Días a cubrir</span>
              <div className="flex rounded-lg bg-black/5 p-0.5" role="radiogroup" aria-label="Días a cubrir">
                {DIAS.map((d) => (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={dias === d}
                    onClick={() => elegirDias(d)}
                    className={cn('rounded-md px-3 py-2 xl:py-1', dias === d ? 'bg-superficie font-medium shadow-sm' : 'text-tenue hover:text-tinta')}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          }
        >
          {lista.length === 0 ? (
            <p className="px-5 py-4 text-sm text-tenue">Su última receta no tiene medicamentos. Agrega los que se le dan.</p>
          ) : (
            <ul className="divide-y divide-borde">
              {lista.map((f) => {
                const hay = f.medicationId === '' ? undefined : hayDe(f.medicationId);
                const falta = hay !== undefined && Number(f.cantidad) > hay;
                const usados = new Set(lista.filter((x) => x.clave !== f.clave).map((x) => x.medicationId));
                return (
                  <li key={f.clave} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] items-end gap-3 px-5 py-4 sm:grid-cols-[minmax(0,1fr)_110px_120px_auto]">
                    <Campo etiqueta="Medicamento" className="col-span-3 sm:col-span-1">
                      <Selector
                        className="h-10 xl:h-9"
                        vacio="Elegir…"
                        value={f.medicationId}
                        onChange={(e) => {
                          const medId = e.target.value ? Number(e.target.value) : '';
                          // Si estaba en la última receta, se trae su dosis para calcular por días.
                          const previa = ultimaReceta?.find((u) => u.medicationId === medId);
                          const dosis = previa?.dailyDose ?? null;
                          const margen = previa ? margenDe(previa) : MARGEN_POR_DEFECTO;
                          cambiar(f.clave, { medicationId: medId, dosis, margen, cantidad: dosis ? String(cantidadPorDias(dosis, dias, margen)) : f.cantidad });
                        }}
                        opciones={catalogo.filter((m) => !usados.has(m.id)).map((m) => ({ value: m.id, label: `${m.name} ${m.concentration}` }))}
                      />
                    </Campo>
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[13px] font-medium text-tinta/80">Pastillas al día</span>
                      <span className="flex h-10 items-center text-sm xl:h-9">{f.dosis ?? '—'}</span>
                    </div>
                    <Campo etiqueta="Cantidad" error={falta ? `Hay ${hay} en inventario` : undefined} ayuda={hay !== undefined ? `Hay ${hay} en inventario` : undefined}>
                      <Entrada
                        type="number"
                        inputMode="numeric"
                        min={1}
                        className="h-10 text-right xl:h-9"
                        value={f.cantidad}
                        aria-invalid={falta}
                        onChange={(e) => cambiar(f.clave, { cantidad: e.target.value })}
                      />
                    </Campo>
                    <Boton
                      variante="fantasma"
                      className="h-10 px-2.5 xl:h-9"
                      aria-label="Quitar medicamento"
                      title="Quitar"
                      onClick={() => setFilas((fs) => (fs ?? []).filter((x) => x.clave !== f.clave))}
                    >
                      <X className="size-4" />
                    </Boton>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="border-t border-borde px-5 py-3">
            <Boton
              variante="secundario"
              className="h-10 xl:h-9"
              icono={<Plus className="size-4" />}
              disabled={lista.length >= catalogo.length}
              onClick={() => setFilas((fs) => [...(fs ?? []), { clave: nuevoId(), medicationId: '', dosis: null, margen: MARGEN_POR_DEFECTO, cantidad: '' }])}
            >
              Agregar medicamento
            </Boton>
          </div>
        </Tarjeta>

        <Tarjeta titulo="Motivo">
          <div className="grid gap-2 p-5 sm:grid-cols-2">
            {(Object.keys(MOTIVOS_REPOSICION) as MotivoReposicion[]).filter((m) => m !== 'DOMICILIO').map((m) => (
              <label
                key={m}
                className={cn('flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm', motivo === m ? 'border-tinta bg-marca-50 font-medium' : 'border-borde hover:bg-fondo')}
              >
                <input type="radio" name="motivo" className="accent-tinta" checked={motivo === m} onChange={() => elegirMotivo(m)} />
                {MOTIVOS_REPOSICION[m]}
              </label>
            ))}
          </div>
        </Tarjeta>

        <Tarjeta titulo="Quién recibe">
          <div className="space-y-4 p-5">
            <div className="flex flex-wrap items-center gap-3">
              <QuienRecibe valor={recibio} alCambiar={setRecibio} />
              {recibio !== 'PACIENTE' && (
                <Entrada className="h-10 w-56 xl:h-9" maxLength={120} placeholder="Nombre (opcional)" aria-label="Nombre de quien recibe" value={nombre} onChange={(e) => setNombre(e.target.value)} />
              )}
            </div>
            <Campo etiqueta="Nota (opcional)">
              <AreaTexto rows={2} maxLength={500} value={nota} onChange={(e) => setNota(e.target.value)} />
            </Campo>
          </div>
          <p className="border-t border-borde px-5 py-3 text-sm text-tenue">
            No cuenta como visita: no se toma la presión ni cambia su ronda. Las pastillas sí cuentan para el cumplimiento de su próxima visita y en los reportes.
          </p>
        </Tarjeta>

        {error && <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

        <div className="flex justify-end gap-2">
          <Boton variante="secundario" className="h-10 xl:h-9" onClick={() => navegar(`/pacientes/${id}`)}>
            Cancelar
          </Boton>
          <Boton className="h-10 xl:h-9" icono={<PackagePlus className="size-4" />} disabled={!listo} cargando={enviando} onClick={() => void registrar()}>
            Registrar reposición
          </Boton>
        </div>
      </div>
    </>
  );
}
