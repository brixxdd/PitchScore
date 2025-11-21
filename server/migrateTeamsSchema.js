const mongoose = require('mongoose');
require('dotenv').config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://brianes666_db_user:dtpAGFfQnGEoIBH2@cluster0.mm6ktpy.mongodb.net/pitchscore?retryWrites=true&w=majority';

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

const Team = mongoose.model('Team', teamSchema);

async function migrateTeams() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB Atlas');

    // Actualizar todos los equipos que no tengan los nuevos campos
    const result = await Team.updateMany(
      {
        $or: [
          { sentToJudges: { $exists: false } },
          { evaluationsCompleted: { $exists: false } }
        ]
      },
      {
        $set: {
          sentToJudges: false,
          evaluationsCompleted: 0
        }
      }
    );

    console.log(`✅ Migración completada: ${result.modifiedCount} equipos actualizados`);

    // Mostrar todos los equipos para verificar
    const teams = await Team.find({});
    console.log('\n📋 Equipos después de la migración:');
    teams.forEach(team => {
      console.log(`  - ${team.name}: sentToJudges=${team.sentToJudges}, evaluationsCompleted=${team.evaluationsCompleted}`);
    });

    await mongoose.connection.close();
    console.log('\n✅ Conexión cerrada');
  } catch (error) {
    console.error('❌ Error en migración:', error);
    process.exit(1);
  }
}

migrateTeams();

