const mongoose = require('mongoose');

const studyStatsSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    sessionsCompleted: {
        type: Number,
        default: 0
    },
    totalStudyMinutes: {
        type: Number,
        default: 0
    },
    subjectsStudied: [{
        subjectId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Subject'
        },
        subjectName: String,
        minutes: Number,
        sessions: Number
    }],
    streakDay: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Compound index for user's daily stats
studyStatsSchema.index({ userId: 1, date: 1 }, { unique: true });

// Static method to get or create today's stats
studyStatsSchema.statics.getTodayStats = async function(userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let stats = await this.findOne({ userId, date: today });
    
    if (!stats) {
        stats = await this.create({
            userId,
            date: today,
            sessionsCompleted: 0,
            totalStudyMinutes: 0,
            subjectsStudied: []
        });
    }
    
    return stats;
};

// Static method to get weekly stats
studyStatsSchema.statics.getWeeklyStats = async function(userId) {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);
    
    return await this.find({
        userId,
        date: { $gte: weekAgo, $lte: today }
    }).sort({ date: 1 });
};

// Static method to calculate streak
studyStatsSchema.statics.calculateStreak = async function(userId) {
    const stats = await this.find({ userId })
        .sort({ date: -1 })
        .limit(365);
    
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < stats.length; i++) {
        const statDate = new Date(stats[i].date);
        statDate.setHours(0, 0, 0, 0);
        
        const expectedDate = new Date(today);
        expectedDate.setDate(expectedDate.getDate() - i);
        expectedDate.setHours(0, 0, 0, 0);
        
        if (statDate.getTime() === expectedDate.getTime() && stats[i].sessionsCompleted > 0) {
            streak++;
        } else if (i === 0 && statDate.getTime() !== expectedDate.getTime()) {
            // Today hasn't been studied yet, check from yesterday
            continue;
        } else {
            break;
        }
    }
    
    return streak;
};

module.exports = mongoose.model('StudyStats', studyStatsSchema);
