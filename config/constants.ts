// Constantes de la aplicación

export const CRITERIA = [
  {
    id: 'criterion-1',
    name: 'Problema y necesidad del mercado',
    description: 'Claridad, relevancia y justificación del problema',
    maxScore: 4,
    niveles: [
      {
        nivel: 4,
        nombre: 'Excelente',
        descripcion: 'Problema claramente definido, con datos actualizados y justificación sólida'
      },
      {
        nivel: 3,
        nombre: 'Bueno',
        descripcion: 'Problema definido y con alguna justificación mediante datos'
      },
      {
        nivel: 2,
        nombre: 'Satisfactorio',
        descripcion: 'Problema poco claro o con justificación débil'
      },
      {
        nivel: 1,
        nombre: 'Deficiente',
        descripcion: 'No se identifica claramente el problema'
      }
    ]
  },
  {
    id: 'criterion-2',
    name: 'Propuesta única de valor e impacto',
    description: 'Diferenciación, resolución del problema, impacto',
    maxScore: 4,
    niveles: [
      {
        nivel: 4,
        nombre: 'Excelente',
        descripcion: 'Propuesta clara, original y con alto impacto en clientes o comunidad'
      },
      {
        nivel: 3,
        nombre: 'Bueno',
        descripcion: 'Propuesta clara, con elementos diferenciadores y algún impacto'
      },
      {
        nivel: 2,
        nombre: 'Satisfactorio',
        descripcion: 'Propuesta poco clara o poco diferenciadora'
      },
      {
        nivel: 1,
        nombre: 'Deficiente',
        descripcion: 'No se presenta propuesta clara ni su impacto'
      }
    ]
  },
  {
    id: 'criterion-3',
    name: 'Perfil del cliente ideal y tamaño del mercado',
    description: 'Definición de cliente y estimación del mercado',
    maxScore: 4,
    niveles: [
      {
        nivel: 4,
        nombre: 'Excelente',
        descripcion: 'Cliente ideal bien definido con datos y mercado claramente estimado'
      },
      {
        nivel: 3,
        nombre: 'Bueno',
        descripcion: 'Cliente definido con estimaciones aceptables del mercado'
      },
      {
        nivel: 2,
        nombre: 'Satisfactorio',
        descripcion: 'Cliente definido de forma general sin estimaciones claras'
      },
      {
        nivel: 1,
        nombre: 'Deficiente',
        descripcion: 'No se identifica al cliente ideal ni el tamaño del mercado'
      }
    ]
  },
  {
    id: 'criterion-4',
    name: 'Estrategia de mercadotecnia',
    description: 'Precio, distribución y promoción',
    maxScore: 4,
    niveles: [
      {
        nivel: 4,
        nombre: 'Excelente',
        descripcion: 'Estrategia integral, coherente y bien fundamentada'
      },
      {
        nivel: 3,
        nombre: 'Bueno',
        descripcion: 'Estrategia clara, con coherencia entre los elementos'
      },
      {
        nivel: 2,
        nombre: 'Satisfactorio',
        descripcion: 'Estrategia incompleta o poco detallada'
      },
      {
        nivel: 1,
        nombre: 'Deficiente',
        descripcion: 'Estrategia ausente o confusa'
      }
    ]
  },
  {
    id: 'criterion-5',
    name: 'Análisis de la competencia',
    description: 'Identificación, comparación y diferenciación',
    maxScore: 4,
    niveles: [
      {
        nivel: 4,
        nombre: 'Excelente',
        descripcion: 'Análisis profundo con comparativas claras y estrategias diferenciadoras'
      },
      {
        nivel: 3,
        nombre: 'Bueno',
        descripcion: 'Análisis adecuado con comparación parcial'
      },
      {
        nivel: 2,
        nombre: 'Satisfactorio',
        descripcion: 'Análisis superficial, sin estrategias claras'
      },
      {
        nivel: 1,
        nombre: 'Deficiente',
        descripcion: 'No se realiza análisis de competencia'
      }
    ]
  },
  {
    id: 'criterion-6',
    name: 'Metas a corto y mediano plazo',
    description: 'Claridad, temporalidad y medición',
    maxScore: 4,
    niveles: [
      {
        nivel: 4,
        nombre: 'Excelente',
        descripcion: 'Metas claras, alcanzables y bien medidas a 1 y 3 años'
      },
      {
        nivel: 3,
        nombre: 'Bueno',
        descripcion: 'Metas definidas con algunos indicadores medibles'
      },
      {
        nivel: 2,
        nombre: 'Satisfactorio',
        descripcion: 'Metas generales sin indicadores claros'
      },
      {
        nivel: 1,
        nombre: 'Deficiente',
        descripcion: 'No se presentan metas concretas'
      }
    ]
  },
  {
    id: 'criterion-7',
    name: 'Prototipo del producto o servicio',
    description: 'Representación visual o funcional',
    maxScore: 4,
    niveles: [
      {
        nivel: 4,
        nombre: 'Excelente',
        descripcion: 'Prototipo funcional o visual detallado, claro y viable'
      },
      {
        nivel: 3,
        nombre: 'Bueno',
        descripcion: 'Prototipo básico que permite entender el producto o servicio'
      },
      {
        nivel: 2,
        nombre: 'Satisfactorio',
        descripcion: 'Prototipo poco claro o incompleto'
      },
      {
        nivel: 1,
        nombre: 'Deficiente',
        descripcion: 'No se presenta ningún tipo de prototipo'
      }
    ]
  },
  {
    id: 'criterion-8',
    name: 'Resumen financiero',
    description: 'Proyecciones, costos e ingresos',
    maxScore: 4,
    niveles: [
      {
        nivel: 4,
        nombre: 'Excelente',
        descripcion: 'Análisis completo, coherente y sustentado con datos'
      },
      {
        nivel: 3,
        nombre: 'Bueno',
        descripcion: 'Análisis aceptable con proyecciones realistas'
      },
      {
        nivel: 2,
        nombre: 'Satisfactorio',
        descripcion: 'Proyecciones poco claras o con errores evidentes'
      },
      {
        nivel: 1,
        nombre: 'Deficiente',
        descripcion: 'No se presenta resumen financiero o es inadecuado'
      }
    ]
  },
  {
    id: 'criterion-9',
    name: 'Preguntas y respuestas ante los jueces',
    description: 'Claridad, seguridad y dominio del proyecto',
    maxScore: 4,
    niveles: [
      {
        nivel: 4,
        nombre: 'Excelente',
        descripcion: 'Responden con claridad, seguridad y dominio total del tema'
      },
      {
        nivel: 3,
        nombre: 'Bueno',
        descripcion: 'Responden con buena claridad y conocimiento general del proyecto'
      },
      {
        nivel: 2,
        nombre: 'Satisfactorio',
        descripcion: 'Respuestas vagas, poco claras o con dudas evidentes'
      },
      {
        nivel: 1,
        nombre: 'Deficiente',
        descripcion: 'No responden adecuadamente o desconocen aspectos del proyecto'
      }
    ]
  },
];

export const QR_TOKEN_EXPIRY = 5 * 60 * 1000; // 5 minutos en milisegundos

export const SOCKET_RECONNECT_ATTEMPTS = 5;
export const SOCKET_RECONNECT_DELAY = 1000;

export const COLORS = {
  primary: '#2196F3',
  secondary: '#4CAF50',
  success: '#4CAF50',
  error: '#F44336',
  warning: '#FF9800',
  info: '#2196F3',
  background: '#F5F5F5',
  surface: '#FFFFFF',
  text: '#333333',
  textSecondary: '#666666',
} as const;

