import React, { useEffect, useState, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { toast } from 'sonner'
import { Plus, Trash2, PackageSearch, Building2, Pencil, Trash, Filter, Layers, Check, X, ShieldAlert } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'

// Mapeo estático de descripciones de productos para fichas técnicas (claves en minúscula)
const PRODUCT_DESCRIPTIONS = {
  "playera algodón crudo navidad": "Playera de algodón grueso premium color crudo/hueso con diseño especial de Navidad.",
  "playera algodón negra navidad": "Playera oversize premium en color negro con estampado conmemorativo navideño.",
  "poster edición navidad 2025": "Póster oficial conmemorativo del concierto navideño 2025 de La Cotorrisa.",
  "baby gerry": "Peluche oficial coleccionable de Gerry, textura extra suave y detalles bordados.",
  "playera la cotorrisa slobo vaca - arena": "Playera oficial edición Slobo Vaca en color arena lavado premium.",
  "playera la cotorrisa ricardo rickachu - green": "Playera oficial de algodón edición Ricardo Rickachu color verde.",
  "jersey - cotorrisa": "Jersey oficial de La Cotorrisa. Tela dry-fit premium, parches bordados y sublimación de alta resistencia.",
  "acid washtee": "Playera oficial de aniversario con diseño acid wash desgastado premium.",
  "acid washhoodie": "Sudadera de felpa premium con gorro y textura acid wash de colección 7mo Aniversario.",
  "300 whitetee": "Playera oversize premium blanca con estampado trasero de aniversario.",
  "tee negra": "Playera oversize básica premium de corte streetwear en color negro de aniversario.",
  "slobyhat crema": "Gorro bucket hat clásico color crema con bordado fino de La Cotorrisa.",
  "slobyhat flama rosa": "Gorro bucket hat rosa con diseño de flamas bordadas.",
  "slobyhat flama negra capibara": "Gorro bucket hat negro con diseño de flamas y capibara.",
  "slobyhat roja flama amarilla": "Gorro bucket hat rojo con diseño de flamas amarillas.",
  "jersey la cotorrisa — edición plumas": "Jersey oficial edición Plumas, tela dry-fit premium y diseño sublimado exclusivo.",
  "edición regia - blanca": "Playera blanca de colección especial Monterrey/Regia.",
  "edición regia - beige": "Playera beige de colección especial Monterrey/Regia.",
  "póster firmado — villahermosa": "Póster oficial autografiado por Ricardo y Slobotzky en la gira Villahermosa.",
  "póster firmado — orizaba": "Póster oficial autografiado por Ricardo y Slobotzky en la gira Orizaba.",
  "hoodie - para talla dama/infantil": "Sudadera premium rosa pastel para dama o infantil con forro abrigador.",
  "playera la cotorrisa — edición en las nubes": "Playera oficial ilustración En Las Nubes, algodón premium.",
  "ricardo rickachu - beige": "Playera oficial de algodón edición Ricardo Rickachu color beige.",
  "ricardo rickachu - pink": "Playera oficial de algodón edición Ricardo Rickachu color rosa pastel.",
  "ricardo rickachu - crudo": "Playera oficial de algodón edición Ricardo Rickachu color crudo/hueso.",
  "ricardo rickachu - cafe": "Playera oficial de algodón edición Ricardo Rickachu color café oscuro.",
  "cotorro alas extendidas by ricardo pérez & slobotzky": "Playera oficial con el icónico logotipo del cotorro con las alas extendidas.",
  "default": "Prenda o artículo oficial de la tienda de La Cotorrisa."
};

// Mapeo automático de categorías por nombre
const getProductCategory = (name) => {
  const n = name.toLowerCase().trim();
  if (n.includes('jersey')) return 'Jerseys';
  if (n.includes('poster') || n.includes('póster')) return 'Pósters';
  if (n.includes('hoodie') || n.includes('sudadera')) return 'Sudaderas';
  if (n.includes('gerry') || n.includes('peluche') || n.includes('baby') || n.includes('slobyhat') || n.includes('hat')) return 'Accesorios';
  if (n.includes('playera') || n.includes('tee') || n.includes('rickachu') || n.includes('regia') || n.includes('nubes') || n.includes('vaca') || n.includes('crudo')) return 'Playeras';
  return 'Otros';
};

// Mapeo dinámico de imágenes reales de Google Cloud / Firebase Storage
const PRODUCT_IMAGES = {
  "playera algodón crudo navidad": "https://storage.googleapis.com/colivery-2b6dd.firebasestorage.app/products/3d8a9c12-70d5-476d-b5b1-f14217ce02a0.jpg",
  "playera algodón negra navidad": "https://storage.googleapis.com/colivery-2b6dd.firebasestorage.app/products/e57734d3-1514-4027-9dae-9641379ff7f0.jpg",
  "poster edición navidad 2025": "https://storage.googleapis.com/colivery-2b6dd.firebasestorage.app/products/dee2ed02-7219-463e-b509-4db82500e23d.png",
  "baby gerry": "https://storage.googleapis.com/colivery-2b6dd.firebasestorage.app/products/73031a89-25ec-4450-b1fe-7bb350cc3339.jpg",
  "playera la cotorrisa slobo vaca - arena": "https://storage.googleapis.com/colivery-2b6dd.firebasestorage.app/products/e2ee6c18-f746-434e-a0e9-449d27af93b0.jpg",
  "playera la cotorrisa ricardo rickachu - green": "https://storage.googleapis.com/colivery-2b6dd.firebasestorage.app/products/cb05547d-7caf-417c-bae5-3fafc81cd51c.jpg",
  "jersey - cotorrisa": "https://storage.googleapis.com/colivery-2b6dd.firebasestorage.app/products/f5eb46a6-2445-43ab-971f-b5c0ca571830.jpeg",
  "acid washtee": "https://storage.googleapis.com/colivery-2b6dd.firebasestorage.app/products/bd751596-385c-4972-8efc-e8995bd3b049.png",
  "acid washhoodie": "https://storage.googleapis.com/colivery-2b6dd.firebasestorage.app/products/1b82e95d-c5a4-4913-8033-d6df3be40619.png",
  "300 whitetee": "https://storage.googleapis.com/colivery-2b6dd.firebasestorage.app/products/653906a2-6b7a-4c4f-9a95-be7ef71735a9.png",
  "tee negra": "https://storage.googleapis.com/colivery-2b6dd.firebasestorage.app/products/b8b2a06b-82c6-496d-ae1f-f6d9de59d5f4.png",
  "slobyhat crema": "https://storage.googleapis.com/colivery-2b6dd.firebasestorage.app/products/565c3460-5484-4355-96db-7db793a65f43.webp",
  "slobyhat flama rosa": "https://storage.googleapis.com/colivery-2b6dd.firebasestorage.app/products/9dc0f2e9-bc3b-493d-b95d-5655ddfc0581.webp",
  "slobyhat flama negra capibara": "https://storage.googleapis.com/colivery-2b6dd.firebasestorage.app/products/6c4a1717-9901-4e1a-b80c-0e0d97a8ae62.webp",
  "slobyhat roja flama amarilla": "https://storage.googleapis.com/colivery-2b6dd.firebasestorage.app/products/7980863d-996f-42d1-a069-d93168b8141f.webp",
  "jersey la cotorrisa — edición plumas": "https://storage.googleapis.com/colivery-2b6dd.firebasestorage.app/products/dec7f597-515d-4ddb-bcf1-2ab3c0ea4a25.jpeg",
  "edición regia - blanca": "https://storage.googleapis.com/colivery-2b6dd.firebasestorage.app/products/8521f79c-aed4-4f99-bf89-947e6d770b4d.jpeg",
  "edición regia - beige": "https://storage.googleapis.com/colivery-2b6dd.firebasestorage.app/products/01a102fa-f4e3-4ae0-8a83-5f49a9ee1b6b.png",
  "póster firmado — villahermosa": "https://storage.googleapis.com/colivery-2b6dd.firebasestorage.app/products/c86639ab-58da-40a5-b432-4d4ca1847d07.jpg",
  "póster firmado — orizaba": "https://storage.googleapis.com/colivery-2b6dd.firebasestorage.app/products/06be81d2-86dd-423c-bfc8-811ef0389647.jpg",
  "hoodie - para talla dama/infantil": "https://storage.googleapis.com/colivery-2b6dd.firebasestorage.app/products/3f51fe5c-d2a6-4840-8f02-6c3c7a5d01eb.jpg",
  "playera la cotorrisa — edición en las nubes": "https://storage.googleapis.com/colivery-2b6dd.firebasestorage.app/products/d2efb2fb-b433-4bed-a00f-7c7bc6df68dc.jpeg",
  "ricardo rickachu - beige": "https://storage.googleapis.com/colivery-2b6dd.firebasestorage.app/products/7a9e502c-4cca-4976-9ad8-3ca058ac833d.jfif",
  "ricardo rickachu - pink": "https://storage.googleapis.com/colivery-2b6dd.firebasestorage.app/products/3e7383ff-d396-4440-83f4-327ff2f213e6.jpg",
  "ricardo rickachu - crudo": "https://storage.googleapis.com/colivery-2b6dd.firebasestorage.app/products/65c9b0ec-5eb2-429a-9d86-e495dd8267c7.jpg",
  "ricardo rickachu - cafe": "https://storage.googleapis.com/colivery-2b6dd.firebasestorage.app/products/eb972155-5b89-421c-8135-5d37f512f0c9.jpg",
};

const PRODUCT_MONGODB_IDS = {
  "playera algodón crudo navidad": "69488ea48d75380689743686",
  "playera algodón negra navidad": "69488ea78d75380689743697",
  "poster edición navidad 2025": "6948a70ec727ac47fd85cbb9",
  "baby gerry": "6949a3e5aae70b57d056cc14",
  "playera la cotorrisa slobo vaca - arena": "694b54139d9b79405ed8da33",
  "playera la cotorrisa ricardo rickachu - green": "694b584d9d9b79405ed8dc60",
  "jersey - cotorrisa": "698cff79facc909e40c06bc2",
  "acid washtee": "69cf3707071959e80481c860",
  "acid washhoodie": "69cf3875071959e80481ca5a",
  "300 whitetee": "69cf3906071959e80481cabe",
  "tee negra": "69cf39d9071959e80481cb25",
  "slobyhat crema": "69ea900940f3a480016f4592",
  "slobyhat flama rosa": "69ea912140f3a480016f4786",
  "slobyhat flama negra capibara": "69ea91ab40f3a480016f49ad",
  "slobyhat roja flama amarilla": "69ea921a40f3a480016f4af3",
  "jersey la cotorrisa — edición plumas": "6a1b1889bcb31b4d81b827ec",
  "edición regia - blanca": "6a1b19f8bcb31b4d81b83251",
  "edición regia - beige": "6a1b1c80bcb31b4d81b84004",
  "póster firmado — villahermosa": "6a1b1ec7bcb31b4d81b84c4d",
  "póster firmado — orizaba": "6a1b2020bcb31b4d81b85943",
  "hoodie - para talla dama/infantil": "6a1b20a0bcb31b4d81b8599f",
  "playera la cotorrisa — edición en las nubes": "6a1b27bcbcb31b4d81b8764a",
  "ricardo rickachu - beige": "6a1b2fc2bcb31b4d81b88ad5",
  "ricardo rickachu - pink": "6a1b32acbcb31b4d81b89cec",
  "ricardo rickachu - crudo": "6a1b3344bcb31b4d81b89ed5",
  "ricardo rickachu - cafe": "6a1b33e0bcb31b4d81b8a1f3",
  "cotorro alas extendidas by ricardo pérez & slobotzky": "6a21be00d58726cba629462f"
};

const getProductImage = (name) => {
  const n = name.toLowerCase().trim();
  return PRODUCT_IMAGES[n] || '/img/default-product.png';
};

// Tallas conocidas para ordenar en la ficha técnica
const SIZE_ORDER = ['XS', 'S', 'CH', 'M', 'MED', 'L', 'GDE', 'XL', 'XXL', '2XL', 'XXXL', '3XL', 'N/A'];

// Mapeo inteligente de nombres de productos para consistencia con pedidos
const mapProductName = (title) => {
  return title.trim();
};

// Normalizar texto para comparaciones robustas (elimina acentos y caracteres especiales)
const normalizeText = (str) => {
  if (!str) return '';
  return str.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

// Mapear nombres normalizados de pedidos a nombres canónicos del inventario
const getNormalizedCanonicalName = (normName) => {
  if (normName.includes('acid wash tee') || normName.includes('acidwashtee') || normName === 'playera acid wash' || normName === 'acid washtee') {
    return 'acid washtee';
  }
  if (normName.includes('sudadera acid wash') || normName.includes('acidwashhoodie') || normName === 'acid washhoodie') {
    return 'acid washhoodie';
  }
  if (normName.includes('oversize blanca') || normName.includes('300whitetee') || normName === '300 whitetee') {
    return '300 whitetee';
  }
  if (normName.includes('oversize negra') || normName.includes('teenegra') || normName === 'tee negra') {
    return 'tee negra';
  }
  if (normName.includes('alas extendidas') || normName.includes('cotorro alas') || normName.includes('cotorra club')) {
    return 'cotorro alas extendidas by ricardo perez slobotzky';
  }
  if (normName.includes('jersey cotorrisa') || normName === 'jersey cotorrisa') {
    return 'jersey - cotorrisa';
  }
  if (normName.includes('navidad') && normName.includes('poster')) {
    return 'poster edicion navidad 2025';
  }
  if (normName.includes('gerry')) {
    return 'baby gerry';
  }
  if (normName.includes('slobo vaca') || normName.includes('arena vaca') || normName.includes('vaca arena') || normName.includes('slobo vaca arena')) {
    return 'playera la cotorrisa slobo vaca - arena';
  }
  if (normName.includes('rickachu green') || normName.includes('pikachu green') || normName.includes('ricardo rickachu green')) {
    return 'playera la cotorrisa ricardo rickachu - green';
  }
  if (normName.includes('plumas')) {
    return 'jersey la cotorrisa — edicion plumas';
  }
  if (normName.includes('regia') && normName.includes('blanca')) {
    return 'edicion regia - blanca';
  }
  if (normName.includes('regia') && normName.includes('beige')) {
    return 'edicion regia - beige';
  }
  if (normName.includes('nubes')) {
    return 'playera la cotorrisa — edicion en las nubes';
  }
  if (normName.includes('firmado') && normName.includes('villahermosa')) {
    return 'poster firmado — villahermosa';
  }
  if (normName.includes('firmado') && normName.includes('orizaba')) {
    return 'poster firmado — orizaba';
  }
  if (normName.includes('dama infantil') || normName.includes('pink hoodie') || normName.includes('pink hoddie') || normName.includes('xs pink')) {
    return 'hoodie - para talla dama infantil';
  }
  if (normName.includes('rickachu beige')) {
    return 'ricardo rickachu - beige';
  }
  if (normName.includes('rickachu pink')) {
    return 'ricardo rickachu - pink';
  }
  if (normName.includes('rickachu crudo')) {
    return 'ricardo rickachu - crudo';
  }
  if (normName.includes('rickachu cafe')) {
    return 'ricardo rickachu - cafe';
  }
  if (normName.includes('algodon crudo navidad')) {
    return 'playera algodon crudo navidad';
  }
  if (normName.includes('algodon negra navidad') || normName.includes('algon negra navidad') || normName.includes('negra navidad')) {
    return 'playera algodon negra navidad';
  }
  if (normName.includes('gorra capibara') || normName.includes('slobyhat flama negra capibara') || normName.includes('flama negra capibara')) {
    return 'slobyhat flama negra capibara';
  }
  
  return normName;
};

export const InventarioAdmin = () => {
  const [inventario, setInventario] = useState([])
  const [clientes, setClientes] = useState([])
  const [empresasLogisticas, setEmpresasLogisticas] = useState([])
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [clienteFilter, setClienteFilter] = useState('all')
  const [logisticaFilter, setLogisticaFilter] = useState('all')
  
  // Categoría seleccionada para filtro rápido (Pestañas)
  const [categoryFilter, setCategoryFilter] = useState('Ver todas')

  // Modal Alta Manual
  const [modalOpen, setModalOpen] = useState(false)
  const [altaLogisticaId, setAltaLogisticaId] = useState('')
  const [altaClienteId, setAltaClienteId] = useState('')
  const [altaProductos, setAltaProductos] = useState([{ descripcion: '', cantidad: 1 }])
  const [saving, setSaving] = useState(false)

  // Modal Edición de Stock agrupado
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null) // { baseName, variants: [ { size, cantidad, ids } ] }
  const [editedQuantities, setEditedQuantities] = useState({}) // { [size]: quantity }

  const fetchData = async () => {
    try {
      setLoading(true)
      const [invRes, cliRes, logRes, pedRes] = await Promise.all([
        supabase.from('inventario').select('*, clientes(nombre), empresas_logisticas(nombre)').order('producto'),
        supabase.from('clientes').select('id, nombre').eq('activo', true),
        supabase.from('empresas_logisticas').select('id, nombre').eq('activo', true),
        supabase.from('pedidos').select('cliente_id, productos')
      ])
      if (invRes.error) throw invRes.error
      if (pedRes.error) throw pedRes.error
      setInventario(invRes.data || [])
      setClientes(cliRes.data || [])
      setEmpresasLogisticas(logRes.data || [])
      setPedidos(pedRes.data || [])
    } catch (err) {
      toast.error('Error al cargar inventario')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  // Descomponer nombre para separar base y talla, y normalizar a nombres canónicos
  const parseProduct = (fullName) => {
    let name = fullName.trim();
    let size = 'N/A';
    
    // Buscar tallas al final de la cadena, con o sin paréntesis (ej. " (Chica)", " CH", " (XL)")
    const sizePatterns = [
      /\((chica|mediana|grande|xl|xxl|xxxl|xs|s|m|l)\)$/i,
      /\b(ch|med|gde|xl|xxl|xxxl|xs|s|m|l|gd|md|2xl|3xl|xxs|n\/a)\b$/i
    ];
    
    for (const pattern of sizePatterns) {
      const match = name.match(pattern);
      if (match) {
        const rawSize = match[1].toLowerCase();
        if (['chica', 'ch', 's'].includes(rawSize)) size = 'CH';
        else if (['mediana', 'med', 'm', 'md'].includes(rawSize)) size = 'MED';
        else if (['grande', 'gde', 'l', 'gd'].includes(rawSize)) size = 'GDE';
        else if (['xl'].includes(rawSize)) size = 'XL';
        else if (['xxl', '2xl'].includes(rawSize)) size = 'XXL';
        else if (['xxxl', '3xl'].includes(rawSize)) size = 'XXXL';
        else if (['xs'].includes(rawSize)) size = 'XS';
        else if (['xxs'].includes(rawSize)) size = 'XXS';
        else size = rawSize.toUpperCase();
        
        name = name.replace(pattern, '').trim();
        break;
      }
    }
    
    // Limpiar caracteres sueltos o guiones al final del nombre
    name = name.replace(/[\s—-]+$/, '').trim();
    
    // Normalizar baseName con el mismo mapProductName
    const baseName = mapProductName(name);
    
    return { baseName, size };
  };

  // Agrupar inventario de Supabase por producto base (normalizando duplicados y sumando existencias)
  const groupedProducts = useMemo(() => {
    const map = {};
    inventario.forEach(item => {
      const { baseName, size } = parseProduct(item.producto);
      const category = getProductCategory(baseName);
      
      if (!map[baseName]) {
        map[baseName] = {
          baseName,
          category,
          image: getProductImage(baseName),
          description: PRODUCT_DESCRIPTIONS[baseName] || PRODUCT_DESCRIPTIONS['default'],
          cliente_id: item.cliente_id,
          clienteNombre: item.clientes?.nombre || 'N/A',
          logistica_id: item.logistica_id,
          logisticaNombre: item.empresas_logisticas?.nombre || 'N/A',
          variantsMap: {}, // size -> { size, cantidad, ids: [] }
          totalVendidas: 0
        };
      }
      
      const prod = map[baseName];
      if (!prod.variantsMap[size]) {
        prod.variantsMap[size] = {
          size,
          cantidad: 0,
          ids: []
        };
      }
      prod.variantsMap[size].cantidad += item.cantidad;
      prod.variantsMap[size].ids.push(item.id);
    });

    // Calcular el total de vendidas a partir de la tabla pedidos
    const salesMap = {};
    pedidos.forEach(order => {
      const orderProducts = order.productos || [];
      orderProducts.forEach(op => {
        const opName = op.nombre || '';
        const opQty = parseInt(op.cantidad) || 0;
        if (opQty > 0) {
          const parsed = parseProduct(opName);
          const normBase = normalizeText(parsed.baseName);
          const canonical = getNormalizedCanonicalName(normBase);
          salesMap[canonical] = (salesMap[canonical] || 0) + opQty;
        }
      });
    });

    // Asignar el total de vendidas a cada producto agrupado
    Object.values(map).forEach(prod => {
      const normBase = normalizeText(prod.baseName);
      const canonical = getNormalizedCanonicalName(normBase);
      prod.totalVendidas = salesMap[canonical] || 0;
    });

    // Convertir de mapa a array y ordenar variantes por el SIZE_ORDER
    const productsArray = Object.values(map);
    productsArray.forEach(prod => {
      prod.variants = Object.values(prod.variantsMap);
      prod.variants.sort((a, b) => {
        const idxA = SIZE_ORDER.indexOf(a.size);
        const idxB = SIZE_ORDER.indexOf(b.size);
        return (idxA !== -1 ? idxA : 99) - (idxB !== -1 ? idxB : 99);
      });
    });

    // Ordenar productos del más reciente al más viejo (descendente por su MongoDB ObjectId)
    productsArray.sort((a, b) => {
      const idA = PRODUCT_MONGODB_IDS[a.baseName.toLowerCase().trim()] || "";
      const idB = PRODUCT_MONGODB_IDS[b.baseName.toLowerCase().trim()] || "";
      return idB.localeCompare(idA);
    });

    return productsArray;
  }, [inventario, pedidos]);

  // Filtrar productos
  const filteredProducts = useMemo(() => {
    return groupedProducts.filter(prod => {
      const matchesSearch = prod.baseName.toLowerCase().includes(searchTerm.toLowerCase()) || 
        prod.clienteNombre.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCliente = clienteFilter === 'all' || prod.cliente_id === clienteFilter;
      const matchesLogistica = logisticaFilter === 'all' || prod.logistica_id === logisticaFilter;
      const matchesCategory = categoryFilter === 'Ver todas' || prod.category === categoryFilter;

      return matchesSearch && matchesCliente && matchesLogistica && matchesCategory;
    });
  }, [groupedProducts, searchTerm, clienteFilter, logisticaFilter, categoryFilter]);

  // Total de piezas global en la vista actual
  const totalPiezasFiltradas = useMemo(() => {
    return filteredProducts.reduce((sum, prod) => {
      const prodSum = prod.variants.reduce((s, v) => s + v.cantidad, 0);
      return sum + prodSum;
    }, 0);
  }, [filteredProducts]);

  // Edición agrupada por talla (consolidando registros)
  const handleOpenEdit = (prod) => {
    setEditingProduct(prod);
    const quants = {};
    prod.variants.forEach(v => { quants[v.size] = v.cantidad; });
    setEditedQuantities(quants);
    setEditModalOpen(true);
  };

  const handleEditQuantityChange = (size, val) => {
    setEditedQuantities(prev => ({
      ...prev,
      [size]: parseInt(val) || 0
    }));
  };

  const handleSaveGroupEdit = async () => {
    setSaving(true);
    try {
      for (const variant of editingProduct.variants) {
        const newQty = editedQuantities[variant.size] ?? 0;
        const mainId = variant.ids[0];
        
        // Actualizar el primer registro con el nuevo total de stock
        const { error: mainErr } = await supabase
          .from('inventario')
          .update({ cantidad: newQty })
          .eq('id', mainId);
        if (mainErr) throw mainErr;
        
        // Si hay duplicados antiguos en base de datos, ponerlos en 0 para consolidar
        if (variant.ids.length > 1) {
          for (let i = 1; i < variant.ids.length; i++) {
            const { error: otherErr } = await supabase
              .from('inventario')
              .update({ cantidad: 0 })
              .eq('id', variant.ids[i]);
            if (otherErr) throw otherErr;
          }
        }
      }
      toast.success('Ficha de inventario actualizada');
      setEditModalOpen(false);
      fetchData();
    } catch (err) {
      toast.error('Error al guardar: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Eliminar producto por completo (elimina todas sus tallas/variantes en Supabase)
  const handleDeleteProduct = async (prod) => {
    const ok = window.confirm(`¿Eliminar por completo "${prod.baseName}" y todas sus tallas del inventario?`);
    if (!ok) return;
    try {
      const allIds = prod.variants.flatMap(v => v.ids);
      for (const id of allIds) {
        const { error } = await supabase.from('inventario').delete().eq('id', id);
        if (error) throw error;
      }
      toast.success('Producto eliminado del inventario');
      fetchData();
    } catch (err) {
      toast.error('Error al eliminar: ' + err.message);
    }
  };

  // Alta de stock
  const handleAddAltaProducto = () => setAltaProductos([...altaProductos, { descripcion: '', cantidad: 1 }])
  const handleRemoveAltaProducto = (i) => setAltaProductos(altaProductos.filter((_, idx) => idx !== i))
  const handleAltaChange = (i, field, val) => {
    const arr = [...altaProductos]
    arr[i][field] = val
    setAltaProductos(arr)
  }

  const handleAltaGuardar = async () => {
    if (!altaLogisticaId || !altaClienteId) return toast.error('Selecciona empresa logística y cliente')
    const valid = altaProductos.filter(p => p.descripcion.trim() && p.cantidad >= 0)
    if (!valid.length) return toast.error('Añade al menos un producto')
    setSaving(true)
    try {
      for (const p of valid) {
        const { error } = await supabase.from('inventario').upsert({
          logistica_id: altaLogisticaId,
          cliente_id: altaClienteId,
          producto: p.descripcion.trim(),
          cantidad: p.cantidad
        }, { onConflict: 'logistica_id,cliente_id,producto' })
        if (error) throw error
      }
      toast.success('Stock agregado exitosamente')
      setModalOpen(false)
      setAltaLogisticaId(''); setAltaClienteId(''); setAltaProductos([{ descripcion: '', cantidad: 1 }])
      fetchData()
    } catch (err) {
      toast.error('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-6">
      {/* Encabezado */}
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 tracking-tight">Inventario de Productos</h1>
          <p className="text-xs text-gray-500">Visualización de fichas técnicas en tarjetas conectadas en tiempo real con MongoDB</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs bg-orange-50 border border-orange-100 text-orange-700 font-bold px-3 py-1.5 rounded-xl">
            Existencia: {totalPiezasFiltradas.toLocaleString()} prendas
          </span>
          <Button onClick={() => setModalOpen(true)} className="bg-[#FF6600] hover:bg-orange-600 text-white rounded-xl h-9 text-xs">
            <Plus className="w-4 h-4 mr-1.5" /> Alta de Stock
          </Button>
        </div>
      </div>

      {/* Buscador y Dropdowns */}
      <div className="flex flex-wrap gap-3 items-center bg-white p-3 rounded-2xl shadow-sm border border-gray-100/50 mb-5">
        <div className="relative flex-1 min-w-[240px]">
          <PackageSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input 
            placeholder="Buscar por nombre de prenda..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)} 
            className="pl-9 h-9 text-xs rounded-xl border-gray-200" 
          />
        </div>
        <Select value={clienteFilter} onValueChange={setClienteFilter}>
          <SelectTrigger className="w-[180px] h-9 text-xs rounded-xl border-gray-200"><SelectValue placeholder="Clientes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los Clientes</SelectItem>
            {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={logisticaFilter} onValueChange={setLogisticaFilter}>
          <SelectTrigger className="w-[180px] h-9 text-xs rounded-xl border-gray-200"><SelectValue placeholder="Logísticas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las Logísticas</SelectItem>
            {empresasLogisticas.map(e => <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Categorías (Pestañas de Filtrado Rápido) */}
      <div className="flex items-center gap-1 overflow-x-auto pb-3 mb-6 scrollbar-thin scrollbar-thumb-gray-200">
        {['Ver todas', 'Playeras', 'Jerseys', 'Sudaderas', 'Pósters', 'Accesorios', 'Otros'].map(cat => {
          const isActive = categoryFilter === cat;
          return (
            <button
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all duration-200 ${
                isActive 
                  ? 'bg-[#FF6600] text-white shadow-sm' 
                  : 'bg-white border border-gray-100 text-gray-500 hover:text-gray-800 hover:border-gray-200'
              }`}
            >
              {cat}
            </button>
          )
        })}
      </div>

      {/* Grilla de Tarjetas (Fichas Técnicas) */}
      {loading ? (
        <div className="py-20 text-center text-xs text-gray-500 font-medium">Cargando fichas de inventario...</div>
      ) : filteredProducts.length === 0 ? (
        <div className="py-20 text-center text-gray-500 flex flex-col items-center justify-center">
          <PackageSearch className="w-10 h-10 text-gray-300 mb-2" />
          <p className="text-xs font-bold text-gray-400">Sin stock coincidente con los filtros seleccionados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map(prod => {
            const totalStock = prod.variants.reduce((s, v) => s + v.cantidad, 0);
            return (
              <div key={prod.baseName} className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col">
                
                {/* Imagen de la Prenda */}
                <div className="relative aspect-[4/3] bg-gray-50/50 flex items-center justify-center p-4 border-b border-gray-100/50">
                  <span className="absolute top-2.5 left-2.5 bg-gray-800/80 text-white text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-lg shadow-sm">
                    {prod.category}
                  </span>
                  <img 
                    src={prod.image} 
                    alt={prod.baseName} 
                    className="max-w-full max-h-full object-contain transition-transform hover:scale-105 duration-300" 
                    onError={(e) => { e.target.src = '/img/default-product.png' }}
                  />
                </div>

                {/* Detalles del Producto */}
                <div className="p-4 flex-1 flex flex-col">
                  {/* Nombre de la Prenda */}
                  <h3 className="text-xs font-extrabold text-gray-800 line-clamp-1 mb-1" title={prod.baseName}>
                    {prod.baseName}
                  </h3>
                  <p className="text-[10px] text-gray-400 leading-normal line-clamp-2 h-7 mb-3">
                    {prod.description}
                  </p>
                  
                  {/* Ficha Técnica */}
                  <div className="bg-gray-50/50 p-2.5 rounded-xl text-[10px] text-gray-500 space-y-1 mb-4">
                    <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider border-b border-gray-100 pb-1 mb-1">
                      Ficha Técnica
                    </div>
                    <div className="flex justify-between">
                      <span>Categoría:</span>
                      <span className="font-semibold text-gray-700">{prod.category}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Bodega:</span>
                      <span className="font-semibold text-gray-700">{prod.logisticaNombre}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Dueño:</span>
                      <span className="font-semibold text-gray-700">{prod.clienteNombre}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Vendidas:</span>
                      <span className="font-bold text-gray-800">
                        {prod.totalVendidas || 0} pzas
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-gray-200/50 pt-1 mt-1">
                      <span>Total Stock:</span>
                      <span className={`font-bold ${totalStock > 5 ? 'text-[#FF6600]' : 'text-red-500'}`}>
                        {totalStock} pzas
                      </span>
                    </div>
                  </div>

                  {/* Existencia por Tallas (Debajo de su Ficha Técnica) */}
                  <div className="space-y-1.5 flex-1 mb-4">
                    <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider border-b border-gray-50 pb-1 flex justify-between">
                      <span>Talla</span>
                      <span>Existencia Actual</span>
                    </div>
                    {prod.variants.map(v => {
                      const isLowStock = v.cantidad <= 5;
                      return (
                        <div key={v.size} className="flex items-center justify-between text-xs pb-1 last:pb-0">
                          <span className={`w-9 text-center font-bold rounded-md py-0.5 text-[9px] ${
                            isLowStock 
                              ? 'text-red-700 bg-red-50 border border-red-100' 
                              : 'text-gray-700 bg-gray-100 border border-transparent'
                          }`}>
                            {v.size}
                          </span>
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full ${isLowStock ? 'bg-red-500' : 'bg-green-500'}`}></span>
                            <span className={`font-semibold text-[11px] ${isLowStock ? 'text-red-500 font-bold' : 'text-gray-700'}`}>
                              {v.cantidad > 0 ? `${v.cantidad} pzas` : 'Agotado'}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Acciones */}
                <div className="flex items-center gap-1 border-t border-gray-50 p-2.5 bg-gray-50/30">
                  <button 
                    onClick={() => handleOpenEdit(prod)}
                    className="flex-1 bg-gray-100 hover:bg-[#FF6600] hover:text-white text-gray-700 text-[10px] font-bold py-1.5 rounded-xl transition-colors flex items-center justify-center gap-1 h-7"
                  >
                    <Pencil className="w-3 h-3" /> Editar Stock
                  </button>
                  <button 
                    onClick={() => handleDeleteProduct(prod)}
                    className="w-7 h-7 bg-red-50 hover:bg-red-500 hover:text-white text-red-500 rounded-xl transition-colors flex items-center justify-center"
                    title="Eliminar todo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>
            )
          })}
        </div>
      )}

      {/* Modal Edición de Stock Agrupado */}
      <Dialog.Root open={editModalOpen} onOpenChange={setEditModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 animate-fade-in" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-5 w-full max-w-md z-50 max-h-[85vh] overflow-y-auto border border-gray-50 animate-zoom-in">
            <div className="flex justify-between items-center mb-4">
              <div>
                <Dialog.Title className="text-sm font-extrabold text-gray-800">Modificar Stock</Dialog.Title>
                <p className="text-[10px] text-gray-400 font-medium">Ajusta las existencias para {editingProduct?.baseName}</p>
              </div>
              <button onClick={() => setEditModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2 border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                <div className="grid grid-cols-2 gap-2 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200/50 pb-1.5">
                  <span>Talla</span>
                  <span className="text-right">Cantidad de piezas</span>
                </div>
                <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                  {editingProduct?.variants.map(v => (
                    <div key={v.size} className="grid grid-cols-2 items-center py-1">
                      <span className="font-extrabold text-xs text-gray-700 bg-white border border-gray-100 rounded-lg px-2.5 py-1 w-max">{v.size}</span>
                      <Input 
                        type="number" 
                        min="0"
                        value={editedQuantities[v.size] ?? 0}
                        onChange={e => handleEditQuantityChange(v.size, e.target.value)}
                        className="text-right h-8 text-xs rounded-lg border-gray-200 w-24 ml-auto"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <Button variant="outline" onClick={() => setEditModalOpen(false)} className="h-8 text-xs rounded-xl px-4">
                  Cancelar
                </Button>
                <Button className="bg-[#FF6600] hover:bg-orange-600 text-white h-8 text-xs rounded-xl px-4" onClick={handleSaveGroupEdit} disabled={saving}>
                  {saving ? 'Guardando...' : 'Confirmar Cambios'}
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Modal Alta de Stock Manual */}
      <Dialog.Root open={modalOpen} onOpenChange={setModalOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 animate-fade-in" />
          <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl p-5 w-full max-w-xl z-50 max-h-[90vh] overflow-y-auto border border-gray-50 animate-zoom-in">
            <div className="flex justify-between items-center mb-4">
              <div>
                <Dialog.Title className="text-sm font-extrabold text-gray-800">Alta Manual de Stock</Dialog.Title>
                <p className="text-[10px] text-gray-400 font-medium">Añade stock directamente a la bodega de destino</p>
              </div>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-semibold text-gray-600">Empresa Logística *</Label>
                  <Select value={altaLogisticaId} onValueChange={setAltaLogisticaId}>
                    <SelectTrigger className="h-9 text-xs rounded-xl border-gray-200"><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                    <SelectContent>
                      {empresasLogisticas.map(e => <SelectItem key={e.id} value={e.id}>{e.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-gray-600">Cliente Propietario *</Label>
                  <Select value={altaClienteId} onValueChange={setAltaClienteId}>
                    <SelectTrigger className="h-9 text-xs rounded-xl border-gray-200"><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                    <SelectContent>
                      {clientes.map(c => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div>
                <Label className="text-xs font-semibold text-gray-600">Prendas / Artículos</Label>
                <div className="space-y-2 mt-1 max-h-[35vh] overflow-y-auto border border-gray-50 p-2 rounded-xl bg-gray-50/20">
                  {altaProductos.map((p, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <Input 
                        placeholder="Descripción y Talla (ej. Playera Negra XL)" 
                        value={p.descripcion} 
                        onChange={e => handleAltaChange(i, 'descripcion', e.target.value)} 
                        className="flex-1 h-8 text-xs rounded-lg border-gray-200" 
                      />
                      <Input 
                        type="number" 
                        min="0" 
                        value={p.cantidad} 
                        onChange={e => handleAltaChange(i, 'cantidad', parseInt(e.target.value) || 0)} 
                        className="w-20 h-8 text-xs text-right rounded-lg border-gray-200" 
                      />
                      <Button variant="ghost" size="icon" className="text-red-500 h-8 w-8 hover:bg-red-50" onClick={() => handleRemoveAltaProducto(i)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={handleAddAltaProducto} className="text-[10px] h-7 rounded-lg px-3 mt-1">
                    <Plus className="w-3 h-3 mr-1" /> Añadir Prenda
                  </Button>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
                <Button variant="outline" onClick={() => setModalOpen(false)} className="h-8 text-xs rounded-xl px-4">
                  Cancelar
                </Button>
                <Button className="bg-[#FF6600] hover:bg-orange-600 text-white h-8 text-xs rounded-xl px-4" onClick={handleAltaGuardar} disabled={saving}>
                  {saving ? 'Guardando...' : 'Registrar en Inventario'}
                </Button>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
