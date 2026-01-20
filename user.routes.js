const express = require('express');
const User = require('../models/User');
const Subject = require('../models/Subject');
const Timetable = require('../models/Timetable');
const StudyStats = require('../models/StudyStats');
const { auth } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get subject count
        const subjectCount = await Subject.countDocuments({ userId: req.userId });

        res.json({
            success: true,
            data: {
                user,
                subjectCount
            }
        });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   PUT /api/users/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, async (req, res) => {
    try {
        const { name, preferences } = req.body;

        const updateData = {};
        
        if (name) {
            updateData.name = name;
        }

        if (preferences) {
            if (preferences.dailyHours) {
                updateData['preferences.dailyHours'] = Math.min(12, Math.max(1, preferences.dailyHours));
            }
            if (preferences.sessionDuration) {
                if ([25, 45, 60].includes(preferences.sessionDuration)) {
                    updateData['preferences.sessionDuration'] = preferences.sessionDuration;
                }
            }
            if (preferences.breakDuration) {
                if ([5, 10, 15].includes(preferences.breakDuration)) {
                    updateData['preferences.breakDuration'] = preferences.breakDuration;
                }
            }
        }

        const user = await User.findByIdAndUpdate(
            req.userId,
            { $set: updateData },
            { new: true, runValidators: true }
        ).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'Profile updated successfully',
            data: { user }
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   GET /api/users/dashboard
// @desc    Get dashboard data
// @access  Private
router.get('/dashboard', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        const subjects = await Subject.find({ userId: req.userId });
        const timetable = await Timetable.find({ userId: req.userId }).sort({ dayOfWeek: 1 });
        
        // Calculate streak
        const streak = await StudyStats.calculateStreak(req.userId);
        
        // Get today's stats
        const todayStats = await StudyStats.getTodayStats(req.userId);
        
        // Get weekly stats
        const weeklyStats = await StudyStats.getWeeklyStats(req.userId);
        
        // Calculate total completed sessions
        const totalCompleted = user.statistics.completedSessions;

        res.json({
            success: true,
            data: {
                user,
                subjects,
                timetable,
                statistics: {
                    totalSubjects: subjects.length,
                    streak,
                    completedSessions: totalCompleted,
                    todayStats,
                    weeklyStats
                }
            }
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   GET /api/export/json
// @desc    Export user data as JSON
// @access  Private
router.get('/export/json', auth, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        const subjects = await Subject.find({ userId: req.userId });
        const timetable = await Timetable.find({ userId: req.userId });
        const stats = await StudyStats.find({ userId: req.userId });

        const exportData = {
            exportDate: new Date().toISOString(),
            user: {
                name: user.name,
                email: user.email,
                preferences: user.preferences,
                statistics: user.statistics
            },
            subjects,
            timetable,
            studyStats: stats
        };

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=studymate-export.json');
        res.json(exportData);
    } catch (error) {
        console.error('Export JSON error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during export',
            error: error.message
        });
    }
});

// @route   GET /api/export/csv
// @desc    Export timetable as CSV
// @access  Private
router.get('/export/csv', auth, async (req, res) => {
    try {
        const timetable = await Timetable.find({ userId: req.userId }).sort({ dayOfWeek: 1 });

        let csv = 'Day,Subject,Start Time,End Time,Duration (min),Type,Completed\n';

        timetable.forEach(day => {
            day.sessions.forEach(session => {
                csv += `${day.dayName},${session.subject},${session.startTime},${session.endTime},${session.duration},${session.type},${session.completed}\n`;
            });
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=studymate-timetable.csv');
        res.send(csv);
    } catch (error) {
        console.error('Export CSV error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during export',
            error: error.message
        });
    }
});

module.exports = router;
