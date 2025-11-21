const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://brianes666_db_user:dtpAGFfQnGEoIBH2@cluster0.mm6ktpy.mongodb.net/pitchscore?retryWrites=true&w=majority';

// Esquemas de MongoDB
const judgeSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: String,
  totemId: String,
  order: Number,
  lastActive: Date,
}, { timestamps: true });

const teamSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  totemId: String,
  scores: { type: Object, default: {} },
  finalScore: { type: Number, default: 0 },
  positionHistory: [{
    timestamp: Date,
    position: Number,
  }],
}, { timestamps: true });

const criterionSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  description: String,
  maxScore: { type: Number, default: 4 },
}, { timestamps: true });

const evaluationSchema = new mongoose.Schema({
  teamId: { type: String, required: true },
  judgeId: { type: String, required: true },
  criterionId: { type: String, required: true },
  score: { type: Number, required: true, min: 1, max: 4 },
  timestamp: { type: Date, default: Date.now },
}, { timestamps: true });

const totemSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  activeTeam: String,
  activeCriterion: String,
  status: { type: String, enum: ['idle', 'active', 'evaluating'], default: 'idle' },
}, { timestamps: true });

const Judge = mongoose.model('Judge', judgeSchema);
const Team = mongoose.model('Team', teamSchema);
const Criterion = mongoose.model('Criterion', criterionSchema);
const Evaluation = mongoose.model('Evaluation', evaluationSchema);
const Totem = mongoose.model('Totem', totemSchema);

// Criterios por defecto con rúbrica detallada
const defaultCriteria = [
  {
    id: 'criterion-1',
    name: 'Problema y necesidad del mercado',
    description: 'Claridad, relevancia y justificación del problema',
    maxScore: 4,
    niveles: [
      { nivel: 4, nombre: 'Excelente', descripcion: 'Problema claramente definido, con datos actualizados y justificación sólida' },
      { nivel: 3, nombre: 'Bueno', descripcion: 'Problema definido y con alguna justificación mediante datos' },
      { nivel: 2, nombre: 'Satisfactorio', descripcion: 'Problema poco claro o con justificación débil' },
      { nivel: 1, nombre: 'Deficiente', descripcion: 'No se identifica claramente el problema' }
    ]
  },
  {
    id: 'criterion-2',
    name: 'Propuesta única de valor e impacto',
    description: 'Diferenciación, resolución del problema, impacto',
    maxScore: 4,
    niveles: [
      { nivel: 4, nombre: 'Excelente', descripcion: 'Propuesta clara, original y con alto impacto en clientes o comunidad' },
      { nivel: 3, nombre: 'Bueno', descripcion: 'Propuesta clara, con elementos diferenciadores y algún impacto' },
      { nivel: 2, nombre: 'Satisfactorio', descripcion: 'Propuesta poco clara o poco diferenciadora' },
      { nivel: 1, nombre: 'Deficiente', descripcion: 'No se presenta propuesta clara ni su impacto' }
    ]
  },
  {
    id: 'criterion-3',
    name: 'Perfil del cliente ideal y tamaño del mercado',
    description: 'Definición de cliente y estimación del mercado',
    maxScore: 4,
    niveles: [
      { nivel: 4, nombre: 'Excelente', descripcion: 'Cliente ideal bien definido con datos y mercado claramente estimado' },
      { nivel: 3, nombre: 'Bueno', descripcion: 'Cliente definido con estimaciones aceptables del mercado' },
      { nivel: 2, nombre: 'Satisfactorio', descripcion: 'Cliente definido de forma general sin estimaciones claras' },
      { nivel: 1, nombre: 'Deficiente', descripcion: 'No se identifica al cliente ideal ni el tamaño del mercado' }
    ]
  },
  {
    id: 'criterion-4',
    name: 'Estrategia de mercadotecnia',
    description: 'Precio, distribución y promoción',
    maxScore: 4,
    niveles: [
      { nivel: 4, nombre: 'Excelente', descripcion: 'Estrategia integral, coherente y bien fundamentada' },
      { nivel: 3, nombre: 'Bueno', descripcion: 'Estrategia clara, con coherencia entre los elementos' },
      { nivel: 2, nombre: 'Satisfactorio', descripcion: 'Estrategia incompleta o poco detallada' },
      { nivel: 1, nombre: 'Deficiente', descripcion: 'Estrategia ausente o confusa' }
    ]
  },
  {
    id: 'criterion-5',
    name: 'Análisis de la competencia',
    description: 'Identificación, comparación y diferenciación',
    maxScore: 4,
    niveles: [
      { nivel: 4, nombre: 'Excelente', descripcion: 'Análisis profundo con comparativas claras y estrategias diferenciadoras' },
      { nivel: 3, nombre: 'Bueno', descripcion: 'Análisis adecuado con comparación parcial' },
      { nivel: 2, nombre: 'Satisfactorio', descripcion: 'Análisis superficial, sin estrategias claras' },
      { nivel: 1, nombre: 'Deficiente', descripcion: 'No se realiza análisis de competencia' }
    ]
  },
  {
    id: 'criterion-6',
    name: 'Metas a corto y mediano plazo',
    description: 'Claridad, temporalidad y medición',
    maxScore: 4,
    niveles: [
      { nivel: 4, nombre: 'Excelente', descripcion: 'Metas claras, alcanzables y bien medidas a 1 y 3 años' },
      { nivel: 3, nombre: 'Bueno', descripcion: 'Metas definidas con algunos indicadores medibles' },
      { nivel: 2, nombre: 'Satisfactorio', descripcion: 'Metas generales sin indicadores claros' },
      { nivel: 1, nombre: 'Deficiente', descripcion: 'No se presentan metas concretas' }
    ]
  },
  {
    id: 'criterion-7',
    name: 'Prototipo del producto o servicio',
    description: 'Representación visual o funcional',
    maxScore: 4,
    niveles: [
      { nivel: 4, nombre: 'Excelente', descripcion: 'Prototipo funcional o visual detallado, claro y viable' },
      { nivel: 3, nombre: 'Bueno', descripcion: 'Prototipo básico que permite entender el producto o servicio' },
      { nivel: 2, nombre: 'Satisfactorio', descripcion: 'Prototipo poco claro o incompleto' },
      { nivel: 1, nombre: 'Deficiente', descripcion: 'No se presenta ningún tipo de prototipo' }
    ]
  },
  {
    id: 'criterion-8',
    name: 'Resumen financiero',
    description: 'Proyecciones, costos e ingresos',
    maxScore: 4,
    niveles: [
      { nivel: 4, nombre: 'Excelente', descripcion: 'Análisis completo, coherente y sustentado con datos' },
      { nivel: 3, nombre: 'Bueno', descripcion: 'Análisis aceptable con proyecciones realistas' },
      { nivel: 2, nombre: 'Satisfactorio', descripcion: 'Proyecciones poco claras o con errores evidentes' },
      { nivel: 1, nombre: 'Deficiente', descripcion: 'No se presenta resumen financiero o es inadecuado' }
    ]
  },
  {
    id: 'criterion-9',
    name: 'Preguntas y respuestas ante los jueces',
    description: 'Claridad, seguridad y dominio del proyecto',
    maxScore: 4,
    niveles: [
      { nivel: 4, nombre: 'Excelente', descripcion: 'Responden con claridad, seguridad y dominio total del tema' },
      { nivel: 3, nombre: 'Bueno', descripcion: 'Responden con buena claridad y conocimiento general del proyecto' },
      { nivel: 2, nombre: 'Satisfactorio', descripcion: 'Respuestas vagas, poco claras o con dudas evidentes' },
      { nivel: 1, nombre: 'Deficiente', descripcion: 'No responden adecuadamente o desconocen aspectos del proyecto' }
    ]
  },
];

// Totem por defecto
const defaultTotem = {
  id: 'totem-1',
  activeTeam: null,
  activeCriterion: null,
  status: 'idle',
};

async function initializeDatabase() {
  try {
    console.log('Conectando a MongoDB Atlas...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB Atlas');

    // Crear índices
    console.log('Creando índices...');
    await Judge.collection.createIndex({ id: 1 }, { unique: true });
    await Team.collection.createIndex({ id: 1 }, { unique: true });
    await Criterion.collection.createIndex({ id: 1 }, { unique: true });
    await Totem.collection.createIndex({ id: 1 }, { unique: true });
    await Evaluation.collection.createIndex({ teamId: 1, judgeId: 1, criterionId: 1 });
    console.log('✅ Índices creados');

    // Insertar criterios por defecto si no existen
    console.log('Verificando criterios...');
    for (const criterion of defaultCriteria) {
      const exists = await Criterion.findOne({ id: criterion.id });
      if (!exists) {
        await Criterion.create(criterion);
        console.log(`  ✅ Criterio creado: ${criterion.name}`);
      } else {
        console.log(`  ⏭️  Criterio ya existe: ${criterion.name}`);
      }
    }

    // Crear totem por defecto si no existe
    console.log('Verificando totem...');
    const totemExists = await Totem.findOne({ id: defaultTotem.id });
    if (!totemExists) {
      await Totem.create(defaultTotem);
      console.log(`  ✅ Totem creado: ${defaultTotem.id}`);
    } else {
      console.log(`  ⏭️  Totem ya existe: ${defaultTotem.id}`);
    }

    console.log('\n✅ Base de datos inicializada correctamente');
    console.log(`📊 Colecciones disponibles:`);
    console.log(`   - Judges`);
    console.log(`   - Teams`);
    console.log(`   - Criteria (${defaultCriteria.length} criterios)`);
    console.log(`   - Evaluations`);
    console.log(`   - Totems`);

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al inicializar la base de datos:', error);
    process.exit(1);
  }
}

initializeDatabase();

