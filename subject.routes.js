const express = require('express');
const Subject = require('../models/Subject');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Color palette for subjects
const colorPalette = [
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#84CC16', // Lime
    '#F97316', // Orange
    '#6366F1'  // Indigo
];

// @route   GET /api/subjects
// @desc    Get all subjects for user
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const subjects = await Subject.find({ userId: req.userId })
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: subjects.length,
            data: subjects
        });
    } catch (error) {
        console.error('Get subjects error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   GET /api/subjects/:id
// @desc    Get single subject
// @access  Private
router.get('/:id', auth, async (req, res) => {
    try {
        const subject = await Subject.findOne({
            _id: req.params.id,
            userId: req.userId
        });

        if (!subject) {
            return res.status(404).json({
                success: false,
                message: 'Subject not found'
            });
        }

        res.json({
            success: true,
            data: subject
        });
    } catch (error) {
        console.error('Get subject error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   POST /api/subjects
// @desc    Create a new subject
// @access  Private
router.post('/', auth, async (req, res) => {
    try {
        const { name, weeklyHours, difficulty, color, examPriority } = req.body;

        // Validation
        if (!name || !weeklyHours) {
            return res.status(400).json({
                success: false,
                message: 'Please provide subject name and weekly hours'
            });
        }

        // Check for duplicate subject name
        const existingSubject = await Subject.findOne({
            userId: req.userId,
            name: { $regex: new RegExp(`^${name}$`, 'i') }
        });

        if (existingSubject) {
            return res.status(400).json({
                success: false,
                message: 'A subject with this name already exists'
            });
        }

        // Get count for color assignment
        const subjectCount = await Subject.countDocuments({ userId: req.userId });
        const assignedColor = color || colorPalette[subjectCount % colorPalette.length];

        const subject = new Subject({
            userId: req.userId,
            name,
            weeklyHours: Math.min(40, Math.max(1, weeklyHours)),
            difficulty: difficulty || 'medium',
            color: assignedColor,
            examPriority: examPriority || 0
        });

        await subject.save();

        res.status(201).json({
            success: true,
            message: 'Subject created successfully',
            data: subject
        });
    } catch (error) {
        console.error('Create subject error:', error);
        
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Subject with this name already exists'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   PUT /api/subjects/:id
// @desc    Update a subject
// @access  Private
router.put('/:id', auth, async (req, res) => {
    try {
        const { name, weeklyHours, difficulty, color, examPriority, isActive } = req.body;

        const subject = await Subject.findOne({
            _id: req.params.id,
            userId: req.userId
        });

        if (!subject) {
            return res.status(404).json({
                success: false,
                message: 'Subject not found'
            });
        }

        // Check for duplicate name (if name is being changed)
        if (name && name !== subject.name) {
            const existingSubject = await Subject.findOne({
                userId: req.userId,
                name: { $regex: new RegExp(`^${name}$`, 'i') },
                _id: { $ne: req.params.id }
            });

            if (existingSubject) {
                return res.status(400).json({
                    success: false,
                    message: 'A subject with this name already exists'
                });
            }
        }

        // Update fields
        if (name) subject.name = name;
        if (weeklyHours) subject.weeklyHours = Math.min(40, Math.max(1, weeklyHours));
        if (difficulty) subject.difficulty = difficulty;
        if (color) subject.color = color;
        if (examPriority !== undefined) subject.examPriority = examPriority;
        if (isActive !== undefined) subject.isActive = isActive;

        await subject.save();

        res.json({
            success: true,
            message: 'Subject updated successfully',
            data: subject
        });
    } catch (error) {
        console.error('Update subject error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

// @route   DELETE /api/subjects/:id
// @desc    Delete a subject
// @access  Private
router.delete('/:id', auth, async (req, res) => {
    try {
        const subject = await Subject.findOneAndDelete({
            _id: req.params.id,
            userId: req.userId
        });

        if (!subject) {
            return res.status(404).json({
                success: false,
                message: 'Subject not found'
            });
        }

        res.json({
            success: true,
            message: 'Subject deleted successfully',
            data: subject
        });
    } catch (error) {
        console.error('Delete subject error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
});

module.exports = router;
