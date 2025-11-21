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

        // Emitir actualización a todos los clientes del totem
        io.to(team.totemId).emit('team:updated', team);
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

  socket.on('disconnect', () => {
    console.log('Cliente desconectado:', socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});

