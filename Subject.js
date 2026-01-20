const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: [true, 'Subject name is required'],
        trim: true,
        minlength: [2, 'Subject name must be at least 2 characters'],
        maxlength: [100, 'Subject name cannot exceed 100 characters']
    },
    weeklyHours: {
        type: Number,
        required: [true, 'Weekly hours is required'],
        min: [1, 'Weekly hours must be at least 1'],
        max: [40, 'Weekly hours cannot exceed 40']
    },
    difficulty: {
        type: String,
        required: true,
        enum: ['easy', 'medium', 'hard'],
        default: 'medium'
    },
    progress: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
    },
    color: {
        type: String,
        default: '#3B82F6'
    },
    examPriority: {
        type: Number,
        default: 0,
        min: 0,
        max: 10
    },
    completedSessions: {
        type: Number,
        default: 0
    },
    totalSessions: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
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

// Update progress based on completed sessions
subjectSchema.methods.updateProgress = function() {
    if (this.totalSessions > 0) {
        this.progress = Math.round((this.completedSessions / this.totalSessions) * 100);
    }
    return this.save();
};

// Update the updatedAt field before saving
subjectSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

// Compound index for user's subjects
subjectSchema.index({ userId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Subject', subjectSchema);
