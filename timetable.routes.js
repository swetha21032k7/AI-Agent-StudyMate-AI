const express = require('express');
const Timetable = require('../models/Timetable');
const Subject = require('../models/Subject');
const User = require('../models/User');
const StudyStats = require('../models/StudyStats');
const { auth } = require('../middleware/auth');
const { generateTimetable, regenerateDay, DAYS } = require('../utils/timetableGenerator');

const router = express.Router();

// @route   POST /api/timetable/generate
// @desc    Generate AI-powered timetable
// @access  Private
router.post('/generate', auth, async (req, res) => {
    try {
        // Get user preferences
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Get user's subjects
        const subjects = await Subject.find({ userId: req.userId, isActive: true });
        
        if (subjects.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please add at least one subject before generating a timetable'
            });
        }

        // Generate timetable using AI logic
        const generatedTimetable = generateTimetable(subjects, user.preferences);

        // Delete existing timetable for this user
        await Timetable.deleteMany({ userId: req.userId });

        // Save new timetable
        const savedTimetable = await Promise.all(
            generatedTimetable.map(async (day) => {
                const timetableEntry = new Timetable({
                    userId: req.userId,
                    dayOfWeek: day.dayOfWeek,
                    dayName: day.dayName,
                    sessions: day.sessions,
                    totalStudyMinutes: day.totalStudyMinutes,
                    totalBreakMinutes: day.totalBreakMinutes
                });
                return await timetableEntry.save();
            })
        );

        // Update subject total sessions
        for (const subject of subjects) {
            let totalSessions = 0;
            savedTimetable.forEach(day => {
                totalSessions += day.sessions.filter(
                    s => s.type === 'study' && s.subject === subject.name
                ).length;
            });
            subject.totalSessions = totalSessions;
            subject.completedSessions = 0;
            subject.progress = 0;
            await subject.save();
        }

        res.status(201).json({
            success: true,
            message: 'Timetable generated successfully',
            data: savedTimetable
        });
    } catch (error) {
        console.error('Generate timetable error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during timetable generation',
            error: error.message
        });
    }
});

// @route   GET /api/timetable
// @desc    Get user's timetable
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const timetable = await Timetable.find({ userId: req.userId })
            .sort({ dayOfWeek: 1 });

        res.json({
            success: true,
            data: timetable
        });
    } catch (error) {
        console.error('Get timetable error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   GET /api/timetable/:day
// @desc    Get timetable for specific day
// @access  Private
router.get('/:day', auth, async (req, res) => {
    try {
        const dayOfWeek = parseInt(req.params.day);
        
        if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
            return res.status(400).json({
                success: false,
                message: 'Invalid day. Use 0-6 (Monday-Sunday)'
            });
        }

        const timetable = await Timetable.findOne({
            userId: req.userId,
            dayOfWeek
        });

        if (!timetable) {
            return res.status(404).json({
                success: false,
                message: 'Timetable not found for this day'
            });
        }

        res.json({
            success: true,
            data: timetable
        });
    } catch (error) {
        console.error('Get day timetable error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   PUT /api/timetable/session/:day/:sessionId
// @desc    Update session (mark as completed)
// @access  Private
router.put('/session/:day/:sessionId', auth, async (req, res) => {
    try {
        const { day, sessionId } = req.params;
        const { completed } = req.body;
        const dayOfWeek = parseInt(day);

        if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
            return res.status(400).json({
                success: false,
                message: 'Invalid day'
            });
        }

        const timetable = await Timetable.findOne({
            userId: req.userId,
            dayOfWeek
        });

        if (!timetable) {
            return res.status(404).json({
                success: false,
                message: 'Timetable not found'
            });
        }

        // Find the session
        const session = timetable.sessions.id(sessionId);
        
        if (!session) {
            return res.status(404).json({
                success: false,
                message: 'Session not found'
            });
        }

        const wasCompleted = session.completed;
        session.completed = completed;

        await timetable.save();

        // Update user statistics and subject progress
        if (session.type === 'study') {
            const user = await User.findById(req.userId);
            
            if (completed && !wasCompleted) {
                // Session marked as completed
                user.statistics.completedSessions += 1;
                user.statistics.totalStudyMinutes += session.duration;
                user.statistics.lastStudyDate = new Date();

                // Update streak
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const lastStudy = user.statistics.lastStudyDate ? new Date(user.statistics.lastStudyDate) : null;
                
                if (lastStudy) {
                    lastStudy.setHours(0, 0, 0, 0);
                    const dayDiff = Math.floor((today - lastStudy) / (1000 * 60 * 60 * 24));
                    
                    if (dayDiff <= 1) {
                        user.statistics.streak += 1;
                    } else {
                        user.statistics.streak = 1;
                    }
                } else {
                    user.statistics.streak = 1;
                }

                // Update subject progress
                if (session.subjectId) {
                    const subject = await Subject.findById(session.subjectId);
                    if (subject) {
                        subject.completedSessions += 1;
                        await subject.updateProgress();
                    }
                }

                // Update daily stats
                const todayStats = await StudyStats.getTodayStats(req.userId);
                todayStats.sessionsCompleted += 1;
                todayStats.totalStudyMinutes += session.duration;
                todayStats.streakDay = true;
                
                // Add subject to today's stats
                const subjectIdx = todayStats.subjectsStudied.findIndex(
                    s => s.subjectName === session.subject
                );
                
                if (subjectIdx >= 0) {
                    todayStats.subjectsStudied[subjectIdx].minutes += session.duration;
                    todayStats.subjectsStudied[subjectIdx].sessions += 1;
                } else {
                    todayStats.subjectsStudied.push({
                        subjectId: session.subjectId,
                        subjectName: session.subject,
                        minutes: session.duration,
                        sessions: 1
                    });
                }
                
                await todayStats.save();
            } else if (!completed && wasCompleted) {
                // Session unmarked (undoing completion)
                user.statistics.completedSessions = Math.max(0, user.statistics.completedSessions - 1);
                user.statistics.totalStudyMinutes = Math.max(0, user.statistics.totalStudyMinutes - session.duration);

                // Update subject progress
                if (session.subjectId) {
                    const subject = await Subject.findById(session.subjectId);
                    if (subject) {
                        subject.completedSessions = Math.max(0, subject.completedSessions - 1);
                        await subject.updateProgress();
                    }
                }

                // Update daily stats
                const todayStats = await StudyStats.getTodayStats(req.userId);
                todayStats.sessionsCompleted = Math.max(0, todayStats.sessionsCompleted - 1);
                todayStats.totalStudyMinutes = Math.max(0, todayStats.totalStudyMinutes - session.duration);
                await todayStats.save();
            }

            await user.save();
        }

        res.json({
            success: true,
            message: completed ? 'Session marked as completed' : 'Session marked as incomplete',
            data: {
                session,
                timetable
            }
        });
    } catch (error) {
        console.error('Update session error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   POST /api/timetable/regenerate/:day
// @desc    Regenerate timetable for a specific day
// @access  Private
router.post('/regenerate/:day', auth, async (req, res) => {
    try {
        const dayOfWeek = parseInt(req.params.day);
        
        if (isNaN(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
            return res.status(400).json({
                success: false,
                message: 'Invalid day'
            });
        }

        const user = await User.findById(req.userId);
        const subjects = await Subject.find({ userId: req.userId, isActive: true });
        
        if (subjects.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No subjects available'
            });
        }

        let timetable = await Timetable.findOne({ userId: req.userId, dayOfWeek });
        
        if (!timetable) {
            timetable = new Timetable({
                userId: req.userId,
                dayOfWeek,
                dayName: DAYS[dayOfWeek],
                sessions: []
            });
        }

        // Regenerate sessions for this day
        const newSessions = regenerateDay(timetable, subjects, user.preferences);
        timetable.sessions = newSessions;

        await timetable.save();

        res.json({
            success: true,
            message: `Timetable regenerated for ${DAYS[dayOfWeek]}`,
            data: timetable
        });
    } catch (error) {
        console.error('Regenerate day error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

module.exports = router;
