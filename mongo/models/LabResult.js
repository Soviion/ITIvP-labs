const mongoose = require('mongoose');

// Один показатель анализа — вложенный документ внутри анализа
const indicatorSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Название показателя обязательно'], trim: true, maxlength: 80 },
  value: { type: Number, required: [true, 'Значение показателя обязательно'] },
  unit: { type: String, trim: true, maxlength: 20 },
  refMin: Number, // нижняя граница 
  refMax: Number, // верхняя  
});

// вычисление значений анализов, вычисляется в ходе - не хранится
indicatorSchema.virtual('isNormal').get(function isNormal() {
  const aboveMin = this.refMin === undefined || this.value >= this.refMin;
  const belowMax = this.refMax === undefined || this.value <= this.refMax;
  return aboveMin && belowMax;
});

const labResultSchema = new mongoose.Schema({
  card: { type: mongoose.Schema.Types.ObjectId, ref: 'MedicalCard', required: [true, 'Не указана карта'], index: true },
  title: { type: String, required: [true, 'Название анализа обязательно'], trim: true, maxlength: 120 },
  takenAt: { type: Date, default: Date.now },
  indicators: { type: [indicatorSchema], validate: [(list) => list.length > 0, 'Нужен хотя бы один показатель'] },
  conclusion: { type: String, trim: true, maxlength: 1000 },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

module.exports = mongoose.models.LabResult || mongoose.model('LabResult', labResultSchema);
