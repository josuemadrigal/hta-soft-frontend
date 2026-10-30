import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, ChevronLeft, ChevronRight, FileDown, Plus, Printer, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { useAsistenciaJornadas, useJornadas, useMedicamentos } from '../api/consultas';
import { descargarEtiquetas, guardarIndicacionEtiqueta, indicacionesEtiquetas, type LineaEtiqueta, type LoteEtiquetas } from '../api/recursos';
import { useSesion } from '../auth/sesion';
import { ymd } from '../components/SelectorFecha';
import { Boton, Campo, Cargando, EncabezadoPagina, Entrada, Segmentos, Selector, Tarjeta, Vacio } from '../components/ui';
import { cn } from '../lib/formato';
import { diaJornada } from './Jornadas';

/** Avery 5160: carta, 3 columnas × 10 filas de 2⅝" × 1". Las medidas, en pulgadas, para la vista previa. */
const HOJA = { ancho: 8.5, alto: 11, porHoja: 30, columnas: 3, etiquetaAncho: 2.625, etiquetaAlto: 1, arriba: 0.5, izquierda: 0.1875, pasoColumna: 2.75 };

const MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
/** "18 DE ENERO 2027", como en las etiquetas de papel (la jornada es una fecha pura, en UTC). */
const fechaEtiqueta = (iso: string) => {
  const d = new Date(iso);
  return `${d.getUTCDate()} DE ${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

type Lote = LoteEtiquetas & { id: string; nombre: string };
type Estilo = 'normal' | 'negrita' | 'rojo' | 'numeros';
const ESTILOS: { value: Estilo; label: string }[] = [
  { value: 'negrita', label: 'Negrita' },
  { value: 'normal', label: 'Normal' },
  { value: 'rojo', label: 'Rojo' },
  { value: 'numeros', label: 'Números en rojo' },
];
const linea = (texto: string, estilo: Estilo): LineaEtiqueta => ({ texto, negrita: estilo !== 'normal' && estilo !== 'rojo', rojo: estilo === 'rojo', numerosEnRojo: estilo === 'numeros' });

/** Ajuste fino de la impresora: es de cada computadora, se guarda en el navegador. */
const CLAVE_AJUSTE = 'hta:etiquetas-ajuste';
const leerAjuste = () => {
  try {
    const a = JSON.parse(localStorage.getItem(CLAVE_AJUSTE) ?? 'null');
    return a && typeof a.x === 'number' && typeof a.y === 'number' ? (a as { x: number; y: number }) : { x: 0, y: 0 };
  } catch {
    return { x: 0, y: 0 };
  }
};

/** La hoja que está en la impresora: qué etiquetas ya se usaron (1–30). Se recuerda en esta computadora. */
const CLAVE_USADAS = 'hta:etiquetas-usadas';
const leerUsadas = () => {
  try {
    const a = JSON.parse(localStorage.getItem(CLAVE_USADAS) ?? '[]');
    return new Set<number>(Array.isArray(a) ? a.filter((n) => Number.isInteger(n) && n >= 1 && n <= HOJA.porHoja) : []);
  } catch {
    return new Set<number>();
  }
};

/**
 * Reparte las etiquetas en hojas de 30, como el PDF: en la primera se saltan las usadas (aunque no estén
 * seguidas); las siguientes van completas. null = posición vacía.
 */
function repartir(lotes: { lineas: LineaEtiqueta[]; cantidad: number }[], usadas: Set<number>) {
  const hojas: (LineaEtiqueta[] | null)[][] = [];
  let hoja: (LineaEtiqueta[] | null)[] = [];
  let posicion = 0;
  const poner = (x: LineaEtiqueta[]) => {
    for (;;) {
      if (posicion === HOJA.porHoja) {
        hojas.push(hoja);
        hoja = [];
        posicion = 0;
      }
      if (!(hojas.length === 0 && usadas.has(posicion + 1))) break;
      hoja.push(null);
      posicion++;
    }
    hoja.push(x);
    posicion++;
  };
  for (const l of lotes) for (let i = 0; i < l.cantidad; i++) poner(l.lineas);
  hojas.push(hoja);
  return hojas;
}

/**
 * Número que se puede borrar y reescribir: mientras se escribe se guarda el texto tal cual; solo un
 * valor válido cambia la cantidad, y al salir del campo vuelve al último válido.
 */
function Numero({ valor, alCambiar, min, max, decimales, className, ...resto }: { valor: number; alCambiar: (n: number) => void; min: number; max: number; decimales?: boolean; className?: string; 'aria-label'?: string; title?: string }) {
  const [texto, setTexto] = useState(String(valor));
  useEffect(() => setTexto(String(valor)), [valor]);
  return (
    <Entrada
      type="number"
      inputMode={decimales ? 'decimal' : 'numeric'}
      step={decimales ? '0.5' : '1'}
      min={min}
      max={max}
      className={className}
      value={texto}
      onChange={(e) => {
        setTexto(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value.trim() !== '' && Number.isFinite(n) && n >= min) alCambiar(Math.min(max, decimales ? n : Math.floor(n)));
      }}
      onBlur={() => setTexto(String(valor))}
      {...resto}
    />
  );
}

/** /etiquetas — etiquetas Avery 5160: próxima clínica por batey, indicación de medicamento y libres. */
export function Etiquetas() {
  const [tipo, setTipo] = useState<'proxima' | 'medicamento' | 'libre'>('proxima');
  const [lotes, setLotes] = useState<Lote[]>([]);
  const [usadas, setUsadas] = useState(leerUsadas);
  // Después de descargar: lo que quedará usado en la última hoja impresa, para marcarlo con un toque.
  const [impresas, setImpresas] = useState<Set<number> | null>(null);
  const [ajuste, setAjuste] = useState(leerAjuste);
  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_USADAS, JSON.stringify([...usadas].sort((a, b) => a - b)));
    } catch {
      /* sin almacenamiento: no se recuerda */
    }
  }, [usadas]);
  useEffect(() => {
    try {
      localStorage.setItem(CLAVE_AJUSTE, JSON.stringify(ajuste));
    } catch {
      /* sin almacenamiento: no se recuerda */
    }
  }, [ajuste]);

  const agregar = (nuevos: Omit<Lote, 'id'>[]) => {
    setLotes((l) => [...l, ...nuevos.map((x) => ({ ...x, id: crypto.randomUUID() }))]);
    toast.success(nuevos.length === 1 ? `Agregado: ${nuevos[0].nombre}` : `Agregados ${nuevos.length} bateyes`);
  };
  const total = lotes.reduce((a, l) => a + l.cantidad, 0);
  const reparto = repartir(lotes, usadas);
  const hojas = total ? reparto.length : 0;
  const libres = HOJA.porHoja - usadas.size;
  const pdf = useMutation({
    mutationFn: () => descargarEtiquetas({ lotes: lotes.map(({ lineas, cantidad }) => ({ lineas, cantidad })), usadas: [...usadas], ajuste }),
    onSuccess: () => {
      // La última hoja: sus usadas de antes (si es la primera) más lo que se imprime en ella.
      const ultima = reparto[reparto.length - 1];
      const quedan = new Set<number>(reparto.length === 1 ? usadas : []);
      ultima.forEach((x, i) => x && quedan.add(i + 1));
      setImpresas(quedan);
      toast.success('PDF listo. Imprímelo al 100 % (tamaño real), en hojas Avery 5160.');
    },
    onError: (e) => toast.error(e.message),
  });
  const marcarImpresas = () => {
    if (!impresas) return;
    // Hoja llena: la próxima vez se empieza con una nueva.
    setUsadas(impresas.size >= HOJA.porHoja ? new Set() : impresas);
    setImpresas(null);
    setLotes([]);
    toast.success(impresas.size >= HOJA.porHoja ? 'La hoja quedó llena: la próxima vez se usa una nueva.' : `Marcadas como usadas: quedan ${HOJA.porHoja - impresas.size} libres en la hoja.`);
  };

  return (
    <>
      <EncabezadoPagina titulo="Etiquetas" descripcion="Para hojas Avery 5160 (30 por hoja). Arma las etiquetas, revisa la hoja y descarga el PDF para imprimir." />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-4">
          <Tarjeta>
            <div className="border-b border-borde p-4">
              <Segmentos
                etiqueta="Tipo de etiqueta"
                valor={tipo}
                alCambiar={setTipo}
                opciones={[
                  { value: 'proxima', label: 'Próxima clínica' },
                  { value: 'medicamento', label: 'Medicamento' },
                  { value: 'libre', label: 'Libre' },
                ]}
              />
            </div>
            {tipo === 'proxima' ? <ProximaClinica alAgregar={agregar} /> : tipo === 'medicamento' ? <DeMedicamento alAgregar={agregar} /> : <Libre alAgregar={agregar} />}
          </Tarjeta>
        </div>

        <aside className="min-w-0 space-y-4 xl:sticky xl:top-6 xl:self-start">
          <Tarjeta titulo="Para imprimir" accion={total > 0 && <span className="tabular text-xs text-tenue">{total.toLocaleString('es-DO')} etiquetas · {hojas} {hojas === 1 ? 'hoja' : 'hojas'}</span>}>
            {lotes.length === 0 ? (
              <p className="px-5 py-6 text-center text-sm text-tenue">Todavía no hay etiquetas. Arma las de la izquierda y agrégalas aquí.</p>
            ) : (
              <ul className="divide-y divide-borde">
                {lotes.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 px-5 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{l.nombre}</p>
                      <p className="truncate text-xs text-tenue">{l.lineas.map((x) => x.texto).join(' · ')}</p>
                    </div>
                    <Numero
                      min={1}
                      max={3000}
                      aria-label={`Cantidad de ${l.nombre}`}
                      className="h-9 w-20 text-center"
                      valor={l.cantidad}
                      alCambiar={(n) => setLotes((ls) => ls.map((x) => (x.id === l.id ? { ...x, cantidad: n } : x)))}
                    />
                    <button
                      type="button"
                      onClick={() => setLotes((ls) => ls.filter((x) => x.id !== l.id))}
                      className="grid size-9 place-items-center rounded-lg bg-red-50/70 text-red-600/80 transition-colors hover:bg-red-100 hover:text-red-700"
                      aria-label={`Quitar ${l.nombre}`}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="space-y-4 border-t border-borde p-5">
              <Campo
                etiqueta={`Hoja en la impresora · ${libres} ${libres === 1 ? 'libre' : 'libres'}`}
                ayuda="Toca aquí o en la hoja de abajo las etiquetas que ya se usaron (quedan rayadas): las nuevas se ponen en los espacios libres. Se recuerda en esta computadora."
              >
                <div className="flex items-start gap-3">
                  <MarcarUsadas usadas={usadas} alCambiar={setUsadas} />
                  <div className="flex flex-col gap-1.5">
                    <Boton variante="secundario" className="h-8 px-2.5 text-xs" disabled={!usadas.size} onClick={() => setUsadas(new Set())}>
                      Hoja nueva
                    </Boton>
                    <Boton variante="secundario" className="h-8 px-2.5 text-xs" disabled={usadas.size === HOJA.porHoja} onClick={() => setUsadas(new Set(Array.from({ length: HOJA.porHoja }, (_, i) => i + 1)))}>
                      Todas usadas
                    </Boton>
                  </div>
                </div>
              </Campo>
              {impresas && (
                <div className="rounded-lg bg-marca-50 p-3 text-sm">
                  <p>
                    ¿Ya imprimiste? Marca como usadas las etiquetas de la última hoja: {impresas.size >= HOJA.porHoja ? 'quedó llena' : `quedarán ${HOJA.porHoja - impresas.size} libres`} para la próxima vez.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Boton className="h-8 px-3 text-xs" onClick={marcarImpresas}>
                      Marcar como usadas
                    </Boton>
                    <Boton variante="fantasma" className="h-8 px-3 text-xs" onClick={() => setImpresas(null)}>
                      Todavía no
                    </Boton>
                  </div>
                </div>
              )}
              <details className="text-sm">
                <summary className="cursor-pointer text-tenue hover:text-tinta">Ajustar a la impresora</summary>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Campo etiqueta="A la derecha (mm)">
                    <Numero decimales min={-10} max={10} valor={ajuste.x} alCambiar={(x) => setAjuste((a) => ({ ...a, x }))} />
                  </Campo>
                  <Campo etiqueta="Hacia abajo (mm)">
                    <Numero decimales min={-10} max={10} valor={ajuste.y} alCambiar={(y) => setAjuste((a) => ({ ...a, y }))} />
                  </Campo>
                  <p className="col-span-2 text-xs text-tenue">Si al imprimir el texto sale corrido, mide cuánto en una hoja de prueba. Negativo mueve a la izquierda o hacia arriba. Se recuerda en esta computadora.</p>
                </div>
              </details>
              <Boton className="h-11 w-full" icono={<FileDown className="size-4" />} disabled={!total} cargando={pdf.isPending} onClick={() => pdf.mutate()}>
                Descargar PDF
              </Boton>
              <p className="flex gap-2 text-xs text-tenue">
                <Printer className="mt-0.5 size-3.5 shrink-0" /> Imprime al 100 % o "tamaño real", sin ajustar a la página.
              </p>
            </div>
          </Tarjeta>
          <VistaHoja reparto={reparto} usadas={usadas} alCambiar={setUsadas} />
        </aside>
      </div>
    </>
  );
}

/* ───────────── Próxima clínica: una hoja por batey, con la fecha de su jornada planificada ───────────── */

function ProximaClinica({ alAgregar }: { alAgregar: (l: Omit<Lote, 'id'>[]) => void }) {
  const hoy = ymd(new Date());
  const hasta = new Date();
  hasta.setMonth(hasta.getMonth() + 6);
  const jornadas = useJornadas({ desde: hoy, hasta: ymd(hasta), estado: 'PLANIFICADA' });
  const asistencia = useAsistenciaJornadas();
  const { tiene } = useSesion();
  const [titulo, setTitulo] = useState('HIPERTENSION');
  const [elegidas, setElegidas] = useState<Set<number>>(new Set());
  // Cuántas de cada batey (por jornada). Sin tocar: los que se esperan en esa jornada, o una hoja.
  const [cantidades, setCantidades] = useState<Record<number, number>>({});
  const lista = useMemo(() => [...(jornadas.data ?? [])].sort((a, b) => a.fecha.localeCompare(b.fecha)), [jornadas.data]);

  if (jornadas.isPending) return <Cargando forma="lista" />;
  if (!lista.length)
    return (
      <Vacio titulo="No hay jornadas planificadas en los próximos 6 meses">
        La fecha de la etiqueta sale de la jornada planificada de cada batey.{' '}
        {tiene('jornadas.planificar') && (
          <Link to="/jornadas" className="underline">
            Planificar jornadas
          </Link>
        )}
      </Vacio>
    );

  const todas = elegidas.size === lista.length;
  const esperados = (communityId: number) => asistencia.data?.find((x) => x.communityId === communityId)?.promedio;
  const cantidadDe = (j: (typeof lista)[number]) => cantidades[j.id] ?? esperados(j.communityId) ?? 30;
  const cambiarCantidad = (id: number, n: number) => {
    setCantidades((c) => ({ ...c, [id]: n }));
    // Escribir una cantidad elige el batey
    setElegidas((s) => new Set(s).add(id));
  };
  const totalElegidas = lista.filter((j) => elegidas.has(j.id)).reduce((a, j) => a + cantidadDe(j), 0);
  const agregar = () =>
    alAgregar(
      lista
        .filter((j) => elegidas.has(j.id))
        .map((j) => ({
          nombre: `Próxima clínica · ${j.community.name}`,
          cantidad: cantidadDe(j),
          lineas: [linea(titulo.trim() || 'HIPERTENSION', 'negrita'), linea(`Próxima clínica - ${j.community.name}`, 'negrita'), linea(fechaEtiqueta(j.fecha), 'rojo')],
        })),
    );

  return (
    <div>
      <div className="border-b border-borde p-5">
        <Campo etiqueta="Primera línea" ayuda="El programa, como en el papel.">
          <Entrada value={titulo} maxLength={40} onChange={(e) => setTitulo(e.target.value.toUpperCase())} />
        </Campo>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-5 pt-4 pb-2">
        <div>
          <p className="text-sm font-medium">Jornadas planificadas</p>
          <p className="text-xs text-tenue">Pon cuántas de cada batey. Van seguidas: uno empieza donde termina el anterior, sin dejar la hoja a medias.</p>
        </div>
        <div className="flex gap-3 text-sm">
          <button type="button" className="text-tenue hover:text-tinta" onClick={() => setCantidades(Object.fromEntries(lista.map((j) => [j.id, 30])))}>
            Todas en 30
          </button>
          <button type="button" className="text-tenue hover:text-tinta" onClick={() => setElegidas(todas ? new Set() : new Set(lista.map((j) => j.id)))}>
            {todas ? 'Quitar todas' : 'Elegir todas'}
          </button>
        </div>
      </div>
      <ul className="divide-y divide-borde">
        {lista.map((j) => {
          const a = asistencia.data?.find((x) => x.communityId === j.communityId);
          const marcada = elegidas.has(j.id);
          return (
            <li key={j.id} className={cn('flex items-center gap-3 pr-5 hover:bg-fondo', marcada && 'bg-marca-50/60')}>
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 py-3 pl-5 text-sm">
                <input
                  type="checkbox"
                  className="size-5 accent-tinta"
                  checked={marcada}
                  onChange={() =>
                    setElegidas((s) => {
                      const n = new Set(s);
                      if (n.has(j.id)) n.delete(j.id);
                      else n.add(j.id);
                      return n;
                    })
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{j.community.name}</span>
                  <span className="block text-xs text-tenue">
                    {diaJornada(j.fecha, true)}
                    {a ? ` · se esperan ~${a.promedio}` : ''}
                  </span>
                </span>
                <span className="hidden text-xs font-medium tracking-wide text-red-600 sm:block">{fechaEtiqueta(j.fecha)}</span>
              </label>
              <Numero
                min={1}
                max={3000}
                aria-label={`Etiquetas de ${j.community.name}`}
                title={a ? `Se esperan ~${a.promedio}` : '30 = una hoja'}
                className={cn('h-9 w-20 shrink-0 text-center', !marcada && 'text-tenue')}
                valor={cantidadDe(j)}
                alCambiar={(n) => cambiarCantidad(j.id, n)}
              />
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-borde px-5 py-4">
        <span className="text-xs text-tenue">
          {elegidas.size
            ? `${elegidas.size} ${elegidas.size === 1 ? 'batey' : 'bateyes'} · ${totalElegidas.toLocaleString('es-DO')} etiquetas · ${Math.ceil(totalElegidas / HOJA.porHoja)} ${Math.ceil(totalElegidas / HOJA.porHoja) === 1 ? 'hoja' : 'hojas'}`
            : 'Elige las jornadas'}
        </span>
        <Boton icono={<Plus className="size-4" />} disabled={!elegidas.size} onClick={agregar}>
          Agregar a la hoja
        </Boton>
      </div>
      {tiene('jornadas.planificar') && (
        <p className="flex items-center gap-2 border-t border-borde px-5 py-3 text-xs text-tenue">
          <CalendarPlus className="size-3.5" /> ¿Falta un batey?{' '}
          <Link to="/jornadas" className="underline hover:text-tinta">
            Planifica su jornada
          </Link>{' '}
          y aparece aquí.
        </p>
      )}
    </div>
  );
}

/* ───────────── Medicamento: nombre y cómo tomarlo, con los números en rojo ───────────── */

function DeMedicamento({ alAgregar }: { alAgregar: (l: Omit<Lote, 'id'>[]) => void }) {
  const medicamentos = useMedicamentos();
  const guardadas = useQuery({ queryKey: ['etiquetas', 'indicaciones'], queryFn: indicacionesEtiquetas, staleTime: 5 * 60_000 });
  const { tiene } = useSesion();
  const cliente = useQueryClient();
  const [medId, setMedId] = useState('');
  const [nombre, setNombre] = useState('');
  const [indicacion, setIndicacion] = useState('');
  const [cantidad, setCantidad] = useState(30);
  const activos = (medicamentos.data ?? []).filter((m) => m.activo);

  const elegir = (id: string) => {
    setMedId(id);
    const m = activos.find((x) => String(x.id) === id);
    if (!m) return;
    // "ACETAMINOFEN 160MG", como en el papel
    setNombre(`${m.name} ${m.concentration.replace(/\s+/g, '')}`.toUpperCase());
    setIndicacion(guardadas.data?.[id] ?? 'Tomar 1 tableta 1 vez al día');
  };
  const guardar = useMutation({
    mutationFn: () => guardarIndicacionEtiqueta(Number(medId), indicacion.trim()),
    onSuccess: (d) => cliente.setQueryData(['etiquetas', 'indicaciones'], d),
  });
  const agregar = () => {
    alAgregar([{ nombre: nombre.trim(), cantidad, lineas: [linea(nombre.trim(), 'negrita'), linea(indicacion.trim(), 'numeros')] }]);
    // Se recuerda para la próxima vez (quien puede entregar medicamentos).
    if (medId && tiene('entregas.registrar') && guardadas.data?.[medId] !== indicacion.trim()) guardar.mutate();
  };

  if (medicamentos.isPending) return <Cargando forma="lista" />;
  return (
    <div className="space-y-4 p-5">
      <Campo etiqueta="Medicamento">
        <Selector vacio="Elegir…" value={medId} onChange={(e) => elegir(e.target.value)} opciones={activos.map((m) => ({ value: m.id, label: `${m.name} ${m.concentration}` }))} />
      </Campo>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_10rem]">
        <Campo etiqueta="Nombre en la etiqueta">
          <Entrada value={nombre} maxLength={40} onChange={(e) => setNombre(e.target.value.toUpperCase())} placeholder="ACETAMINOFEN 160MG" />
        </Campo>
        <Campo etiqueta="Cantidad" ayuda="30 = una hoja.">
          <Numero min={1} max={3000} valor={cantidad} alCambiar={setCantidad} />
        </Campo>
      </div>
      <Campo etiqueta="Cómo tomarlo" ayuda={medId && guardadas.data?.[medId] ? 'La indicación guardada para este medicamento. Si la cambias, se guarda al agregar.' : 'Los números salen en rojo. Se guarda para este medicamento al agregar.'}>
        <Entrada value={indicacion} maxLength={60} onChange={(e) => setIndicacion(e.target.value)} placeholder="Masticar 1 tableta 3 veces al día" />
      </Campo>
      {nombre && indicacion && (
        <div className="flex justify-center rounded-lg bg-fondo py-4">
          <EtiquetaMuestra lineas={[linea(nombre, 'negrita'), linea(indicacion, 'numeros')]} />
        </div>
      )}
      <div className="flex justify-end">
        <Boton icono={<Plus className="size-4" />} disabled={!nombre.trim() || !indicacion.trim()} onClick={agregar}>
          Agregar a la hoja
        </Boton>
      </div>
    </div>
  );
}

/* ───────────── Libre: hasta tres líneas, cada una con su estilo ───────────── */

function Libre({ alAgregar }: { alAgregar: (l: Omit<Lote, 'id'>[]) => void }) {
  const [lineas, setLineas] = useState<{ texto: string; estilo: Estilo }[]>([
    { texto: '', estilo: 'negrita' },
    { texto: '', estilo: 'negrita' },
    { texto: '', estilo: 'rojo' },
  ]);
  const [cantidad, setCantidad] = useState(30);
  const llenas = lineas.filter((l) => l.texto.trim());
  const cambiar = (i: number, c: Partial<{ texto: string; estilo: Estilo }>) => setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, ...c } : l)));

  return (
    <div className="space-y-4 p-5">
      {lineas.map((l, i) => (
        <div key={i} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_11rem]">
          <Campo etiqueta={`Línea ${i + 1}`}>
            <Entrada value={l.texto} maxLength={60} onChange={(e) => cambiar(i, { texto: e.target.value })} placeholder={['CHARLA DE NUTRICIÓN', 'Próxima clínica - Cuya', 'Traer la tarjeta'][i]} />
          </Campo>
          <Campo etiqueta="Estilo">
            <Selector value={l.estilo} onChange={(e) => cambiar(i, { estilo: e.target.value as Estilo })} opciones={ESTILOS} aria-label={`Estilo de la línea ${i + 1}`} />
          </Campo>
        </div>
      ))}
      <Campo etiqueta="Cantidad" ayuda="30 = una hoja." className="sm:w-40">
        <Numero min={1} max={3000} valor={cantidad} alCambiar={setCantidad} />
      </Campo>
      {llenas.length > 0 && (
        <div className="flex justify-center rounded-lg bg-fondo py-4">
          <EtiquetaMuestra lineas={llenas.map((l) => linea(l.texto, l.estilo))} />
        </div>
      )}
      <div className="flex justify-end">
        <Boton icono={<Plus className="size-4" />} disabled={!llenas.length} onClick={() => alAgregar([{ nombre: llenas[0].texto.trim(), cantidad, lineas: llenas.map((l) => linea(l.texto.trim(), l.estilo)) }])}>
          Agregar a la hoja
        </Boton>
      </div>
    </div>
  );
}

/* ───────────── Vista previa ───────────── */

/** Logo (pulgadas de ancho) y letra (pt) según las líneas: lo mismo que el PDF (pdf-etiquetas.ts, tamanoEtiqueta). */
const tamanoEtiqueta = (lineas: number) => (lineas <= 2 ? { logo: 1.5, letra: 14 } : { logo: 1.35, letra: 12.5 });

/** Una etiqueta como sale impresa (Times, el logo arriba), a la escala de `pulgada` px por pulgada. */
function EtiquetaMuestra({ lineas, pulgada = 96 }: { lineas: LineaEtiqueta[]; pulgada?: number }) {
  const pt = pulgada / 72;
  const tam = tamanoEtiqueta(lineas.length);
  return (
    <div
      className="flex flex-col items-center justify-center overflow-hidden bg-white text-center leading-[1.12] text-[#111] ring-1 ring-black/10"
      style={{ width: HOJA.etiquetaAncho * pulgada, height: HOJA.etiquetaAlto * pulgada, fontFamily: '"Times New Roman", Times, serif', fontSize: tam.letra * pt, borderRadius: 0.06 * pulgada }}
    >
      <img src="/logo-etiqueta.png" alt="" style={{ width: tam.logo * pulgada, marginBottom: 3 * pt }} />
      {lineas.map((l, i) => (
        <span
          key={i}
          className={cn('block max-w-full truncate px-1', l.negrita && 'font-bold', l.rojo && 'text-[#e11d20]')}
          // Como el PDF: si la línea es larga, la letra se achica para que quepa (aprox.: ~0.5 em por letra en Times).
          style={{ fontSize: Math.max(7, Math.min(tam.letra, ((HOJA.etiquetaAncho - 0.2) * 72) / (Math.max(1, l.texto.length) * 0.5))) * pt }}
        >
          {l.numerosEnRojo && !l.rojo
            ? l.texto.split(/(\d+(?:[.,]\d+)?)/).map((t, j) => (/^\d/.test(t) ? <span key={j} className="text-[#e11d20]">{t}</span> : t))
            : l.texto}
        </span>
      ))}
    </div>
  );
}

/** Tocar o arrastrar sobre las posiciones de la hoja: al arrastrar se aplica lo mismo que en la primera tocada (marcar o desmarcar). */
function useMarcarUsadas(usadas: Set<number>, alCambiar: (s: Set<number>) => void) {
  const [arrastre, setArrastre] = useState<boolean | null>(null);
  const poner = (n: number, usada: boolean) => {
    const s = new Set(usadas);
    if (usada) s.add(n);
    else s.delete(n);
    alCambiar(s);
  };
  const soltar = () => setArrastre(null);
  return {
    contenedor: { onPointerUp: soltar, onPointerLeave: soltar },
    posicion: (n: number) => ({
      'aria-pressed': usadas.has(n),
      onPointerDown: (e: React.PointerEvent) => {
        e.preventDefault();
        const marcar = !usadas.has(n);
        setArrastre(marcar);
        poner(n, marcar);
      },
      onPointerEnter: () => arrastre !== null && usadas.has(n) !== arrastre && poner(n, arrastre),
      onKeyDown: (e: React.KeyboardEvent) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), poner(n, !usadas.has(n))),
    }),
  };
}

/** Las 30 posiciones de la hoja: se tocan las ya usadas (una por una, o arrastrando el dedo o el ratón). */
function MarcarUsadas({ usadas, alCambiar }: { usadas: Set<number>; alCambiar: (s: Set<number>) => void }) {
  const m = useMarcarUsadas(usadas, alCambiar);
  return (
    <div className="grid w-52 shrink-0 touch-none select-none grid-cols-3 gap-1 rounded-md bg-fondo p-1.5" role="group" aria-label="Etiquetas usadas de la hoja" {...m.contenedor}>
      {Array.from({ length: HOJA.porHoja }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          {...m.posicion(n)}
          aria-label={`Etiqueta ${n}${usadas.has(n) ? ', usada' : ''}`}
          title={`Etiqueta ${n}${usadas.has(n) ? ' (usada)' : ''}`}
          className={cn(
            'h-7 cursor-pointer rounded-sm text-[11px] tabular-nums transition-colors',
            usadas.has(n) ? 'bg-[repeating-linear-gradient(135deg,rgba(0,0,0,0.18)_0_2px,rgba(0,0,0,0.06)_2px_5px)] text-tinta/50 line-through ring-1 ring-black/20' : 'bg-white text-tenue ring-1 ring-black/10 hover:bg-marca-100',
          )}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

/** Las hojas como van a salir, una a la vez. En la primera se tocan las etiquetas ya usadas (quedan rayadas). */
function VistaHoja({ reparto, usadas, alCambiar }: { reparto: (LineaEtiqueta[] | null)[][]; usadas: Set<number>; alCambiar: (s: Set<number>) => void }) {
  const m = useMarcarUsadas(usadas, alCambiar);
  const escala = 40; // px por pulgada: la hoja mide 340 × 440
  const hojas = reparto.length;
  const [hoja, setHoja] = useState(0);
  const actual = Math.min(hoja, hojas - 1);
  return (
    <Tarjeta
      titulo={hojas > 1 ? `Hoja ${actual + 1} de ${hojas}` : 'La hoja'}
      accion={
        hojas > 1 && (
          <div className="flex gap-1">
            <Boton variante="secundario" className="h-8 px-2" aria-label="Hoja anterior" disabled={actual === 0} onClick={() => setHoja(actual - 1)}>
              <ChevronLeft className="size-4" />
            </Boton>
            <Boton variante="secundario" className="h-8 px-2" aria-label="Hoja siguiente" disabled={actual === hojas - 1} onClick={() => setHoja(actual + 1)}>
              <ChevronRight className="size-4" />
            </Boton>
          </div>
        )
      }
    >
      {/* En el teléfono la hoja se puede deslizar de lado; nunca empuja la página */}
      {actual === 0 && <p className="px-4 pt-3 text-xs text-tenue">Toca en la hoja las etiquetas que ya están usadas, o arrastra sobre varias. Toca otra vez para dejarla libre.</p>}
      <div className="flex overflow-x-auto p-4">
        <div className="relative mx-auto shrink-0 touch-none select-none bg-white shadow-sm ring-1 ring-black/10" style={{ width: HOJA.ancho * escala, height: HOJA.alto * escala }} {...(actual === 0 ? m.contenedor : {})}>
          {Array.from({ length: HOJA.porHoja }, (_, i) => {
            const fila = Math.floor(i / HOJA.columnas);
            const col = i % HOJA.columnas;
            const lineas = reparto[actual][i];
            const usada = actual === 0 && usadas.has(i + 1);
            const lugar = { left: (HOJA.izquierda + col * HOJA.pasoColumna) * escala, top: (HOJA.arriba + fila * HOJA.etiquetaAlto) * escala };
            const contenido = lineas ? (
              <EtiquetaMuestra lineas={lineas} pulgada={escala} />
            ) : (
              <div
                className={cn('grid place-items-center rounded-[2px] text-[10px] tabular-nums ring-1', usada ? 'bg-[repeating-linear-gradient(135deg,rgba(0,0,0,0.12)_0_2px,rgba(0,0,0,0.03)_2px_6px)] text-tinta/50 ring-black/15' : 'text-tenue/70 ring-black/10')}
                style={{ width: HOJA.etiquetaAncho * escala, height: HOJA.etiquetaAlto * escala }}
              >
                {actual === 0 && (usada ? 'Usada' : i + 1)}
              </div>
            );
            // En la primera hoja cada etiqueta se toca para marcarla usada o libre
            return actual === 0 ? (
              <button
                key={i}
                type="button"
                className="absolute block cursor-pointer rounded-[2px] hover:ring-2 hover:ring-marca-400"
                style={lugar}
                {...m.posicion(i + 1)}
                aria-label={`Etiqueta ${i + 1}${usada ? ', usada' : ''}`}
                title={usada ? 'Usada: toca para dejarla libre' : 'Toca para marcarla usada'}
              >
                {contenido}
              </button>
            ) : (
              <div key={i} className="absolute" style={lugar}>
                {contenido}
              </div>
            );
          })}
        </div>
      </div>
    </Tarjeta>
  );
}
