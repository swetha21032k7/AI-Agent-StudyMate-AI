/**
 * StudyMate AI - Frontend Application
 * Main JavaScript file for handling all frontend functionality
 */

// API Base URL
const API_BASE = '';

// State
let currentUser = null;
let subjects = [];
let timetable = [];
let stats = null;

// ==================== UTILITY FUNCTIONS ====================

/**
 * Make API requests with authentication
 */
async function fetchAPI(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
        }
    };
    
    const mergedOptions = {
        ...defaultOptions,
        ...options,
        headers: {
            ...defaultOptions.headers,
            ...options.headers
        }
    };
    
    try {
        const response = await fetch(`${API_BASE}${endpoint}`, mergedOptions);
        const data = await response.json();
        
        if (response.status === 401) {
            // Token expired or invalid
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = 'index.html';
            return { success: false, message: 'Session expired' };
        }
        
        return data;
    } catch (error) {
        console.error('API Error:', error);
        return { success: false, message: 'Network error' };
    }
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

/**
 * Check authentication status
 */
function checkAuth() {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    if (!token || !user) {
        window.location.href = 'index.html';
        return false;
    }
    
    try {
        currentUser = JSON.parse(user);
        updateUserUI();
        return true;
    } catch (e) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'index.html';
        return false;
    }
}

/**
 * Update user interface with user data
 */
function updateUserUI() {
    if (!currentUser) return;
    
    const initial = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : 'U';
    
    const userAvatar = document.getElementById('userAvatar');
    const mobileUserAvatar = document.getElementById('mobileUserAvatar');
    const userName = document.getElementById('userName');
    const userEmail = document.getElementById('userEmail');
    const welcomeName = document.getElementById('welcomeName');
    
    if (userAvatar) userAvatar.textContent = initial;
    if (mobileUserAvatar) mobileUserAvatar.textContent = initial;
    if (userName) userName.textContent = currentUser.name || 'User';
    if (userEmail) userEmail.textContent = currentUser.email || '';
    if (welcomeName) welcomeName.textContent = currentUser.name?.split(' ')[0] || 'User';
}

// ==================== AUTHENTICATION ====================

/**
 * Show login modal
 */
function showLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

/**
 * Hide login modal
 */
function hideLoginModal() {
    const modal = document.getElementById('loginModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    document.getElementById('loginError')?.classList.add('hidden');
}

/**
 * Show register modal
 */
function showRegisterModal() {
    const modal = document.getElementById('registerModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
    }
}

/**
 * Hide register modal
 */
function hideRegisterModal() {
    const modal = document.getElementById('registerModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    document.getElementById('registerError')?.classList.add('hidden');
}

/**
 * Handle login form submission
 */
async function handleLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const errorDiv = document.getElementById('loginError');
    
    try {
        const response = await fetchAPI('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });
        
        if (response.success) {
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));
            window.location.href = 'dashboard.html';
        } else {
            errorDiv.textContent = response.message || 'Login failed';
            errorDiv.classList.remove('hidden');
        }
    } catch (error) {
        errorDiv.textContent = 'An error occurred. Please try again.';
        errorDiv.classList.remove('hidden');
    }
}

/**
 * Handle register form submission
 */
async function handleRegister(event) {
    event.preventDefault();
    
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const errorDiv = document.getElementById('registerError');
    
    try {
        const response = await fetchAPI('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({ name, email, password })
        });
        
        if (response.success) {
            localStorage.setItem('token', response.data.token);
            localStorage.setItem('user', JSON.stringify(response.data.user));
            window.location.href = 'dashboard.html';
        } else {
            errorDiv.textContent = response.message || 'Registration failed';
            errorDiv.classList.remove('hidden');
        }
    } catch (error) {
        errorDiv.textContent = 'An error occurred. Please try again.';
        errorDiv.classList.remove('hidden');
    }
}

/**
 * Handle logout
 */
function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

// ==================== DASHBOARD ====================

/**
 * Load dashboard data
 */
async function loadDashboard() {
    try {
        const response = await fetchAPI('/api/users/dashboard');
        
        if (response.success) {
            const { user, subjects: userSubjects, timetable: userTimetable, statistics } = response.data;
            
            currentUser = user;
            subjects = userSubjects;
            timetable = userTimetable;
            stats = statistics;
            
            // Update localStorage with fresh user data
            localStorage.setItem('user', JSON.stringify(user));
            
            updateUserUI();
            updateDashboardStats(statistics);
            renderSubjectProgress(userSubjects);
            renderTodaySchedule(userTimetable);
            loadPreferences(user.preferences);
        }
    } catch (error) {
        console.error('Error loading dashboard:', error);
        showToast('Error loading dashboard', 'error');
    }
}

/**
 * Update dashboard statistics
 */
function updateDashboardStats(statistics) {
    const totalSubjects = document.getElementById('totalSubjects');
    const currentStreak = document.getElementById('currentStreak');
    const completedSessions = document.getElementById('completedSessions');
    const totalMinutes = document.getElementById('totalMinutes');
    
    if (totalSubjects) totalSubjects.textContent = statistics.totalSubjects || 0;
    if (currentStreak) currentStreak.textContent = statistics.streak || 0;
    if (completedSessions) completedSessions.textContent = statistics.completedSessions || 0;
    if (totalMinutes) totalMinutes.textContent = currentUser?.statistics?.totalStudyMinutes || 0;
}

/**
 * Render subject progress cards
 */
function renderSubjectProgress(subjects) {
    const container = document.getElementById('subjectProgress');
    if (!container) return;
    
    if (!subjects || subjects.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-400 col-span-full">
                <p>No subjects added yet</p>
                <button onclick="showAddSubjectModal()" class="mt-4 text-cyan-400 hover:text-cyan-300">Add your first subject</button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = subjects.map(subject => `
        <div class="glass-card p-4 hover:bg-white/10 transition-all cursor-pointer" onclick="showEditSubjectModal('${subject._id}')">
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center space-x-3">
                    <div class="w-4 h-4 rounded-full" style="background-color: ${subject.color}"></div>
                    <span class="text-white font-medium">${subject.name}</span>
                </div>
                <span class="px-2 py-1 rounded-full text-xs font-medium badge-${subject.difficulty}">${subject.difficulty}</span>
            </div>
            <div class="mb-2">
                <div class="flex justify-between text-sm text-gray-400 mb-1">
                    <span>Progress</span>
                    <span>${subject.progress || 0}%</span>
                </div>
                <div class="h-2 bg-white/10 rounded-full overflow-hidden">
                    <div class="h-full rounded-full transition-all progress-bar" style="width: ${subject.progress || 0}%; background-color: ${subject.color}"></div>
                </div>
            </div>
            <div class="text-gray-400 text-sm">${subject.weeklyHours} hours/week</div>
        </div>
    `).join('');
}

/**
 * Render today's schedule
 */
function renderTodaySchedule(timetable) {
    const container = document.getElementById('todaySchedule');
    if (!container) return;
    
    const today = new Date().getDay();
    const dayIndex = today === 0 ? 6 : today - 1; // Convert Sunday=0 to 6
    
    const todayTimetable = timetable.find(t => t.dayOfWeek === dayIndex);
    
    if (!todayTimetable || !todayTimetable.sessions || todayTimetable.sessions.length === 0) {
        container.innerHTML = `
            <div class="text-center py-8 text-gray-400">
                <p>No sessions scheduled for today</p>
                <button onclick="generateTimetable()" class="mt-4 text-cyan-400 hover:text-cyan-300">Generate a timetable to get started</button>
            </div>
        `;
        return;
    }
    
    const studySessions = todayTimetable.sessions.filter(s => s.type === 'study');
    
    container.innerHTML = studySessions.slice(0, 5).map(session => `
        <div class="flex items-center justify-between p-3 rounded-lg ${session.completed ? 'bg-green-500/10' : 'bg-white/5'}">
            <div class="flex items-center space-x-3">
                <div class="w-3 h-3 rounded-full" style="background-color: ${session.color}"></div>
                <span class="text-white ${session.completed ? 'line-through opacity-60' : ''}">${session.subject}</span>
            </div>
            <div class="flex items-center space-x-3">
                <span class="text-gray-400 text-sm">${session.startTime}</span>
                ${session.completed ? '<span class="text-green-400">✓</span>' : ''}
            </div>
        </div>
    `).join('');
    
    if (studySessions.length > 5) {
        container.innerHTML += `
            <a href="timetable.html" class="block text-center text-cyan-400 hover:text-cyan-300 pt-2">
                View all ${studySessions.length} sessions →
            </a>
        `;
    }
}

// ==================== SUBJECTS ====================

/**
 * Show subjects section
 */
function showSubjectsSection() {
    document.getElementById('dashboardSection')?.classList.add('hidden');
    document.getElementById('preferencesSection')?.classList.add('hidden');
    document.getElementById('statsSection')?.classList.add('hidden');
    document.getElementById('subjectsSection')?.classList.remove('hidden');
    
    loadSubjects();
}

/**
 * Load subjects list
 */
async function loadSubjects() {
    try {
        const response = await fetchAPI('/api/subjects');
        
        if (response.success) {
            subjects = response.data;
            renderSubjectsList(subjects);
        }
    } catch (error) {
        console.error('Error loading subjects:', error);
    }
}

/**
 * Render subjects list in subjects section
 */
function renderSubjectsList(subjects) {
    const container = document.getElementById('subjectsList');
    if (!container) return;
    
    if (!subjects || subjects.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12">
                <svg class="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"></path>
                </svg>
                <h3 class="text-xl font-bold text-white mb-2">No subjects yet</h3>
                <p class="text-gray-400 mb-4">Add your first subject to get started</p>
                <button onclick="showAddSubjectModal()" class="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all">
                    Add Subject
                </button>
            </div>
        `;
        return;
    }
    
    container.innerHTML = subjects.map(subject => `
        <div class="glass-card p-6 hover:bg-white/10 transition-all">
            <div class="flex items-start justify-between mb-4">
                <div class="flex items-center space-x-3">
                    <div class="w-12 h-12 rounded-xl flex items-center justify-center" style="background-color: ${subject.color}20">
                        <div class="w-6 h-6 rounded-full" style="background-color: ${subject.color}"></div>
                    </div>
                    <div>
                        <h3 class="text-white font-bold">${subject.name}</h3>
                        <span class="text-gray-400 text-sm">${subject.weeklyHours} hours/week</span>
                    </div>
                </div>
                <button onclick="showEditSubjectModal('${subject._id}')" class="text-gray-400 hover:text-white p-2">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path>
                    </svg>
                </button>
            </div>
            
            <div class="flex items-center space-x-3 mb-4">
                <span class="px-3 py-1 rounded-full text-xs font-medium badge-${subject.difficulty}">${subject.difficulty}</span>
                <span class="text-gray-400 text-sm">${subject.completedSessions || 0}/${subject.totalSessions || 0} sessions</span>
            </div>
            
            <div>
                <div class="flex justify-between text-sm text-gray-400 mb-2">
                    <span>Progress</span>
                    <span>${subject.progress || 0}%</span>
                </div>
                <div class="h-3 bg-white/10 rounded-full overflow-hidden">
                    <div class="h-full rounded-full transition-all progress-bar" style="width: ${subject.progress || 0}%; background-color: ${subject.color}"></div>
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * Show add subject modal
 */
function showAddSubjectModal() {
    const modal = document.getElementById('addSubjectModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        
        // Reset form
        document.getElementById('addSubjectForm')?.reset();
        document.getElementById('subjectDifficulty').value = 'medium';
        document.getElementById('subjectColor').value = '#3B82F6';
        
        // Reset button states
        document.querySelectorAll('.difficulty-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.classList.contains('medium')) btn.classList.add('active');
        });
        
        document.querySelectorAll('.color-option').forEach((btn, idx) => {
            btn.classList.toggle('selected', idx === 0);
        });
    }
}

/**
 * Hide add subject modal
 */
function hideAddSubjectModal() {
    const modal = document.getElementById('addSubjectModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    document.getElementById('addSubjectError')?.classList.add('hidden');
}

/**
 * Select difficulty for new subject
 */
function selectDifficulty(difficulty) {
    document.getElementById('subjectDifficulty').value = difficulty;
    
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.classList.contains(difficulty)) {
            btn.classList.add('active');
        }
    });
}

/**
 * Select color for new subject
 */
function selectColor(color) {
    document.getElementById('subjectColor').value = color;
    
    document.querySelectorAll('.color-option').forEach(btn => {
        btn.classList.remove('selected');
        if (btn.style.background === color || btn.style.backgroundColor === color) {
            btn.classList.add('selected');
        }
    });
}

/**
 * Handle add subject form submission
 */
async function handleAddSubject(event) {
    event.preventDefault();
    
    const name = document.getElementById('subjectName').value;
    const weeklyHours = parseInt(document.getElementById('weeklyHours').value);
    const difficulty = document.getElementById('subjectDifficulty').value;
    const color = document.getElementById('subjectColor').value;
    const errorDiv = document.getElementById('addSubjectError');
    
    try {
        const response = await fetchAPI('/api/subjects', {
            method: 'POST',
            body: JSON.stringify({ name, weeklyHours, difficulty, color })
        });
        
        if (response.success) {
            hideAddSubjectModal();
            showToast('Subject added successfully!', 'success');
            loadDashboard();
            loadSubjects();
        } else {
            errorDiv.textContent = response.message || 'Failed to add subject';
            errorDiv.classList.remove('hidden');
        }
    } catch (error) {
        errorDiv.textContent = 'An error occurred. Please try again.';
        errorDiv.classList.remove('hidden');
    }
}

/**
 * Show edit subject modal
 */
async function showEditSubjectModal(subjectId) {
    const subject = subjects.find(s => s._id === subjectId);
    if (!subject) return;
    
    const modal = document.getElementById('editSubjectModal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        
        document.getElementById('editSubjectId').value = subjectId;
        document.getElementById('editSubjectName').value = subject.name;
        document.getElementById('editWeeklyHours').value = subject.weeklyHours;
        document.getElementById('editSubjectDifficulty').value = subject.difficulty;
        document.getElementById('editSubjectColor').value = subject.color;
        
        // Update button states
        document.querySelectorAll('.edit-difficulty-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.classList.contains(subject.difficulty)) {
                btn.classList.add('active');
            }
        });
        
        document.querySelectorAll('.edit-color-option').forEach(btn => {
            btn.classList.remove('selected');
            const btnColor = btn.style.background || btn.style.backgroundColor;
            if (btnColor === subject.color) {
                btn.classList.add('selected');
            }
        });
    }
}

/**
 * Hide edit subject modal
 */
function hideEditSubjectModal() {
    const modal = document.getElementById('editSubjectModal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
    }
    document.getElementById('editSubjectError')?.classList.add('hidden');
}

/**
 * Select difficulty for edit subject
 */
function selectEditDifficulty(difficulty) {
    document.getElementById('editSubjectDifficulty').value = difficulty;
    
    document.querySelectorAll('.edit-difficulty-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.classList.contains(difficulty)) {
            btn.classList.add('active');
        }
    });
}

/**
 * Select color for edit subject
 */
function selectEditColor(color) {
    document.getElementById('editSubjectColor').value = color;
    
    document.querySelectorAll('.edit-color-option').forEach(btn => {
        btn.classList.remove('selected');
        if (btn.style.background === color || btn.style.backgroundColor === color) {
            btn.classList.add('selected');
        }
    });
}

/**
 * Handle edit subject form submission
 */
async function handleEditSubject(event) {
    event.preventDefault();
    
    const subjectId = document.getElementById('editSubjectId').value;
    const name = document.getElementById('editSubjectName').value;
    const weeklyHours = parseInt(document.getElementById('editWeeklyHours').value);
    const difficulty = document.getElementById('editSubjectDifficulty').value;
    const color = document.getElementById('editSubjectColor').value;
    const errorDiv = document.getElementById('editSubjectError');
    
    try {
        const response = await fetchAPI(`/api/subjects/${subjectId}`, {
            method: 'PUT',
            body: JSON.stringify({ name, weeklyHours, difficulty, color })
        });
        
        if (response.success) {
            hideEditSubjectModal();
            showToast('Subject updated successfully!', 'success');
            loadDashboard();
            loadSubjects();
        } else {
            errorDiv.textContent = response.message || 'Failed to update subject';
            errorDiv.classList.remove('hidden');
        }
    } catch (error) {
        errorDiv.textContent = 'An error occurred. Please try again.';
        errorDiv.classList.remove('hidden');
    }
}

/**
 * Delete subject
 */
async function deleteSubject() {
    const subjectId = document.getElementById('editSubjectId').value;
    
    if (!confirm('Are you sure you want to delete this subject?')) {
        return;
    }
    
    try {
        const response = await fetchAPI(`/api/subjects/${subjectId}`, {
            method: 'DELETE'
        });
        
        if (response.success) {
            hideEditSubjectModal();
            showToast('Subject deleted successfully!', 'success');
            loadDashboard();
            loadSubjects();
        } else {
            showToast(response.message || 'Failed to delete subject', 'error');
        }
    } catch (error) {
        showToast('An error occurred. Please try again.', 'error');
    }
}

// ==================== PREFERENCES ====================

/**
 * Show preferences section
 */
function showPreferencesSection() {
    document.getElementById('dashboardSection')?.classList.add('hidden');
    document.getElementById('subjectsSection')?.classList.add('hidden');
    document.getElementById('statsSection')?.classList.add('hidden');
    document.getElementById('preferencesSection')?.classList.remove('hidden');
}

/**
 * Load user preferences into form
 */
function loadPreferences(preferences) {
    if (!preferences) return;
    
    const dailyHours = document.getElementById('dailyHours');
    const dailyHoursValue = document.getElementById('dailyHoursValue');
    
    if (dailyHours) {
        dailyHours.value = preferences.dailyHours || 4;
        if (dailyHoursValue) {
            dailyHoursValue.textContent = `${preferences.dailyHours || 4} hours`;
        }
    }
    
    selectSessionDuration(preferences.sessionDuration || 25);
    selectBreakDuration(preferences.breakDuration || 5);
}

/**
 * Update range value display
 */
function updateRangeValue(inputId, displayId) {
    const input = document.getElementById(inputId);
    const display = document.getElementById(displayId);
    
    if (input && display) {
        display.textContent = `${input.value} hours`;
    }
}

/**
 * Select session duration
 */
function selectSessionDuration(duration) {
    document.getElementById('sessionDuration').value = duration;
    
    document.querySelectorAll('.session-duration-btn').forEach(btn => {
        if (parseInt(btn.dataset.value) === duration) {
            btn.classList.add('bg-cyan-500', 'border-cyan-500');
            btn.classList.remove('border-white/20');
        } else {
            btn.classList.remove('bg-cyan-500', 'border-cyan-500');
            btn.classList.add('border-white/20');
        }
    });
}

/**
 * Select break duration
 */
function selectBreakDuration(duration) {
    document.getElementById('breakDuration').value = duration;
    
    document.querySelectorAll('.break-duration-btn').forEach(btn => {
        if (parseInt(btn.dataset.value) === duration) {
            btn.classList.add('bg-cyan-500', 'border-cyan-500');
            btn.classList.remove('border-white/20');
        } else {
            btn.classList.remove('bg-cyan-500', 'border-cyan-500');
            btn.classList.add('border-white/20');
        }
    });
}

/**
 * Save preferences
 */
async function savePreferences(event) {
    event.preventDefault();
    
    const dailyHours = parseInt(document.getElementById('dailyHours').value);
    const sessionDuration = parseInt(document.getElementById('sessionDuration').value);
    const breakDuration = parseInt(document.getElementById('breakDuration').value);
    
    try {
        const response = await fetchAPI('/api/users/profile', {
            method: 'PUT',
            body: JSON.stringify({
                preferences: { dailyHours, sessionDuration, breakDuration }
            })
        });
        
        if (response.success) {
            localStorage.setItem('user', JSON.stringify(response.data.user));
            currentUser = response.data.user;
            showToast('Preferences saved successfully!', 'success');
        } else {
            showToast(response.message || 'Failed to save preferences', 'error');
        }
    } catch (error) {
        showToast('An error occurred. Please try again.', 'error');
    }
}

// ==================== STATISTICS ====================

/**
 * Show statistics section
 */
function showStatsSection() {
    document.getElementById('dashboardSection')?.classList.add('hidden');
    document.getElementById('subjectsSection')?.classList.add('hidden');
    document.getElementById('preferencesSection')?.classList.add('hidden');
    document.getElementById('statsSection')?.classList.remove('hidden');
    
    loadStats();
}

/**
 * Load statistics
 */
async function loadStats() {
    try {
        const response = await fetchAPI('/api/stats');
        
        if (response.success) {
            renderWeeklyChart(response.data.weekly);
            renderSubjectDistribution(response.data.subjects);
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

/**
 * Render weekly chart
 */
function renderWeeklyChart(weeklyData) {
    const container = document.getElementById('weeklyChart');
    if (!container) return;
    
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const maxMinutes = Math.max(...(weeklyData.days?.map(d => d.totalStudyMinutes) || [0]), 60);
    
    container.innerHTML = days.map((day, index) => {
        const dayData = weeklyData.days?.find(d => {
            const date = new Date(d.date);
            return date.getDay() === (index === 6 ? 0 : index + 1);
        });
        
        const minutes = dayData?.totalStudyMinutes || 0;
        const height = maxMinutes > 0 ? (minutes / maxMinutes) * 100 : 0;
        
        return `
            <div class="flex-1 flex flex-col items-center justify-end">
                <div class="w-full bg-gradient-to-t from-cyan-500 to-blue-600 rounded-t-lg transition-all hover:opacity-80" style="height: ${Math.max(height, 2)}%"></div>
            </div>
        `;
    }).join('');
}

/**
 * Render subject distribution
 */
function renderSubjectDistribution(subjectsData) {
    const container = document.getElementById('subjectDistribution');
    if (!container) return;
    
    if (!subjectsData || subjectsData.length === 0) {
        container.innerHTML = '<p class="text-gray-400 text-center">No data available</p>';
        return;
    }
    
    const maxProgress = Math.max(...subjectsData.map(s => s.progress || 0), 1);
    
    container.innerHTML = subjectsData.map(subject => `
        <div class="flex items-center space-x-3">
            <div class="w-24 text-gray-300 text-sm truncate">${subject.name}</div>
            <div class="flex-1 h-3 bg-white/10 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all" style="width: ${subject.progress || 0}%; background-color: ${subject.color}"></div>
            </div>
            <div class="w-12 text-right text-gray-400 text-sm">${subject.progress || 0}%</div>
        </div>
    `).join('');
}

// ==================== TIMETABLE ====================

/**
 * Generate timetable
 */
async function generateTimetable() {
    try {
        showToast('Generating your personalized timetable...', 'info');
        
        const response = await fetchAPI('/api/timetable/generate', {
            method: 'POST'
        });
        
        if (response.success) {
            showToast('Timetable generated successfully! 🎉', 'success');
            
            // Reload data
            if (typeof loadTimetable === 'function') {
                await loadTimetable();
            }
            if (typeof loadDashboard === 'function') {
                await loadDashboard();
            }
        } else {
            showToast(response.message || 'Failed to generate timetable', 'error');
        }
    } catch (error) {
        console.error('Error generating timetable:', error);
        showToast('Error generating timetable', 'error');
    }
}

// ==================== EXPORT ====================

/**
 * Export data
 */
async function exportData(format) {
    try {
        const endpoint = format === 'json' ? '/api/users/export/json' : '/api/users/export/csv';
        
        const token = localStorage.getItem('token');
        const response = await fetch(endpoint, {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = format === 'json' ? 'studymate-export.json' : 'studymate-timetable.csv';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            
            showToast(`Data exported as ${format.toUpperCase()}!`, 'success');
        } else {
            showToast('Failed to export data', 'error');
        }
    } catch (error) {
        console.error('Error exporting data:', error);
        showToast('Error exporting data', 'error');
    }
}

// ==================== MOBILE NAVIGATION ====================

/**
 * Toggle sidebar on mobile
 */
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('open');
    }
}

// Close sidebar when clicking outside on mobile
document.addEventListener('click', function(event) {
    const sidebar = document.getElementById('sidebar');
    const toggleBtn = event.target.closest('[onclick="toggleSidebar()"]');
    
    if (sidebar && sidebar.classList.contains('open') && !sidebar.contains(event.target) && !toggleBtn) {
        sidebar.classList.remove('open');
    }
});

// ==================== DASHBOARD SECTION NAVIGATION ====================

/**
 * Show dashboard section
 */
function showDashboardSection() {
    document.getElementById('subjectsSection')?.classList.add('hidden');
    document.getElementById('preferencesSection')?.classList.add('hidden');
    document.getElementById('statsSection')?.classList.add('hidden');
    document.getElementById('dashboardSection')?.classList.remove('hidden');
}

// Handle hash navigation
window.addEventListener('hashchange', function() {
    const hash = window.location.hash;
    
    switch(hash) {
        case '#subjects':
            showSubjectsSection();
            break;
        case '#preferences':
            showPreferencesSection();
            break;
        case '#stats':
            showStatsSection();
            break;
        default:
            showDashboardSection();
    }
});

// Check hash on page load
document.addEventListener('DOMContentLoaded', function() {
    const hash = window.location.hash;
    
    if (hash === '#subjects') {
        showSubjectsSection();
    } else if (hash === '#preferences') {
        showPreferencesSection();
    } else if (hash === '#stats') {
        showStatsSection();
    }
});
