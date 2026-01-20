const express = require('express');
const User = require('../models/User');
const Subject = require('../models/Subject');
const StudyStats = require('../models/StudyStats');
const Timetable = require('../models/Timetable');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/stats
// @desc    Get user statistics
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        const subjects = await Subject.find({ userId: req.userId });
        
        // Get streak
        const streak = await StudyStats.calculateStreak(req.userId);
        
        // Get today's stats
        const todayStats = await StudyStats.getTodayStats(req.userId);
        
        // Get weekly stats
        const weeklyStats = await StudyStats.getWeeklyStats(req.userId);
        
        // Calculate weekly totals
        const weeklyTotals = weeklyStats.reduce((acc, day) => ({
            sessionsCompleted: acc.sessionsCompleted + day.sessionsCompleted,
            totalStudyMinutes: acc.totalStudyMinutes + day.totalStudyMinutes
        }), { sessionsCompleted: 0, totalStudyMinutes: 0 });

        // Get subject-wise progress
        const subjectProgress = subjects.map(subject => ({
            name: subject.name,
            color: subject.color,
            progress: subject.progress,
            completedSessions: subject.completedSessions,
            totalSessions: subject.totalSessions,
            difficulty: subject.difficulty
        }));

        // Calculate overall progress
        const totalSessions = subjects.reduce((acc, s) => acc + s.totalSessions, 0);
        const completedSessions = subjects.reduce((acc, s) => acc + s.completedSessions, 0);
        const overallProgress = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

        res.json({
            success: true,
            data: {
                overview: {
                    streak,
                    totalSubjects: subjects.length,
                    totalCompletedSessions: user.statistics.completedSessions,
                    totalStudyMinutes: user.statistics.totalStudyMinutes,
                    overallProgress
                },
                today: {
                    sessionsCompleted: todayStats.sessionsCompleted,
                    totalStudyMinutes: todayStats.totalStudyMinutes,
                    subjectsStudied: todayStats.subjectsStudied
                },
                weekly: {
                    days: weeklyStats,
                    totals: weeklyTotals
                },
                subjects: subjectProgress
            }
        });
    } catch (error) {
        console.error('Get stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   POST /api/stats/session
// @desc    Record a completed session
// @access  Private
router.post('/session', auth, async (req, res) => {
    try {
        const { subjectId, subjectName, duration } = req.body;

        if (!duration) {
            return res.status(400).json({
                success: false,
                message: 'Duration is required'
            });
        }

        // Update user statistics
        const user = await User.findById(req.userId);
        user.statistics.completedSessions += 1;
        user.statistics.totalStudyMinutes += duration;
        user.statistics.lastStudyDate = new Date();

        // Update streak
        const streak = await StudyStats.calculateStreak(req.userId);
        user.statistics.streak = streak + 1;

        await user.save();

        // Update daily stats
        const todayStats = await StudyStats.getTodayStats(req.userId);
        todayStats.sessionsCompleted += 1;
        todayStats.totalStudyMinutes += duration;
        todayStats.streakDay = true;

        // Add subject to today's stats
        if (subjectName) {
            const subjectIdx = todayStats.subjectsStudied.findIndex(
                s => s.subjectName === subjectName
            );
            
            if (subjectIdx >= 0) {
                todayStats.subjectsStudied[subjectIdx].minutes += duration;
                todayStats.subjectsStudied[subjectIdx].sessions += 1;
            } else {
                todayStats.subjectsStudied.push({
                    subjectId,
                    subjectName,
                    minutes: duration,
                    sessions: 1
                });
            }
        }

        await todayStats.save();

        // Update subject if provided
        if (subjectId) {
            const subject = await Subject.findById(subjectId);
            if (subject) {
                subject.completedSessions += 1;
                await subject.updateProgress();
            }
        }

        res.json({
            success: true,
            message: 'Session recorded successfully',
            data: {
                userStats: user.statistics,
                todayStats
            }
        });
    } catch (error) {
        console.error('Record session error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   GET /api/stats/history
// @desc    Get study history
// @access  Private
router.get('/history', auth, async (req, res) => {
    try {
        const { days = 30 } = req.query;
        
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));
        startDate.setHours(0, 0, 0, 0);

        const history = await StudyStats.find({
            userId: req.userId,
            date: { $gte: startDate }
        }).sort({ date: -1 });

        res.json({
            success: true,
            data: history
        });
    } catch (error) {
        console.error('Get history error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   GET /api/stats/leaderboard
// @desc    Get study leaderboard (mock for now)
// @access  Private
router.get('/leaderboard', auth, async (req, res) => {
    try {
        // Get top users by completed sessions
        const topUsers = await User.find()
            .select('name statistics.completedSessions statistics.streak')
            .sort({ 'statistics.completedSessions': -1 })
            .limit(10);

        const leaderboard = topUsers.map((user, index) => ({
            rank: index + 1,
            name: user.name,
            completedSessions: user.statistics.completedSessions,
            streak: user.statistics.streak
        }));

        res.json({
            success: true,
            data: leaderboard
        });
    } catch (error) {
        console.error('Get leaderboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

module.exports = router;
