import { AlertTriangle } from 'lucide-react';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Boton } from './ui';

type Opciones = {
  titulo: string;
  mensaje: ReactNode;
  /** Texto del botón que confirma (por defecto "Eliminar"). */
  confirmar?: string;
  /** Acción destructiva: botón rojo. Por defecto true. */
  peligro?: boolean;
};

type Pendiente = Opciones & { resolver: (ok: boolean) => void };

const Contexto = createContext<((o: Opciones) => Promise<boolean>) | null>(null);

/**
 * Reemplaza window.confirm por un diálogo propio: `if (await confirmar({...})) borrar()`.
 * Usa <dialog> nativo: Esc cancela y el foco queda atrapado mientras está abierto.
 */
export function ProveedorConfirmar({ children }: { children: ReactNode }) {
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const ref = useRef<HTMLDialogElement>(null);

  const confirmar = useCallback((o: Opciones) => new Promise<boolean>((resolver) => setPendiente({ ...o, resolver })), []);

  useEffect(() => {
    const d = ref.current;
    if (pendiente && d && !d.open) d.showModal();
  }, [pendiente]);

  const cerrar = (ok: boolean) => {
    pendiente?.resolver(ok);
    ref.current?.close();
    setPendiente(null);
  };
  const peligro = pendiente?.peligro ?? true;

  return (
    <Contexto.Provider value={confirmar}>
      {children}
      <dialog
        ref={ref}
        onCancel={(e) => {
          e.preventDefault();
          cerrar(false);
        }}
        onClick={(e) => e.target === e.currentTarget && cerrar(false)}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-borde bg-superficie p-0 text-tinta shadow-2xl backdrop:bg-tinta/40 backdrop:backdrop-blur-[2px]"
        aria-labelledby="confirmar-titulo"
      >
        {pendiente && (
          <div className="p-6">
            <div className="flex gap-4">
              <span className={`grid size-10 shrink-0 place-items-center rounded-full ${peligro ? 'bg-red-50 text-red-600' : 'bg-marca-100 text-marca-700'}`}>
                <AlertTriangle className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 id="confirmar-titulo" className="font-semibold">
                  {pendiente.titulo}
                </h2>
                <div className="mt-1.5 text-sm text-tenue">{pendiente.mensaje}</div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Boton variante="secundario" onClick={() => cerrar(false)} autoFocus>
                Cancelar
              </Boton>
              <Boton variante={peligro ? 'peligro' : 'primario'} onClick={() => cerrar(true)}>
                {pendiente.confirmar ?? 'Eliminar'}
              </Boton>
            </div>
          </div>
        )}
      </dialog>
    </Contexto.Provider>
  );
}

export function useConfirmar() {
  const c = useContext(Contexto);
  if (!c) throw new Error('useConfirmar fuera de ProveedorConfirmar');
  return c;
}
