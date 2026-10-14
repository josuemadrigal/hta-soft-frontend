import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BarChart3, PackageCheck, Pill, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { toast } from 'sonner';
import { useComunidades } from '../api/consultas';
import { useSesion } from '../auth/sesion';
import { entregarPendientes, entregasDeHoy, pendientesDeEntrega } from '../api/recursos';
import type { PacienteConPendientes, RecibioEntrega } from '../api/tipos';
import { Avatar, Boton, Cargando, EncabezadoPagina, Entrada, ErrorCarga, Insignia, Selector, Tarjeta, Vacio } from '../components/ui';
import { cantidadSugerida, mensajeEntrega } from '../lib/entregas';
import { RECIBIO_ENTREGA } from '../lib/etiquetas';
import { cn, fecha, nombreCompleto } from '../lib/formato';
import { agregarPendiente, esFaltaDeConexion, nuevoId, usePendientes } from '../offline/cola';

type CuerpoEntrega = Parameters<typeof entregarPendientes>[0];
type Pendientes = Awaited<ReturnType<typeof pendientesDeEntrega>>;

const hora = new Intl.DateTimeFormat('es-DO', { timeStyle: 'short' });
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

/** Lo que se entregó en este dispositivo sin internet: aún no se ve en el servidor, pero ya salió de la mesa. */
type Locales = { porReceta: Map<number, number>; pacientes: Set<number> };

/** /entregas — la mesa de farmacia del batey: lo que falta por entregar a cada paciente. */
export function Entregas() {
  const [params, setParams] = useSearchParams();
  const idPedido = Number(params.get('batey')) || undefined;
  const [busqueda, setBusqueda] = useState('');
  const [vista, setVista] = useState<'pendientes' | 'hoy'>('pendientes');
  const cliente = useQueryClient();
  const { tiene } = useSesion();

  const comunidades = useComunidades();
  // Un enlace viejo puede traer un batey que ya no existe: se trata como "Todos".
  const comunidadId = comunidades.data?.some((c) => c.id === idPedido) ? idPedido : undefined;
  const clave = ['entregas', 'pendientes', comunidadId ?? null] as const;
  const lista = useQuery({ queryKey: clave, queryFn: () => pendientesDeEntrega(comunidadId) });
  const hoy = useQuery({ queryKey: ['entregas', 'hoy', comunidadId ?? null], queryFn: () => entregasDeHoy(comunidadId) });

  const enCola = usePendientes();
  const locales = useMemo<Locales>(() => {
    const porReceta = new Map<number, number>();
    const pacientes = new Set<number>();
    // Los que el servidor rechazó no se descuentan: quedan para revisarlos en Sincronización.
    for (const x of enCola) {
      if (x.tipo !== 'entrega' || x.error) continue;
      pacientes.add(x.resumen.pacienteId);
      for (const i of (x.cuerpo as CuerpoEntrega).items) porReceta.set(i.prescriptionId, (porReceta.get(i.prescriptionId) ?? 0) + i.cantidad);
    }
    return { porReceta, pacientes };
  }, [enCola]);

  // Lo pendiente y la existencia, descontando lo que espera en la cola.
  const { filas, existencia } = useMemo(() => {
    const ex: Record<number, number> = { ...(lista.data?.existencia ?? {}) };
    const filas = (lista.data?.pacientes ?? []).map((pc) => ({
      ...pc,
      recetas: pc.recetas
        .map((r) => {
          const local = locales.porReceta.get(r.id) ?? 0;
          if (local) ex[r.medicamento.id] = Math.max(0, (ex[r.medicamento.id] ?? 0) - local);
          return { ...r, entregada: r.entregada + local, pendiente: Math.max(0, r.pendiente - local) };
        })
        .filter((r) => r.pendiente > 0),
    }));
    return { filas, existencia: ex };
  }, [lista.data, locales]);

  // Sigue a la vista quien ya se entregó sin internet: así se nota que quedó "sin enviar".
  const porEntregar = filas.filter((pc) => pc.recetas.length || locales.pacientes.has(pc.paciente.id));
  const q = busqueda.trim().toLowerCase();
  const coincide = (p: { firstName: string; lastName: string; patientCode: string; address?: string | null }) =>
    !q || `${p.firstName} ${p.lastName} ${p.patientCode} ${p.address ?? ''}`.toLowerCase().includes(q);
  const visibles = porEntregar.filter((pc) => coincide(pc.paciente));
  const deHoy = (hoy.data ?? []).filter((e) => !e.patient || coincide(e.patient));
  const volver = encodeURIComponent(`/entregas${comunidadId ? `?batey=${comunidadId}` : ''}`);

  /** Resta lo entregado de la lista guardada: la fila cambia al instante, sin esperar a recargar. */
  const descontar = (pacienteId: number, items: CuerpoEntrega['items'], pc: PacienteConPendientes) =>
    cliente.setQueryData<Pendientes>(clave, (d) => {
      if (!d) return d;
      const ex = { ...d.existencia };
      for (const i of items) {
        const med = pc.recetas.find((r) => r.id === i.prescriptionId)?.medicamento.id;
        if (med !== undefined && ex[med] !== undefined) ex[med] = Math.max(0, ex[med] - i.cantidad);
      }
      const pacientes = d.pacientes
        .map((x) =>
          x.paciente.id !== pacienteId
            ? x
            : {
                ...x,
                recetas: x.recetas
                  .map((r) => {
                    const c = items.find((i) => i.prescriptionId === r.id)?.cantidad ?? 0;
                    return { ...r, entregada: r.entregada + c, pendiente: r.pendiente - c };
                  })
                  .filter((r) => r.pendiente > 0),
              },
        )
        .filter((x) => x.recetas.length);
      return { pacientes, existencia: ex };
    });

  const entregar = async (pc: PacienteConPendientes, datos: Omit<CuerpoEntrega, 'clienteId' | 'patientId'>, quedan: number) => {
    const p = pc.paciente;
    const cuerpo: CuerpoEntrega = { ...datos, clienteId: nuevoId(), patientId: p.id };
    const total = datos.items.reduce((s, i) => s + i.cantidad, 0);
    const resto = quedan ? ` Quedan ${plural(quedan, 'pastilla pendiente', 'pastillas pendientes')}.` : '';
    const guardarEnCola = async () => {
      await agregarPendiente({
        id: cuerpo.clienteId!,
        tipo: 'entrega',
        ruta: '/entregas',
        metodo: 'POST',
        cuerpo,
        resumen: { pacienteId: p.id, paciente: `${nombreCompleto(p)} · ${p.patientCode}`, detalle: `Entrega de ${plural(total, 'pastilla', 'pastillas')}` },
      });
      toast.success(`Entregado a ${nombreCompleto(p)}. Sin conexión: se enviará al volver la señal.${resto}`);
      return true;
    };
    if (!navigator.onLine) return guardarEnCola();
    try {
      await entregarPendientes(cuerpo);
      descontar(p.id, datos.items, pc);
      for (const k of [['entregas'], ['paciente', p.id], ['medicamentos']]) void cliente.invalidateQueries({ queryKey: k });
      toast.success(`Entregado a ${nombreCompleto(p)}.${resto}`);
      return true;
    } catch (e) {
      if (esFaltaDeConexion(e)) return guardarEnCola();
      // La receta pudo cambiar (otra mesa entregó, o hubo una consulta nueva): se recarga la lista.
      void cliente.invalidateQueries({ queryKey: ['entregas', 'pendientes'] });
      toast.error(mensajeEntrega(e instanceof Error ? e.message : 'No se pudo entregar'));
      return false;
    }
  };

  return (
    <>
      <EncabezadoPagina
        titulo="Entregas de medicamentos"
        descripcion="La mesa de farmacia: lo que falta por entregar a cada paciente."
        acciones={
          tiene('reportes.ver') && (
            <Link to="/reportes/entregas" className="inline-flex h-9 items-center gap-2 rounded-lg border border-borde bg-superficie px-3.5 text-sm font-medium hover:bg-fondo">
              <BarChart3 className="size-4" /> Ver reporte
            </Link>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <label className="flex min-w-60 flex-col gap-1.5">
          <span className="text-[13px] font-medium text-tinta/80">Batey</span>
          <Selector
            vacio="Todos los bateyes"
            value={comunidadId ?? ''}
            onChange={(e) => setParams(e.target.value ? { batey: e.target.value } : {}, { replace: true })}
            opciones={(comunidades.data ?? []).filter((c) => c.isActive).map((c) => ({ value: c.id, label: c.name }))}
          />
        </label>
      </div>

      <Tarjeta>
        <div className="flex flex-wrap items-center gap-3 border-b border-borde p-4">
          <div className="relative min-w-52 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-tenue" />
            <Entrada value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre, código o casa" className="h-10 pl-9 xl:h-9" />
          </div>
          <div className="flex rounded-lg bg-black/5 p-0.5 text-sm">
            {(
              [
                ['pendientes', `Por entregar (${porEntregar.length})`],
                ['hoy', `Entregadas hoy (${hoy.data?.length ?? 0})`],
              ] as const
            ).map(([v, texto]) => (
              <button
                key={v}
                onClick={() => setVista(v)}
                className={cn('rounded-md px-3 py-2 xl:py-1.5', vista === v ? 'bg-superficie font-medium shadow-sm' : 'text-tenue hover:text-tinta')}
              >
                {texto}
              </button>
            ))}
          </div>
        </div>

        {vista === 'pendientes' ? (
          lista.isPending ? (
            <Cargando />
          ) : lista.isError ? (
            <ErrorCarga error={lista.error} />
          ) : visibles.length === 0 ? (
            q ? (
              <Vacio icono={<Search className="size-8" />} titulo="Sin coincidencias" />
            ) : (
              <Vacio icono={<PackageCheck className="size-8" />} titulo="Nada por entregar">
                Todos los medicamentos recetados ya se entregaron.
              </Vacio>
            )
          ) : (
            <ul className="divide-y divide-borde">
              {visibles.map((pc) => (
                <FilaPaciente
                  key={pc.paciente.id}
                  pc={pc}
                  existencia={existencia}
                  sinEnviar={locales.pacientes.has(pc.paciente.id)}
                  enlace={`/pacientes/${pc.paciente.id}?volver=${volver}`}
                  alEntregar={entregar}
                />
              ))}
            </ul>
          )
        ) : hoy.isPending ? (
          <Cargando />
        ) : hoy.isError ? (
          <ErrorCarga error={hoy.error} />
        ) : deHoy.length === 0 ? (
          <Vacio icono={<Pill className="size-8" />} titulo={q ? 'Sin coincidencias' : 'Nada entregado hoy todavía'} />
        ) : (
          <ul className="divide-y divide-borde">
            {deHoy.map((e) => (
              <li key={e.id} className="flex flex-wrap items-start gap-x-4 gap-y-1 px-5 py-3 text-sm xl:flex-nowrap">
                <span className="tabular w-20 shrink-0 font-mono whitespace-nowrap text-tenue">{hora.format(new Date(e.createdAt))}</span>
                <div className="min-w-0 flex-1 basis-[calc(100%-5rem)] xl:basis-0">
                  {e.patient ? (
                    <Link to={`/pacientes/${e.patient.id}?volver=${volver}`} className="font-medium hover:underline">
                      {nombreCompleto(e.patient)}
                    </Link>
                  ) : (
                    <span className="font-medium">Paciente #{e.patientId}</span>
                  )}
                  {e.patient && <span className="ml-1.5 font-mono text-xs text-tenue">{e.patient.patientCode}</span>}
                  {e.tipo === 'REPOSICION' && (
                    <Insignia color="#7a5c00" className="ml-2">
                      Reposición
                    </Insignia>
                  )}
                  <p className="text-tinta/80">{e.items.map((i) => `${i.medication ? `${i.medication.name} ${i.medication.concentration}` : `#${i.medicationId}`}: ${i.cantidad}`).join(' · ')}</p>
                </div>
                <div className="ml-20 text-xs text-tenue xl:ml-0 xl:w-56 xl:text-right">
                  <p>Recibió: {e.recibio === 'PACIENTE' ? 'el paciente' : (e.recibioNombre ?? RECIBIO_ENTREGA[e.recibio].toLowerCase())}</p>
                  {e.entregadoPorNombre && <p className="truncate">Entregó {e.entregadoPorNombre}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
    </>
  );
}

/** Un paciente en la mesa: sus recetas con lo que falta, cuánto se le da ahora y quién lo recibe. */
function FilaPaciente({
  pc,
  existencia,
  sinEnviar,
  enlace,
  alEntregar,
}: {
  pc: PacienteConPendientes;
  existencia: Record<number, number>;
  sinEnviar: boolean;
  enlace: string;
  alEntregar: (pc: PacienteConPendientes, datos: Omit<CuerpoEntrega, 'clienteId' | 'patientId'>, quedan: number) => Promise<boolean>;
}) {
  const p = pc.paciente;
  // Solo se guarda lo que la persona cambió; lo demás sigue a lo pendiente y a la existencia (que baja con cada entrega).
  const [cambios, setCambios] = useState<Record<number, string>>({});
  const [recibio, setRecibio] = useState<RecibioEntrega>('PACIENTE');
  const [nombre, setNombre] = useState('');
  const [enviando, setEnviando] = useState(false);

  const valor = (r: PacienteConPendientes['recetas'][number]) => cambios[r.id] ?? String(cantidadSugerida(r.pendiente, existencia[r.medicamento.id]));
  const items = pc.recetas.map((r) => ({ r, cantidad: Math.floor(Number(valor(r)) || 0) }));
  const fuera = items.some(({ r, cantidad }) => cantidad < 0 || cantidad > r.pendiente);
  const total = items.reduce((s, i) => s + Math.max(0, i.cantidad), 0);

  const entregar = async () => {
    setEnviando(true);
    const ok = await alEntregar(
      pc,
      {
        items: items.filter((i) => i.cantidad > 0).map((i) => ({ prescriptionId: i.r.id, cantidad: i.cantidad })),
        recibio,
        recibioNombre: recibio !== 'PACIENTE' ? nombre.trim() || undefined : undefined,
      },
      items.reduce((s, i) => s + i.r.pendiente - i.cantidad, 0),
    );
    setEnviando(false);
    if (ok) setCambios({});
  };

  return (
    <li className="space-y-3 px-5 py-4">
      <div className="flex items-center gap-3">
        <Avatar persona={p} foto={p.photoUrl} />
        <div className="min-w-0 flex-1">
          <Link to={enlace} className="block truncate font-medium hover:underline">
            {nombreCompleto(p)}
          </Link>
          <p className="truncate text-xs text-tenue">
            <span className="font-mono">{p.patientCode}</span>
            {p.address && ` · Casa ${p.address}`}
          </p>
        </div>
        {sinEnviar && <Insignia color="#a16207">Registrada · sin enviar</Insignia>}
      </div>

      {pc.recetas.length > 0 && (
        <>
          <ul className="space-y-2 sm:ml-12">
            {items.map(({ r }) => {
              const hay = existencia[r.medicamento.id];
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-fondo px-3 py-2.5 xl:flex-nowrap">
                  {/* Hasta 1280 px el medicamento ocupa su línea y la cantidad baja a la siguiente. */}
                  <div className="min-w-0 flex-1 basis-full xl:basis-0">
                    <p className="text-sm font-medium">
                      {r.medicamento.name} {r.medicamento.concentration}
                    </p>
                    <p className="text-xs text-tenue">
                      Indicadas {r.indicada} · entregadas {r.entregada} · <strong className="text-tinta">faltan {r.pendiente}</strong>
                    </p>
                    <p className="truncate text-xs text-tenue">
                      Visita del {fecha(r.visitaFecha)}
                      {r.atendio && ` · Atendió ${r.atendio}`}
                    </p>
                  </div>
                  {hay !== undefined && hay < r.pendiente && <span className="text-xs font-medium text-red-600">Hay {hay}</span>}
                  <label className="ml-auto flex items-center gap-2 text-sm xl:ml-0">
                    <span className="text-[13px] font-medium text-tinta/80">Entregar</span>
                    <Entrada
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={r.pendiente}
                      className="h-10 w-24 text-right xl:h-9"
                      value={valor(r)}
                      aria-invalid={Number(valor(r)) > r.pendiente || Number(valor(r)) < 0}
                      onChange={(e) => setCambios((c) => ({ ...c, [r.id]: e.target.value }))}
                    />
                  </label>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-center gap-3 sm:ml-12">
            <QuienRecibe valor={recibio} alCambiar={setRecibio} />
            {recibio !== 'PACIENTE' && (
              <Entrada className="h-10 w-48 xl:h-9" maxLength={120} placeholder="Nombre (opcional)" aria-label="Nombre de quien recibe" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            )}
            <Boton className="ml-auto h-10 px-4 xl:h-9" icono={<PackageCheck className="size-4" />} disabled={!total || fuera} cargando={enviando} onClick={() => void entregar()}>
              Entregar
            </Boton>
          </div>
          {fuera && <p className="text-xs text-red-600 sm:ml-12">No se puede entregar más de lo que falta.</p>}
        </>
      )}
    </li>
  );
}

const QUIEN: Record<RecibioEntrega, string> = { PACIENTE: 'Paciente', FAMILIAR: 'Familiar', OTRO: 'Otra persona' };

/** Quién se lleva las pastillas: tres toques, sin abrir nada. */
export function QuienRecibe({ valor, alCambiar }: { valor: RecibioEntrega; alCambiar: (v: RecibioEntrega) => void }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-[13px] font-medium text-tinta/80">Recibió</span>
      <div className="flex rounded-lg bg-black/5 p-0.5" role="radiogroup" aria-label="Quién recibe">
        {(Object.keys(QUIEN) as RecibioEntrega[]).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={valor === k}
            onClick={() => alCambiar(k)}
            className={cn('rounded-md px-3 py-2 xl:py-1.5', valor === k ? 'bg-superficie font-medium shadow-sm' : 'text-tenue hover:text-tinta')}
          >
            {QUIEN[k]}
          </button>
        ))}
      </div>
    </div>
  );
}
