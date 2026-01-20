const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
    subject: {
        type: String,
        required: true
    },
    subjectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Subject',
        default: null
    },
    startTime: {
        type: String,
        required: true
    },
    endTime: {
        type: String,
        required: true
    },
    duration: {
        type: Number,
        required: true
    },
    type: {
        type: String,
        enum: ['study', 'break'],
        required: true
    },
    completed: {
        type: Boolean,
        default: false
    },
    color: {
        type: String,
        default: '#3B82F6'
    }
});

const timetableSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    dayOfWeek: {
        type: Number,
        required: true,
        min: 0,
        max: 6
    },
    dayName: {
        type: String,
        required: true,
        enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    },
    sessions: [sessionSchema],
    totalStudyMinutes: {
        type: Number,
        default: 0
    },
    totalBreakMinutes: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Calculate totals before saving
timetableSchema.pre('save', function(next) {
    this.totalStudyMinutes = this.sessions
        .filter(s => s.type === 'study')
        .reduce((acc, s) => acc + s.duration, 0);
    
    this.totalBreakMinutes = this.sessions
        .filter(s => s.type === 'break')
        .reduce((acc, s) => acc + s.duration, 0);
    
    this.updatedAt = new Date();
    next();
});

// Compound index for user's timetable
timetableSchema.index({ userId: 1, dayOfWeek: 1 }, { unique: true });

module.exports = mongoose.model('Timetable', timetableSchema);
