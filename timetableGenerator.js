/**
 * AI Timetable Generator
 * Generates optimized study schedules based on:
 * - Subject difficulty weighting
 * - Weekly hours requirements
 * - Exam priority
 * - User preferences (daily hours, session duration, break duration)
 */

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Difficulty weights - harder subjects get more focused time slots
const DIFFICULTY_WEIGHTS = {
    easy: 1,
    medium: 1.5,
    hard: 2
};

// Optimal study times (higher weight = better time for studying)
const TIME_SLOT_WEIGHTS = {
    morning: 1.5,    // 6 AM - 12 PM
    afternoon: 1.2,  // 12 PM - 5 PM
    evening: 1.0,    // 5 PM - 9 PM
    night: 0.8       // 9 PM - 11 PM
};

/**
 * Convert 24-hour time to 12-hour AM/PM format
 */
function formatTime(hours, minutes) {
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes.toString().padStart(2, '0');
    return `${displayHours}:${displayMinutes} ${period}`;
}

/**
 * Add minutes to a time and return new hours and minutes
 */
function addMinutes(hours, minutes, addMins) {
    const totalMinutes = hours * 60 + minutes + addMins;
    return {
        hours: Math.floor(totalMinutes / 60) % 24,
        minutes: totalMinutes % 60
    };
}

/**
 * Calculate subject priority score
 */
function calculatePriority(subject) {
    const difficultyWeight = DIFFICULTY_WEIGHTS[subject.difficulty] || 1;
    const examWeight = 1 + (subject.examPriority || 0) * 0.2;
    const hoursWeight = Math.min(subject.weeklyHours / 10, 2);
    
    return difficultyWeight * examWeight * hoursWeight;
}

/**
 * Distribute sessions across the week
 */
function distributeSessionsPerDay(totalSessions, daysCount = 7) {
    const basePerDay = Math.floor(totalSessions / daysCount);
    const remainder = totalSessions % daysCount;
    
    const distribution = Array(daysCount).fill(basePerDay);
    
    // Distribute remainder across days (prefer weekdays)
    for (let i = 0; i < remainder; i++) {
        distribution[i % daysCount]++;
    }
    
    return distribution;
}

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Main timetable generation function
 */
function generateTimetable(subjects, preferences) {
    const {
        dailyHours = 4,
        sessionDuration = 25,
        breakDuration = 5
    } = preferences;

    // Convert daily hours to minutes
    const dailyMinutes = dailyHours * 60;
    
    // Calculate how many study sessions can fit per day
    const sessionWithBreak = sessionDuration + breakDuration;
    const maxSessionsPerDay = Math.floor(dailyMinutes / sessionDuration);
    
    // Calculate subject priorities and required sessions
    const subjectData = subjects.map(subject => {
        const weeklyMinutes = subject.weeklyHours * 60;
        const sessionsNeeded = Math.ceil(weeklyMinutes / sessionDuration);
        const priority = calculatePriority(subject);
        
        return {
            ...subject,
            sessionsNeeded,
            sessionsAssigned: 0,
            priority
        };
    });

    // Sort by priority (highest first)
    subjectData.sort((a, b) => b.priority - a.priority);

    // Initialize timetable for each day
    const timetable = DAYS.map((dayName, index) => ({
        dayOfWeek: index,
        dayName,
        sessions: [],
        totalStudyMinutes: 0,
        totalBreakMinutes: 0
    }));

    // Create a pool of all required sessions
    let sessionPool = [];
    subjectData.forEach(subject => {
        for (let i = 0; i < subject.sessionsNeeded; i++) {
            sessionPool.push({
                subject: subject.name,
                subjectId: subject._id,
                color: subject.color,
                difficulty: subject.difficulty,
                priority: subject.priority
            });
        }
    });

    // Shuffle for variety
    sessionPool = shuffleArray(sessionPool);

    // Sort by priority to ensure important subjects get better slots
    sessionPool.sort((a, b) => b.priority - a.priority);

    // Distribute sessions across days
    let currentDay = 0;
    let startHour = 8; // Start at 8 AM
    let startMinute = 0;

    sessionPool.forEach((sessionData, index) => {
        // Find the best day (least filled that can still accept)
        let targetDay = currentDay;
        let minSessions = Infinity;
        
        for (let d = 0; d < 7; d++) {
            if (timetable[d].sessions.filter(s => s.type === 'study').length < maxSessionsPerDay) {
                if (timetable[d].sessions.filter(s => s.type === 'study').length < minSessions) {
                    minSessions = timetable[d].sessions.filter(s => s.type === 'study').length;
                    targetDay = d;
                }
            }
        }

        const day = timetable[targetDay];
        
        // Check if we can add more sessions to this day
        const currentStudySessions = day.sessions.filter(s => s.type === 'study').length;
        if (currentStudySessions >= maxSessionsPerDay) {
            return; // Skip this session if day is full
        }

        // Calculate start time for this day
        const daySessionCount = day.sessions.length;
        let sessionStartHour = startHour;
        let sessionStartMinute = 0;
        
        if (daySessionCount > 0) {
            // Get the last session's end time
            const lastSession = day.sessions[day.sessions.length - 1];
            const lastEndParts = lastSession.endTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
            if (lastEndParts) {
                sessionStartHour = parseInt(lastEndParts[1]);
                sessionStartMinute = parseInt(lastEndParts[2]);
                if (lastEndParts[3].toUpperCase() === 'PM' && sessionStartHour !== 12) {
                    sessionStartHour += 12;
                }
                if (lastEndParts[3].toUpperCase() === 'AM' && sessionStartHour === 12) {
                    sessionStartHour = 0;
                }
            }
        }

        // Create study session
        const studyEnd = addMinutes(sessionStartHour, sessionStartMinute, sessionDuration);
        
        day.sessions.push({
            subject: sessionData.subject,
            subjectId: sessionData.subjectId,
            startTime: formatTime(sessionStartHour, sessionStartMinute),
            endTime: formatTime(studyEnd.hours, studyEnd.minutes),
            duration: sessionDuration,
            type: 'study',
            completed: false,
            color: sessionData.color
        });

        day.totalStudyMinutes += sessionDuration;

        // Add break after study session (except for last session of the day)
        if (currentStudySessions < maxSessionsPerDay - 1) {
            const breakEnd = addMinutes(studyEnd.hours, studyEnd.minutes, breakDuration);
            
            day.sessions.push({
                subject: 'Break',
                subjectId: null,
                startTime: formatTime(studyEnd.hours, studyEnd.minutes),
                endTime: formatTime(breakEnd.hours, breakEnd.minutes),
                duration: breakDuration,
                type: 'break',
                completed: false,
                color: '#9CA3AF'
            });

            day.totalBreakMinutes += breakDuration;
        }

        // Move to next day in rotation
        currentDay = (currentDay + 1) % 7;
    });

    // Ensure harder subjects are distributed throughout the week
    // and not clustered together
    timetable.forEach(day => {
        // Interleave easy and hard subjects
        const studySessions = day.sessions.filter(s => s.type === 'study');
        const breaks = day.sessions.filter(s => s.type === 'break');
        
        // Sort study sessions to alternate difficulty
        studySessions.sort((a, b) => {
            const diffA = DIFFICULTY_WEIGHTS[a.difficulty] || 1;
            const diffB = DIFFICULTY_WEIGHTS[b.difficulty] || 1;
            return diffB - diffA; // Hard subjects first (morning)
        });
        
        // Rebuild sessions array with proper times
        day.sessions = [];
        let currentHour = startHour;
        let currentMinute = 0;
        
        studySessions.forEach((session, idx) => {
            // Add study session
            const studyEnd = addMinutes(currentHour, currentMinute, sessionDuration);
            
            day.sessions.push({
                ...session,
                startTime: formatTime(currentHour, currentMinute),
                endTime: formatTime(studyEnd.hours, studyEnd.minutes)
            });
            
            currentHour = studyEnd.hours;
            currentMinute = studyEnd.minutes;
            
            // Add break after (except last)
            if (idx < studySessions.length - 1) {
                const breakEnd = addMinutes(currentHour, currentMinute, breakDuration);
                
                day.sessions.push({
                    subject: 'Break',
                    subjectId: null,
                    startTime: formatTime(currentHour, currentMinute),
                    endTime: formatTime(breakEnd.hours, breakEnd.minutes),
                    duration: breakDuration,
                    type: 'break',
                    completed: false,
                    color: '#9CA3AF'
                });
                
                currentHour = breakEnd.hours;
                currentMinute = breakEnd.minutes;
            }
        });
    });

    return timetable;
}

/**
 * Regenerate timetable for specific day
 */
function regenerateDay(dayTimetable, subjects, preferences) {
    // Similar logic but for single day
    const { sessionDuration = 25, breakDuration = 5, dailyHours = 4 } = preferences;
    
    const shuffledSubjects = shuffleArray(subjects);
    const maxSessions = Math.floor((dailyHours * 60) / sessionDuration);
    
    const sessions = [];
    let currentHour = 8;
    let currentMinute = 0;
    
    for (let i = 0; i < Math.min(maxSessions, shuffledSubjects.length); i++) {
        const subject = shuffledSubjects[i % shuffledSubjects.length];
        const studyEnd = addMinutes(currentHour, currentMinute, sessionDuration);
        
        sessions.push({
            subject: subject.name,
            subjectId: subject._id,
            startTime: formatTime(currentHour, currentMinute),
            endTime: formatTime(studyEnd.hours, studyEnd.minutes),
            duration: sessionDuration,
            type: 'study',
            completed: false,
            color: subject.color
        });
        
        currentHour = studyEnd.hours;
        currentMinute = studyEnd.minutes;
        
        if (i < maxSessions - 1) {
            const breakEnd = addMinutes(currentHour, currentMinute, breakDuration);
            
            sessions.push({
                subject: 'Break',
                subjectId: null,
                startTime: formatTime(currentHour, currentMinute),
                endTime: formatTime(breakEnd.hours, breakEnd.minutes),
                duration: breakDuration,
                type: 'break',
                completed: false,
                color: '#9CA3AF'
            });
            
            currentHour = breakEnd.hours;
            currentMinute = breakEnd.minutes;
        }
    }
    
    return sessions;
}

module.exports = {
    generateTimetable,
    regenerateDay,
    DAYS,
    formatTime,
    addMinutes
};
