import { CloudOff, RefreshCw, Trash2, Wifi } from 'lucide-react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { useConfirmar } from '../components/confirmar';
import { Boton, EncabezadoPagina, Insignia, Tarjeta, Vacio } from '../components/ui';
import { fechaYHora } from '../lib/formato';
import { descartarPendiente, reintentarPendiente, sincronizar, useEstadoSincronizacion, usePendientes } from '../offline/cola';
import { useEnLinea } from '../offline/datos';

const TIPOS = { visita: 'Visita', 'no-vino': 'No vino', 'quitar-no-vino': 'Deshacer "No vino"' } as const;

/** /sincronizacion — lo registrado sin internet que falta por enviar, y lo que el servidor rechazó. */
export function Sincronizacion() {
  const pendientes = usePendientes();
  const estado = useEstadoSincronizacion();
  const enLinea = useEnLinea();
  const confirmar = useConfirmar();
  const conError = pendientes.filter((p) => p.error);

  const enviarAhora = async () => {
    const r = await sincronizar();
    if (r.enviados) toast.success(`${r.enviados} ${r.enviados === 1 ? 'registro enviado' : 'registros enviados'}`);
    if (r.conError) toast.error(`${r.conError} ${r.conError === 1 ? 'registro fue rechazado' : 'registros fueron rechazados'}: revísalos abajo`);
  };

  return (
    <>
      <EncabezadoPagina
        titulo="Sin conexión y pendientes"
        descripcion="Lo que se registra sin internet queda guardado en este dispositivo y se envía solo cuando vuelve la señal."
        acciones={
          <Boton icono={<RefreshCw className="size-4" />} disabled={!enLinea || !pendientes.length} cargando={estado.sincronizando} onClick={() => void enviarAhora()}>
            Enviar ahora
          </Boton>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-borde bg-superficie px-5 py-3 text-sm">
        {enLinea ? <Wifi className="size-4 text-green-700" /> : <CloudOff className="size-4 text-amber-700" />}
        <span className="flex-1">
          {enLinea ? 'Hay conexión.' : 'Sin conexión: puedes seguir registrando visitas y "No vino" en los bateyes que descargaste.'}
          {estado.ultimo && <span className="text-tenue"> Último intento de envío: {fechaYHora(estado.ultimo)}.</span>}
        </span>
      </div>

      <Tarjeta titulo={`Pendientes de enviar (${pendientes.length})`}>
        {pendientes.length === 0 ? (
          <Vacio titulo="Todo está enviado">Nada esperando en este dispositivo.</Vacio>
        ) : (
          <ul className="divide-y divide-borde">
            {pendientes.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <Insignia color={p.error ? '#dc2626' : '#a16207'}>{TIPOS[p.tipo]}</Insignia>
                <div className="min-w-0 flex-1">
                  <Link to={`/pacientes/${p.resumen.pacienteId}`} className="font-medium hover:underline">
                    {p.resumen.paciente}
                  </Link>
                  <p className="text-xs text-tenue">
                    {p.resumen.detalle} · registrado {fechaYHora(p.creado)}
                  </p>
                  {p.error && <p className="mt-1 text-xs text-red-600">El servidor lo rechazó: {p.error}</p>}
                </div>
                {p.error && (
                  <Boton variante="secundario" className="h-8 text-xs" disabled={!enLinea} onClick={() => void reintentarPendiente(p.id)}>
                    Reintentar
                  </Boton>
                )}
                <Boton
                  variante="fantasma"
                  className="h-8 px-2 hover:text-red-600"
                  aria-label="Descartar"
                  onClick={async () => {
                    if (
                      await confirmar({
                        titulo: '¿Descartar este registro?',
                        mensaje: 'Se borra de este dispositivo y no se enviará. Si es una visita, habrá que registrarla de nuevo.',
                        confirmar: 'Descartar',
                      })
                    )
                      void descartarPendiente(p.id);
                  }}
                >
                  <Trash2 className="size-4" />
                </Boton>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>
      {conError.length > 0 && (
        <p className="mt-3 text-sm text-tenue">
          Un registro rechazado no se reintenta solo. Lo más común es que falte inventario: carga la entrada del medicamento y pulsa "Reintentar".
        </p>
      )}
    </>
  );
}
