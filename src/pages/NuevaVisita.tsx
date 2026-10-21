import { ArrowLeft, CalendarCheck2, ClipboardPlus, Pencil } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { usePaciente } from '../api/consultas';
import type { Paciente } from '../api/tipos';
import { usePermisosVisita } from '../auth/permisosVisita';
import { FormularioVisita } from '../components/FormularioVisita';
import { ymd } from '../components/SelectorFecha';
import { Boton, Cargando, EncabezadoPagina, Vacio } from '../components/ui';
import { atendio, edadTexto, nombreCompleto } from '../lib/formato';
import { usePendientes } from '../offline/cola';
import { useVolver } from '../lib/navegacion';

const HORA = new Intl.DateTimeFormat('es-DO', { hour: 'numeric', minute: '2-digit' });

/** /pacientes/:id/visita. Con ?volver=/jornada?batey=X regresa a la jornada al guardar. */
export function NuevaVisita() {
  const id = Number(useParams().id);
  const [params] = useSearchParams();
  // Solo rutas internas: evita que un enlace manipulado mande a otro sitio.
  const pedido = params.get('volver');
  const volver = pedido?.startsWith('/') && !pedido.startsWith('//') ? pedido : `/pacientes/${id}`;
  const navegar = useNavigate();
  const volverA = useVolver();
  const paciente = usePaciente(id);
  const pendientes = usePendientes();
  // Ya eligió "Registrar otra visita": no se vuelve a preguntar.
  const [otra, setOtra] = useState(false);

  if (paciente.isPending) return <Cargando />;
  if (!paciente.data) return <Vacio titulo="Paciente no encontrado" />;
  const p = paciente.data;

  // ¿Ya tiene una visita hoy? En el servidor, o guardada sin internet y todavía sin enviar.
  const hoy = ymd(new Date());
  const deHoy = (p.clinicalVisits ?? []).find((v) => ymd(new Date(v.visitDate)) === hoy);
  const pendienteHoy = pendientes.find((x) => x.tipo === 'visita' && x.resumen.pacienteId === p.id && ymd(new Date(x.creado)) === hoy);

  return (
    <>
      <EncabezadoPagina
        titulo={`Visita · ${nombreCompleto(p)}`}
        descripcion={
          <>
            <span className="font-mono">{p.patientCode}</span> · {edadTexto(p)} · {p.community?.name}
          </>
        }
        volver={{ a: volver, texto: volver.startsWith('/jornada') ? 'Jornada' : nombreCompleto(p) }}
      />
      <FormularioVisita paciente={p} alGuardar={() => volverA(volver)} />
      {!otra && (deHoy || pendienteHoy) && (
        <AvisoVisitaHoy
          paciente={p}
          visita={deHoy}
          sinEnviar={!deHoy && !!pendienteHoy}
          alEditar={(visitaId) => navegar(`/visitas/${visitaId}/editar`, { replace: true })}
          alRegistrarOtra={() => setOtra(true)}
          alVolver={() => navegar(volver, { replace: true })}
        />
      )}
    </>
  );
}

/**
 * Ya se le registró una visita hoy: casi siempre es un toque doble o alguien que no sabía.
 * Se pregunta antes de llenar nada: corregir la de hoy, registrar otra de verdad, o volver.
 */
function AvisoVisitaHoy({
  paciente,
  visita,
  sinEnviar,
  alEditar,
  alRegistrarOtra,
  alVolver,
}: {
  paciente: Paciente;
  visita?: NonNullable<Paciente['clinicalVisits']>[number];
  sinEnviar: boolean;
  alEditar: (id: number) => void;
  alRegistrarOtra: () => void;
  alVolver: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const permisos = usePermisosVisita();
  const puedeEditar = !!visita && permisos.puedeEditar(visita);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const s = visita && (visita.systolicManual ?? visita.systolicAuto);
  const d = visita && (visita.diastolicManual ?? visita.diastolicAuto);

  return (
    <dialog
      ref={ref}
      // Escape = lo más seguro: volver sin registrar nada.
      onCancel={(e) => {
        e.preventDefault();
        alVolver();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-borde bg-superficie p-0 text-tinta shadow-2xl backdrop:bg-tinta/40 backdrop:backdrop-blur-[2px]"
      aria-labelledby="visita-hoy-titulo"
    >
      <div className="p-6">
        <div className="flex gap-4">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-marca-100 text-marca-700">
            <CalendarCheck2 className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="visita-hoy-titulo" className="font-semibold text-balance">
              {nombreCompleto(paciente)} ya tiene una visita hoy
            </h2>
            {visita ? (
              <dl className="mt-3 space-y-1 rounded-lg bg-fondo px-3 py-2.5 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-tenue">Registrada</dt>
                  <dd>a las {HORA.format(new Date(visita.createdAt ?? visita.visitDate))}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-tenue">Atendió</dt>
                  <dd className="truncate">{atendio(visita)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-tenue">Presión</dt>
                  <dd className="tabular font-mono">{s && d ? `${s}/${d}` : 'sin toma'}</dd>
                </div>
              </dl>
            ) : (
              <p className="mt-1.5 text-sm text-tenue">Se guardó en esta tableta sin internet y se enviará sola cuando vuelva la conexión.</p>
            )}
            <p className="mt-3 text-sm text-tenue">
              {puedeEditar
                ? 'Si hay que cambiar algo, corrige esa visita. Registra otra solo si de verdad volvió a consulta hoy.'
                : sinEnviar
                  ? 'Registra otra solo si de verdad volvió a consulta hoy.'
                  : 'Registra otra solo si de verdad volvió a consulta hoy. Para corregir la de hoy, pídeselo a quien la registró o a un administrador.'}
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-col gap-2">
          {puedeEditar && (
            <Boton className="h-11 w-full" icono={<Pencil className="size-4" />} onClick={() => alEditar(visita!.id)} autoFocus>
              Corregir la visita de hoy
            </Boton>
          )}
          <Boton variante={puedeEditar ? 'secundario' : 'primario'} className="h-11 w-full" icono={<ClipboardPlus className="size-4" />} onClick={alRegistrarOtra} autoFocus={!puedeEditar}>
            Registrar otra visita
          </Boton>
          <Boton variante="fantasma" className="h-11 w-full" icono={<ArrowLeft className="size-4" />} onClick={alVolver}>
            Volver
          </Boton>
        </div>
      </div>
    </dialog>
  );
}
