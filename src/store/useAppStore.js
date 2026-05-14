import { create } from 'zustand'

const useAppStore = create((set) => ({
  clienteSeleccionado: null,
  setClienteSeleccionado: (cliente) => set({ clienteSeleccionado: cliente }),
  pedidosPendientesCount: 0,
  setPedidosPendientesCount: (count) => set({ pedidosPendientesCount: count }),
}))

export default useAppStore
