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

// Socket.io events
io.on('connection', (socket) => {
  console.log('Cliente conectado:', socket.id);

  // Evento para que el Totem se una a su sala
  socket.on('totem:connect', async (data) => {
    try {
      const { totemId } = data;
      socket.join(totemId);
      console.log(`🖥️ Totem "${totemId}" conectado y unido a su sala`);
      socket.emit('totem:connected', { totemId });
    } catch (error) {
      console.error('Error en totem:connect:', error);
    }
  });

  socket.on('judge:connect', async (data) => {
    try {
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
      socket.emit('judge:connected', {
        judgeId: data.judgeId,
        order: judge.order || 0,
      });
    } catch (error) {
      console.error('Error en judge:connect:', error);
    }
  });

  // Evento para enviar múltiples evaluaciones de un juez a la vez (BATCH)
  socket.on('evaluation:submit-batch', async (data) => {
    try {
      const { teamId, judgeId, evaluations: judgeEvaluations } = data;
      
      console.log(`📊 Procesando ${judgeEvaluations.length} evaluaciones del juez ${judgeId} para equipo ${teamId}`);

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

      // Para cada criterio evaluado, calcular el promedio
      for (const evalData of judgeEvaluations) {
        const allEvaluationsForCriterion = await Evaluation.find({
          teamId,
          criterionId: evalData.criterionId,
        });

        const avgScore =
          allEvaluationsForCriterion.reduce((sum, e) => sum + e.score, 0) / 
          allEvaluationsForCriterion.length;

        team.scores[evalData.criterionId] = avgScore;
      }

      // Recalcular puntaje final
      const finalScore = Object.values(team.scores).reduce(
        (sum, score) => sum + score,
        0
      );
      team.finalScore = finalScore;
      team.evaluationsCompleted = (team.evaluationsCompleted || 0) + 1;
      
      await team.save();

      console.log(`✅ Equipo "${team.name}" actualizado: ${finalScore.toFixed(2)} puntos`);

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

      const avgScore =
        evaluations.reduce((sum, e) => sum + e.score, 0) / evaluations.length;

      const team = await Team.findOne({ id: data.teamId });
      if (team) {
        team.scores[data.criterionId] = avgScore;
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
      
      const totemsDeleted = await Totem.deleteMany({});
      console.log(`🗑️ Totems eliminados: ${totemsDeleted.deletedCount}`);
      
      // Emitir confirmación de éxito
      io.to(totemId).emit('system:reset-success', {});
      io.emit('system:reset-success', {}); // Broadcast global
      
      console.log('✅ Sistema reseteado exitosamente');
      console.log('📊 Resumen:');
      console.log(`   - Evaluaciones: ${evaluationsDeleted.deletedCount}`);
      console.log(`   - Equipos: ${teamsDeleted.deletedCount}`);
      console.log(`   - Jueces: ${judgesDeleted.deletedCount}`);
      console.log(`   - Totems: ${totemsDeleted.deletedCount}`);
      
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

