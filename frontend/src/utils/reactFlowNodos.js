/**
 * Utilidades para reconstruir los nodos de React Flow sin perder las conexiones.
 *
 * Los diagramas rehacen su lista de nodos cada vez que cambian los datos (y en
 * la practica, en muchos renders mas). React Flow trata un nodo que llega SIN
 * `measured` como si fuera nuevo: descarta los limites de sus puntos de
 * conexion («handleBounds») para volver a medirlo. Pero la medicion la dispara
 * un ResizeObserver, que solo avisa cuando el tamaño CAMBIA; como la tarjeta
 * mide lo mismo que antes, nunca se vuelve a medir. Resultado: las tareas se
 * ven, pero las flechas no se pueden dibujar porque no hay donde engancharlas.
 *
 * Por eso, al sustituir los nodos, se arrastra la medicion del nodo anterior
 * con el mismo id. La posicion NO se arrastra: la nueva disposicion manda.
 */
export function conservarMedidas(nuevos, previos) {
  if (!previos || previos.length === 0) return nuevos;
  const porId = new Map(previos.map((n) => [n.id, n]));
  return nuevos.map((nodo) => {
    const previo = porId.get(nodo.id);
    return previo?.measured && !nodo.measured ? { ...nodo, measured: previo.measured } : nodo;
  });
}
