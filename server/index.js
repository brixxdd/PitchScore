const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

// Ruta de inicio
app.get('/', (req, res) => {
  res.json({ 
    status: 'PitchScore Backend Running',
    endpoints: [
      'GET /api/debug/evaluations - Ver todas las evaluaciones',
      'GET /api/debug/summary/:teamId - Resumen de evaluaciones por equipo'
    ]
  });
});

// Conexión a MongoDB Atlas
require('dotenv').config();
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://brianes666_db_user:dtpAGFfQnGEoIBH2@cluster0.mm6ktpy.mongodb.net/pitchscore?retryWrites=true&w=majority';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB Atlas conectado'))
  .catch((err) => console.error('❌ Error de MongoDB:', err));

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
  sentToJudges: { type: Boolean, default: false },
  evaluationsCompleted: { type: Number, default: 0 },
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

// Endpoints de diagnóstico
app.get('/api/debug/evaluations', async (req, res) => {
  try {
    const evaluations = await Evaluation.find().sort({ timestamp: -1 });
    const teams = await Team.find();
    const judges = await Judge.find();
    
    const report = {
      totalEvaluations: evaluations.length,
      totalTeams: teams.length,
      totalJudges: judges.length,
      teams: teams.map(team => ({
        id: team.id,
        name: team.name,
        scores: team.scores,
        finalScore: team.finalScore,
        evaluationsCompleted: team.evaluationsCompleted || 0
      })),
      evaluationsByTeam: evaluations.reduce((acc, ev) => {
        if (!acc[ev.teamId]) acc[ev.teamId] = [];
        acc[ev.teamId].push({
          judgeId: ev.judgeId,
          criterionId: ev.criterionId,
          score: ev.score,
          timestamp: ev.timestamp
        });
        return acc;
      }, {})
    };
    
    res.json(report);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/debug/summary/:teamId', async (req, res) => {
  try {
    const { teamId } = req.params;
    const team = await Team.findOne({ id: teamId });
    
    if (!team) {
      return res.status(404).json({ error: 'Equipo no encontrado' });
    }
    
    const evaluations = await Evaluation.find({ teamId });
    
    // Agrupar por criterio
    const byCriterion = {};
    evaluations.forEach(ev => {
      if (!byCriterion[ev.criterionId]) {
        byCriterion[ev.criterionId] = [];
      }
      byCriterion[ev.criterionId].push({
        judgeId: ev.judgeId,
        score: ev.score,
        timestamp: ev.timestamp
      });
    });
    
    const summary = {
      team: {
        id: team.id,
        name: team.name,
        finalScore: team.finalScore,
        scores: team.scores
      },
      evaluationsByCriterion: Object.keys(byCriterion).map(criterionId => {
        const evals = byCriterion[criterionId];
        const total = evals.reduce((sum, e) => sum + e.score, 0);
        return {
          criterionId,
          judgesCount: evals.length,
          evaluations: evals,
          totalSum: total,
          storedInTeam: team.scores[criterionId] || 0,
          note: 'storedInTeam debe ser igual a totalSum (suma de todos los jueces)'
        };
      }),
      totalEvaluations: evaluations.length
    };
    
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Socket.io events
io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);

  // Evento para que el Totem se una a su sala
  socket.on('totem:connect', async (data) => {
    try {
      const { totemId } = data;
      
      // Crear o actualizar el Totem en la BD
      const totem = await Totem.findOneAndUpdate(
        { id: totemId },
        {
          id: totemId,
          status: 'active',
          activeTeam: null,
          activeCriterion: null,
        },
        { upsert: true, new: true }
      );
      
      socket.join(totemId);
      console.log(`🖥️ Totem "${totemId}" conectado, registrado en BD y unido a su sala`);
      socket.emit('totem:connected', { totemId });
    } catch (error) {
      console.error('Error en totem:connect:', error);
    }
  });

  socket.on('judge:connect', async (data) => {
    try {
      // Verificar que el totem existe
      const totem = await Totem.findOne({ id: data.totemId });
      
      if (!totem) {
        console.log(`❌ Juez "${data.judgeId}" intentó conectarse a totem "${data.totemId}" que NO existe`);
        socket.emit('judge:connection-error', { 
          error: 'Totem no encontrado. Asegúrate de que el Totem esté activo y mostrando el QR.' 
        });
        return;
      }

      // Crear o actualizar el juez
      const judge = await Judge.findOneAndUpdate(
        { id: data.judgeId },
        {
          id: data.judgeId,
          totemId: data.totemId,
          lastActive: new Date(),
        },
        { upsert: true, new: true }
      );

      socket.join(data.totemId);
      console.log(`✅ Juez "${data.judgeId}" conectado al totem "${data.totemId}"`);
      
      socket.emit('judge:connected', {
        judgeId: data.judgeId,
        order: judge.order || 0,
      });
    } catch (error) {
      console.error('Error en judge:connect:', error);
      socket.emit('judge:connection-error', { 
        error: 'Error al conectar con el servidor' 
      });
    }
  });

  // Evento para enviar múltiples evaluaciones de un juez a la vez (BATCH)
  socket.on('evaluation:submit-batch', async (data) => {
    try {
      const { teamId, judgeId, evaluations: judgeEvaluations } = data;
      
      console.log(`\n${'='.repeat(60)}`);
      console.log(`📊 NUEVA EVALUACIÓN RECIBIDA`);
      console.log(`   Juez: ${judgeId}`);
      console.log(`   Equipo: ${teamId}`);
      console.log(`   Criterios evaluados: ${judgeEvaluations.length}`);
      console.log(`${'='.repeat(60)}\n`);

      // Guardar todas las evaluaciones
      const savedEvaluations = [];
      for (const evalData of judgeEvaluations) {
        const evaluation = new Evaluation({
          teamId,
          judgeId,
          criterionId: evalData.criterionId,
          score: evalData.score,
          timestamp: new Date(),
        });
        await evaluation.save();
        savedEvaluations.push(evaluation);
      }

      // Recalcular puntajes del equipo para TODOS los criterios evaluados
      const team = await Team.findOne({ id: teamId });
      if (!team) {
        socket.emit('evaluation:error', { error: 'Equipo no encontrado' });
        return;
      }

      // Para cada criterio evaluado, SUMAR las puntuaciones de TODOS los jueces
      for (const evalData of judgeEvaluations) {
        const allEvaluationsForCriterion = await Evaluation.find({
          teamId,
          criterionId: evalData.criterionId,
        });

        console.log(`📊 Criterio ${evalData.criterionId}: ${allEvaluationsForCriterion.length} evaluaciones encontradas`);
        
        // Mostrar las evaluaciones de cada juez
        allEvaluationsForCriterion.forEach(ev => {
          console.log(`  - Juez ${ev.judgeId}: ${ev.score} puntos`);
        });

        // SUMAR (no promediar) los puntajes de todos los jueces
        const totalScore = allEvaluationsForCriterion.reduce((sum, e) => sum + e.score, 0);

        console.log(`  ➡️ Suma total calculada: ${totalScore} puntos`);

        team.scores[evalData.criterionId] = totalScore;
      }

      // Recalcular puntaje final (suma de todas las puntuaciones de todos los jueces)
      console.log(`\n🔢 Calculando puntaje final para "${team.name}":`);
      console.log(`   Scores por criterio (sumados entre jueces):`, team.scores);
      
      const finalScore = Object.values(team.scores).reduce(
        (sum, score) => sum + score,
        0
      );
      
      const numCriteria = Object.keys(team.scores).length;
      console.log(`   Total de criterios evaluados: ${numCriteria}`);
      console.log(`   PUNTAJE FINAL (suma de todos los jueces): ${finalScore} puntos\n`);
      
      team.finalScore = finalScore;
      team.evaluationsCompleted = (team.evaluationsCompleted || 0) + 1;
      
      await team.save();

      console.log(`✅ Equipo "${team.name}" actualizado: ${finalScore.toFixed(2)} puntos totales`);

      // Obtener TODOS los equipos ordenados para enviar el ranking completo
      const allTeams = await Team.find({ totemId: team.totemId }).sort({ finalScore: -1 });

      console.log(`📢 Emitiendo actualización a sala "${team.totemId}" con ${allTeams.length} equipos`);
      
      // Emitir actualización a TODOS los clientes del totem (broadcast)
      io.to(team.totemId).emit('team:updated', team);
      io.to(team.totemId).emit('results:updated', { teams: allTeams });
      
      // TAMBIÉN emitir a TODOS los clientes (backup) por si no están en la sala
      io.emit('results:updated', { teams: allTeams });

      // Confirmar al juez
      socket.emit('evaluation:complete', {
        teamId,
        judgeId,
        finalScore: team.finalScore,
        teamName: team.name,
      });

      console.log(`✅ Actualización emitida: "${team.name}" = ${finalScore.toFixed(2)} pts`);
    } catch (error) {
      console.error('Error en evaluation:submit-batch:', error);
      socket.emit('evaluation:error', { error: error.message });
    }
  });

  // Evento individual (mantener para compatibilidad)
  socket.on('evaluation:submit', async (data) => {
    try {
      const evaluation = new Evaluation({
        teamId: data.teamId,
        judgeId: data.judgeId,
        criterionId: data.criterionId,
        score: data.score,
        timestamp: new Date(),
      });

      await evaluation.save();

      // Recalcular puntajes del equipo
      const evaluations = await Evaluation.find({
        teamId: data.teamId,
        criterionId: data.criterionId,
      });

      // SUMAR (no promediar) los puntajes de todos los jueces
      const totalScore = evaluations.reduce((sum, e) => sum + e.score, 0);

      const team = await Team.findOne({ id: data.teamId });
      if (team) {
        team.scores[data.criterionId] = totalScore;
        const finalScore = Object.values(team.scores).reduce(
          (sum, score) => sum + score,
          0
        );
        team.finalScore = finalScore;
        await team.save();

        // Obtener todos los equipos ordenados
        const allTeams = await Team.find({ totemId: team.totemId }).sort({ finalScore: -1 });

        // Emitir actualización a todos los clientes del totem
        io.to(team.totemId).emit('team:updated', team);
        io.to(team.totemId).emit('results:updated', { teams: allTeams });

        console.log(`✅ Evaluación individual procesada: ${team.name} - ${data.criterionId}`);
      }

      socket.emit('evaluation:received', {
        teamId: data.teamId,
        criterionId: data.criterionId,
        judgeId: data.judgeId,
      });
    } catch (error) {
      console.error('Error en evaluation:submit:', error);
    }
  });

  socket.on('team:add', async (data) => {
    try {
      const newTeam = new Team({
        id: data.id,
        name: data.name,
        totemId: data.totemId,
        scores: {},
        finalScore: 0,
        positionHistory: [],
      });

      await newTeam.save();
      console.log('✅ Equipo registrado:', newTeam.name);

      // Emitir a todos los clientes del totem (jueces y totem)
      io.to(data.totemId).emit('team:added', newTeam);

      // Confirmar al totem
      socket.emit('team:added:success', newTeam);
    } catch (error) {
      console.error('Error en team:add:', error);
      socket.emit('team:added:error', { error: error.message });
    }
  });

  socket.on('team:list', async (data) => {
    try {
      const teams = await Team.find({ totemId: data.totemId }).sort({ finalScore: -1 });
      socket.emit('team:list:response', { teams });
    } catch (error) {
      console.error('Error en team:list:', error);
    }
  });

  socket.on('team:send-to-judges', async (data) => {
    try {
      const team = await Team.findOne({ id: data.teamId });
      if (!team) {
        socket.emit('error', { message: 'Equipo no encontrado' });
        return;
      }

      // Marcar como enviado a jueces
      team.sentToJudges = true;
      await team.save();
      
      console.log(`✅ Equipo "${team.name}" enviado a jueces para evaluación completa`);

      // Emitir a todos los jueces del totem
      io.to(data.totemId).emit('team:received', { team });
      
      // Confirmar al totem
      socket.emit('team:sent:success', { team });
    } catch (error) {
      console.error('Error en team:send-to-judges:', error);
      socket.emit('team:sent:error', { error: error.message });
    }
  });

  socket.on('totem:change-team', async (data) => {
    try {
      const totem = await Totem.findOne({ id: data.totemId });
      if (totem) {
        totem.activeTeam = data.teamId;
        await totem.save();

        const team = await Team.findOne({ id: data.teamId });
        io.to(data.totemId).emit('totem:team-changed', {
          teamId: data.teamId,
          teamName: team?.name || '',
        });
      }
    } catch (error) {
      console.error('Error en totem:change-team:', error);
    }
  });

  socket.on('totem:change-criterion', async (data) => {
    try {
      const totem = await Totem.findOne({ id: data.totemId });
      if (totem) {
        totem.activeCriterion = data.criterionId;
        await totem.save();

        const criterion = await Criterion.findOne({ id: data.criterionId });
        io.to(data.totemId).emit('totem:criterion-changed', {
          criterionId: data.criterionId,
          criterionName: criterion?.name || '',
        });
      }
    } catch (error) {
      console.error('Error en totem:change-criterion:', error);
    }
  });

  socket.on('system:reset-data', async (data) => {
    try {
      const { password, totemId } = data;
      const CORRECT_PASSWORD = 'unachnegocios';
      
      console.log(`🔒 Solicitud de reset de datos recibida para totem: ${totemId}`);
      
      // Verificar contraseña
      if (password !== CORRECT_PASSWORD) {
        console.log('❌ Contraseña incorrecta en intento de reset');
        socket.emit('system:reset-error', { error: 'Contraseña incorrecta' });
        return;
      }
      
      console.log('✅ Contraseña correcta - Iniciando limpieza de datos...');
      
      // Eliminar todos los datos de las colecciones
      const evaluationsDeleted = await Evaluation.deleteMany({});
      console.log(`🗑️ Evaluaciones eliminadas: ${evaluationsDeleted.deletedCount}`);
      
      const teamsDeleted = await Team.deleteMany({});
      console.log(`🗑️ Equipos eliminados: ${teamsDeleted.deletedCount}`);
      
      const judgesDeleted = await Judge.deleteMany({});
      console.log(`🗑️ Jueces eliminados: ${judgesDeleted.deletedCount}`);
      
      // NO eliminar totems, solo resetear sus datos
      const totemsReset = await Totem.updateMany(
        {},
        {
          $set: {
            activeTeam: null,
            activeCriterion: null,
            status: 'idle',
          }
        }
      );
      console.log(`🔄 Totems reseteados: ${totemsReset.modifiedCount} (no eliminados, solo limpiados)`);
      
      // Emitir confirmación de éxito
      io.to(totemId).emit('system:reset-success', {});
      io.emit('system:reset-success', {}); // Broadcast global
      
      console.log('✅ Sistema reseteado exitosamente');
      console.log('📊 Resumen:');
      console.log(`   - Evaluaciones eliminadas: ${evaluationsDeleted.deletedCount}`);
      console.log(`   - Equipos eliminados: ${teamsDeleted.deletedCount}`);
      console.log(`   - Jueces eliminados: ${judgesDeleted.deletedCount}`);
      console.log(`   - Totems reseteados: ${totemsReset.modifiedCount} (activos y listos)`);
      
    } catch (error) {
      console.error('❌ Error al resetear datos:', error);
      socket.emit('system:reset-error', { error: error.message });
    }
  });

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});

