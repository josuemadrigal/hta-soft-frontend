import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Mail, Send } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { toast } from 'sonner';
import { useDetalleJornada } from '../api/consultas';
import { destinatariosResumen, enviarResumenJornada } from '../api/recursos';
import { useSesion } from '../auth/sesion';
import { AreaTexto, Boton, Campo, Cargando, Casilla, EncabezadoPagina, ErrorCarga, Insignia, Tarjeta, Vacio } from '../components/ui';
import { useEnLinea } from '../offline/datos';
import { cn } from '../lib/formato';
import { diaJornada } from './Jornadas';
import { useVolver } from '../lib/navegacion';

/** /jornadas/:id/enviar-resumen — manda el resumen por correo a quien se elija. Nunca sale solo. */
export function EnviarResumen() {
  const id = Number(useParams().id);
  const jornada = useDetalleJornada(id);
  const lista = useQuery({ queryKey: ['jornadas', 'destinatarios'], queryFn: destinatariosResumen });
  const { usuario } = useSesion();
  const enLinea = useEnLinea();
  const volverA = useVolver();
  const cliente = useQueryClient();
  const [elegidos, setElegidos] = useState<Set<number>>(new Set());
  const [nombres, setNombres] = useState(false);
  const [nota, setNota] = useState('');

  const enviar = useMutation({
    mutationFn: () => enviarResumenJornada(id, { destinatarios: [...elegidos], nombres, nota: nota.trim() || undefined }),
    onSuccess: (r) => {
      cliente.invalidateQueries({ queryKey: ['auditoria'] });
      toast.success(
        r.simulado
          ? 'Resumen generado. El servidor no tiene correo configurado: quedó en la consola del backend.'
          : `Resumen enviado a ${r.para?.join(', ')}.`,
      );
      volverA(`/jornadas/${id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  if (jornada.isPending || lista.isPending) return <Cargando />;
  if (jornada.isError) return <ErrorCarga error={jornada.error} />;
  if (lista.isError) return <ErrorCarga error={lista.error} />;
  const j = jornada.data.jornada;
  if (j.estado === 'CANCELADA') return <Vacio titulo="La jornada está cancelada">No hay resumen que enviar.</Vacio>;

  const t = j.estado === 'CERRADA' && j.resumen ? j.resumen : jornada.data.totales;
  const usuarios = lista.data.usuarios;
  const confirmados = usuarios.filter((u) => u.confirmado);
  const sinConfirmar = usuarios.length - confirmados.length;
  const alternar = (uid: number) =>
    setElegidos((s) => {
      const n = new Set(s);
      if (n.has(uid)) n.delete(uid);
      else n.add(uid);
      return n;
    });

  return (
    <>
      <EncabezadoPagina
        titulo="Enviar resumen por correo"
        descripcion={`${j.community.name} · ${diaJornada(j.fecha, true)}`}
        volver={{ a: `/jornadas/${id}`, texto: j.community.name }}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Tarjeta
            titulo="Para"
            accion={
              confirmados.length > 1 && (
                <button type="button" className="text-sm text-tenue hover:text-tinta" onClick={() => setElegidos(elegidos.size === confirmados.length ? new Set() : new Set(confirmados.map((u) => u.id)))}>
                  {elegidos.size === confirmados.length ? 'Quitar todos' : 'Elegir todos'}
                </button>
              )
            }
          >
            {usuarios.length === 0 ? (
              <Vacio titulo="No hay usuarios que puedan recibirlo" />
            ) : (
              <ul className="divide-y divide-borde">
                {usuarios.map((u) => (
                  <li key={u.id}>
                    <label className={cn('flex items-center gap-3 px-5 py-3 text-sm', u.confirmado ? 'cursor-pointer hover:bg-fondo' : 'opacity-60')}>
                      <input type="checkbox" className="size-5 accent-tinta" disabled={!u.confirmado} checked={elegidos.has(u.id)} onChange={() => alternar(u.id)} />
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">
                          {u.nombre} {u.id === usuario?.id && <span className="font-normal text-tenue">(tú)</span>}
                        </span>
                        <span className="block truncate text-xs text-tenue">
                          {u.email} · {u.rol}
                        </span>
                      </span>
                      {!u.confirmado && <Insignia color="#a16207">Correo sin confirmar</Insignia>}
                    </label>
                  </li>
                ))}
              </ul>
            )}
            {sinConfirmar > 0 && (
              <p className="border-t border-borde px-5 py-3 text-sm text-tenue">
                El resumen lleva datos de salud: solo se manda a correos confirmados. Cada persona confirma el suyo desde{' '}
                <Link to="/cuenta" className="underline">
                  Mi cuenta
                </Link>
                .
              </p>
            )}
          </Tarjeta>

          <Tarjeta titulo="Contenido">
            <div className="space-y-4 p-5">
              <Casilla etiqueta="Incluir los nombres de los pacientes (si no, solo el código)" checked={nombres} onChange={(e) => setNombres(e.target.checked)} />
              <Campo etiqueta="Nota (opcional)" ayuda="Aparece arriba del resumen: lo que faltó, lo que hay que llevar la próxima vez…">
                <AreaTexto rows={3} maxLength={1000} value={nota} onChange={(e) => setNota(e.target.value)} />
              </Campo>
            </div>
          </Tarjeta>

          <div className="flex justify-end gap-2">
            <Boton variante="secundario" onClick={() => volverA(`/jornadas/${id}`)}>
              Cancelar
            </Boton>
            <Boton
              icono={<Send className="size-4" />}
              disabled={!elegidos.size || !enLinea}
              title={!enLinea ? 'Sin conexión' : undefined}
              cargando={enviar.isPending}
              onClick={() => enviar.mutate()}
            >
              {elegidos.size > 1 ? `Enviar a ${elegidos.size} personas` : 'Enviar'}
            </Boton>
          </div>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <Tarjeta titulo="Lo que lleva el correo">
            <ul className="space-y-2 p-5 text-sm">
              <li className="flex justify-between gap-3">
                <span className="text-tenue">Atendidos</span>
                <strong>{t.atendidos}</strong>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-tenue">Faltan por ver</span>
                <strong>{t.faltan}</strong>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-tenue">Marcados "No vino"</span>
                <strong>{t.noVinieron ?? 0}</strong>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-tenue">Controlados</span>
                <strong>{t.controlados}</strong>
              </li>
            </ul>
            <p className="flex gap-2 border-t border-borde px-5 py-3 text-sm text-tenue">
              <Mail className="mt-0.5 size-4 shrink-0" />
              Además: medicamentos entregados, pacientes con HTA grado 2 o crisis y la lista de los que faltan, con el motivo si se marcó "No vino".
            </p>
            {!lista.data.correoConfigurado && (
              <p className="border-t border-borde bg-amber-50 px-5 py-3 text-sm text-amber-800">El servidor no tiene correo configurado: el resumen no saldrá (en desarrollo se escribe en la consola).</p>
            )}
          </Tarjeta>
        </aside>
      </div>
    </>
  );
}
