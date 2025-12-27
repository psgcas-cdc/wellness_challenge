// ============================================
// CONFIGURATION
// ============================================
const SUPABASE_URL = 'https://auwucgomaoibtrcfghmp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF1d3VjZ29tYW9pYnRyY2ZnaG1wIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUwMTUzMzYsImV4cCI6MjA4MDU5MTMzNn0.dVrYPiSEbvXP2Ur-PhOlOe6e9NWhub_993CTm6ZXREI';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============================================
// STATE
// ============================================
let currentUser = null;
let activities = [];
let currentLeaderboardWeek = null;
let currentDashboardWeek = null; 
let weeklyChart = null;
let leaderboardChart = null;
let selectedActivity = null;
let selectedDate = null;
let loggedActivitiesForDate = [];

// ============================================
// ACTIVITY ICONS CONFIGURATION
// ============================================
const activityIcons = {
    'Reading': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
    'Writing': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    'Meditation': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v4"/><path d="M12 18v4"/><path d="m4.93 4.93 2.83 2.83"/><path d="m16.24 16.24 2.83 2.83"/><path d="M2 12h4"/><path d="M18 12h4"/><path d="m4.93 19.07 2.83-2.83"/><path d="m16.24 7.76 2.83-2.83"/></svg>`,
    'Water': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>`,
    'Screen Time': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>`,
    'Sleep': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`,
    'Walking': `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>`
};

// ============================================
// HELPER FUNCTIONS
// ============================================
function getWeekStart(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff)).toISOString().split('T')[0];
}

function formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getWeekDisplay(weekStart) {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return `${formatDate(weekStart)} - ${formatDate(end.toISOString().split('T')[0])}`;
}

function showToast(message) {
    const toast = document.getElementById('successToast');
    const toastMessage = document.getElementById('toastMessage');
    toastMessage.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

// ============================================
// INITIALIZATION
// ============================================
async function init() {
    await loadParticipants();
    await loadActivities();
    setTodayDate();
    
    // Check for stored user session
    const storedUserId = localStorage.getItem('currentUserId');
    if (storedUserId) {
        document.getElementById('participantSelect').value = storedUserId;
        await login();
    }
}

async function loadParticipants() {
    const { data, error } = await supabaseClient
        .from('participants')
        .select('*')
        .eq('active', true)
        .order('name');

    if (error) {
        console.error('Error loading participants:', error);
        return;
    }

    const select = document.getElementById('participantSelect');
    data.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.name;
        select.appendChild(option);
    });
}

async function loadActivities() {
    const { data, error } = await supabaseClient
        .from('activities')
        .select('*')
        .eq('active', true)
        .order('id');

    if (error) {
        console.error('Error loading activities:', error);
        return;
    }

    activities = data;
}

// ============================================
// LOGIN/LOGOUT
// ============================================
async function login() {
    const participantId = document.getElementById('participantSelect').value;
    if (!participantId) {
        alert('Please select your name');
        return;
    }

    const { data, error } = await supabaseClient
        .from('participants')
        .select('*')
        .eq('id', participantId)
        .single();

    if (error) {
        console.error('Error logging in:', error);
        return;
    }

    currentUser = data;
    localStorage.setItem('currentUserId', participantId);
    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('loggedInSection').style.display = 'flex';
    document.getElementById('currentUserName').textContent = data.nick_name || data.name;
    document.getElementById('mainContent').classList.add('active');
    document.getElementById('fabButton').style.display = 'flex';

    currentLeaderboardWeek = getWeekStart(new Date());
    currentDashboardWeek = getWeekStart(new Date()); 
    await loadDashboard();
}

function logout() {
    currentUser = null;
    localStorage.removeItem('currentUserId');
    document.getElementById('loginSection').style.display = 'flex';
    document.getElementById('loggedInSection').style.display = 'none';
    document.getElementById('mainContent').classList.remove('active');
    document.getElementById('participantSelect').value = '';
    document.getElementById('fabButton').style.display = 'none';
}

// ============================================
// TABS
// ============================================
function showTab(tabName) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
    
    event.target.closest('.tab').classList.add('active');
    document.getElementById(tabName + 'Tab').classList.add('active');

    if (tabName === 'dashboard') {
        loadDashboard();
    } else if (tabName === 'leaderboard') {
        loadLeaderboard();
    }
}

// ============================================
// DASHBOARD
// ============================================
async function loadDashboard() {
    document.getElementById('currentWeekDisplay').textContent = getWeekDisplay(currentDashboardWeek);
    
    const today = getWeekStart(new Date());
    document.getElementById('dashboardNextWeekBtn').disabled = currentDashboardWeek >= today;
    
    await loadStatsGrid(currentDashboardWeek);
    await loadWeeklyChart(currentDashboardWeek);
    await loadRecentActivity();
}

async function changeDashboardWeek(direction) {
    const currentDate = new Date(currentDashboardWeek);
    currentDate.setDate(currentDate.getDate() + (direction * 7));
    currentDashboardWeek = getWeekStart(currentDate);
    
    await loadDashboard();
}

async function loadStatsGrid(weekStart) {
    const statsGrid = document.getElementById('statsGrid');
    statsGrid.innerHTML = '';

    for (const activity of activities) {
    const { data, error } = await supabaseClient
        .from('activity_logs')
        .select('value, log_date')
        .eq('participant_id', currentUser.id)
        .eq('activity_id', activity.id)
        .eq('week_start_date', weekStart);

    let total = 0;
    let displayValue = '';
    let progressPercent = 0;
    let goalText = '';
    let hasGoal = false;

    if (activity.activity_type === 'accumulative') {
        total = data ? data.reduce((sum, log) => sum + parseFloat(log.value), 0) : 0;
        
        // Calculate goal based on max_points threshold
        // Assuming max_points is reached when total reaches a certain threshold
        // We'll use min_threshold as the weekly goal
        const weeklyGoal = parseFloat(activity.min_threshold);
        
        if (activity.name === 'Walking') {
            displayValue = total.toLocaleString();
            goalText = 'steps';
        } else if (activity.name === 'Reading' || activity.name === 'Writing') {
            displayValue = total;
            goalText = 'pages';
        } else {
            displayValue = total;
            goalText = 'units';
        }
        
        progressPercent = Math.min((total / weeklyGoal) * 100, 100);
        hasGoal = true;
        } else {
        // Daily boolean activities
        total = data ? data.length : 0;
        displayValue = total;
        const weeklyGoal = parseFloat(activity.min_threshold);
        goalText = `of ${weeklyGoal} days`;
        progressPercent = (total / weeklyGoal) * 100;
        hasGoal = true;
    }

        const card = document.createElement('div');
        card.className = 'stat-card';
        
        const isComplete = progressPercent >= 100;
        
        card.innerHTML = `
            <div class="stat-header">
                <div class="stat-icon">
                    ${activityIcons[activity.name] || ''}
                </div>
                <div class="stat-info">
                    <h3>${activity.name}</h3>
                </div>
            </div>
            <div class="stat-value">${displayValue}</div>
            ${hasGoal ? `
                <div class="stat-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progressPercent}%"></div>
                    </div>
                    <div class="progress-label">
                        <span>${goalText}</span>
                        <span>${Math.round(progressPercent)}%</span>
                    </div>
                </div>
            ` : ''}
            ${isComplete ? `
                <div class="stat-badge">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Goal Achieved
                </div>
            ` : ''}
        `;
        
        statsGrid.appendChild(card);
    }
}

async function loadWeeklyChart(weekStart) {
    // Get data for the entire week
    const { data, error } = await supabaseClient
        .from('activity_logs')
        .select('*, activities(name)')
        .eq('participant_id', currentUser.id)
        .eq('week_start_date', weekStart)
        .order('log_date');

    if (error) {
        console.error('Error loading chart data:', error);
        return;
    }

    // Prepare data structure
    const weekDays = [];
    const startDate = new Date(weekStart);
    for (let i = 0; i < 7; i++) {
        const date = new Date(startDate);
        date.setDate(date.getDate() + i);
        weekDays.push(date.toISOString().split('T')[0]);
    }

    // Group by activity
    const activityData = {};
    activities.forEach(activity => {
        activityData[activity.name] = weekDays.map(() => 0);
    });

    // Fill in the data
    data.forEach(log => {
        const dayIndex = weekDays.indexOf(log.log_date);
        if (dayIndex !== -1 && activityData[log.activities.name]) {
            if (log.activities.name === 'Walking') {
                activityData[log.activities.name][dayIndex] += parseFloat(log.value) / 1000; // Convert to thousands
            } else {
                activityData[log.activities.name][dayIndex] += parseFloat(log.value);
            }
        }
    });

    // Create datasets - show selected activity and optionally compared participant
    const selectedActivity = document.getElementById('activityChartSelect')?.value || 'Walking';
    const compareParticipantId = document.getElementById('compareAgainstSelect')?.value || '';
    const colors = [
        '#0EA5E9', '#FF6B35', '#10B981', '#F59E0B', 
        '#8B5CF6', '#EC4899', '#06B6D4'
    ];

    let datasets = [];

    // Add current user's dataset
    const colorIndex = Object.keys(activityData).indexOf(selectedActivity);
    datasets.push({
        label: `${currentUser.nick_name || currentUser.name} - ${selectedActivity}`,
        data: activityData[selectedActivity],
        borderColor: colors[colorIndex % colors.length],
        backgroundColor: colors[colorIndex % colors.length] + '20',
        borderWidth: 3,
        tension: 0.4,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: '#FFFFFF',
        pointBorderWidth: 2,
        fill: false
    });

    // Add comparison participant's dataset if selected
    if (compareParticipantId) {
        const { data: compareData, error: compareError } = await supabaseClient
            .from('activity_logs')
            .select('*, activities(name)')
            .eq('participant_id', compareParticipantId)
            .eq('week_start_date', weekStart)
            .order('log_date');

        if (!compareError && compareData) {
            const compareActivityData = weekDays.map(() => 0);
            
            compareData.forEach(log => {
                const dayIndex = weekDays.indexOf(log.log_date);
                if (dayIndex !== -1 && log.activities.name === selectedActivity) {
                    if (log.activities.name === 'Walking') {
                        compareActivityData[dayIndex] += parseFloat(log.value) / 1000;
                    } else {
                        compareActivityData[dayIndex] += parseFloat(log.value);
                    }
                }
            });

            const { data: participantData } = await supabaseClient
                .from('participants')
                .select('name, nick_name')
                .eq('id', compareParticipantId)
                .single();

            const compareName = participantData ? (participantData.nick_name || participantData.name) : 'Other';

            datasets.push({
                label: `${compareName} - ${selectedActivity}`,
                data: compareActivityData,
                borderColor: '#EF4444',
                backgroundColor: '#EF444420',
                borderWidth: 3,
                borderDash: [5, 5],
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#FFFFFF',
                pointBorderWidth: 2,
                fill: false
            });
        }
    }

    // Render chart
    const ctx = document.getElementById('weeklyChart');
    if (weeklyChart) {
        weeklyChart.destroy();
    }

    const labels = weekDays.map(date => {
        const d = new Date(date);
        return d.toLocaleDateString('en-US', { weekday: 'short' });
    });

    weeklyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#1F2937',
                    titleColor: '#FFFFFF',
                    bodyColor: '#FFFFFF',
                    borderColor: '#374151',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: true,
                    boxWidth: 12,
                    boxHeight: 12,
                    usePointStyle: true,
                    titleFont: {
                        family: 'Inter',
                        size: 14,
                        weight: '600'
                    },
                    bodyFont: {
                        family: 'Inter',
                        size: 13
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#F3F4F6',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#6B7280',
                        font: {
                            family: 'Inter',
                            size: 11
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#6B7280',
                        font: {
                            family: 'Inter',
                            size: 11,
                            weight: '500'
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });

    // Populate dropdown with all activities
    const selectElement = document.getElementById('activityChartSelect');
    if (selectElement) {
        selectElement.innerHTML = '';
        Object.keys(activityData).forEach(activityName => {
            const option = document.createElement('option');
            option.value = activityName;
            option.textContent = activityName;
            if (activityName === selectedActivity) {
                option.selected = true;
            }
            selectElement.appendChild(option);
        });

        // Add change listener to reload chart (remove old listener first)
        selectElement.onchange = () => loadWeeklyChart(weekStart);
    }

    // Populate compare against dropdown
    const compareSelect = document.getElementById('compareAgainstSelect');
    if (compareSelect) {
        // Save current selection
        const currentSelection = compareSelect.value;
        
        // Clear and rebuild
        compareSelect.innerHTML = '<option value="">Compare Against: None</option>';
        
        const { data: participants } = await supabaseClient
            .from('participants')
            .select('id, name, nick_name')
            .eq('active', true)
            .neq('id', currentUser.id)
            .order('name');

        if (participants) {
            participants.forEach(participant => {
                const option = document.createElement('option');
                option.value = participant.id;
                option.textContent = participant.nick_name || participant.name;
                compareSelect.appendChild(option);
            });
        }
        
        // Restore selection if still valid
        if (currentSelection && compareParticipantId) {
            compareSelect.value = compareParticipantId;
        }
    }
}

async function loadRecentActivity() {
    const { data, error } = await supabaseClient
        .from('activity_logs')
        .select(`
            *,
            participants (name, nick_name),
            activities (name)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error loading recent activity:', error);
        return;
    }

    const feed = document.getElementById('recentActivityFeed');
    feed.innerHTML = '';

    if (data.length === 0) {
        feed.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--gray-500);">No recent activity</p>';
        return;
    }

    data.forEach(log => {
        const item = document.createElement('div');
        item.className = 'activity-item';
        
        let valueDisplay = log.value;
        if (log.activities.name === 'Walking') {
            valueDisplay = `${log.value.toLocaleString()} steps`;
        } else if (['Reading', 'Writing'].includes(log.activities.name)) {
            valueDisplay = `${log.value} pages`;
        } else {
            valueDisplay = 'completed';
        }
        
        const timeAgo = getTimeAgo(new Date(log.created_at));
        
        item.innerHTML = `
            <div class="activity-item-icon">
                ${activityIcons[log.activities.name] || ''}
            </div>
            <div class="activity-item-content">
                <div class="activity-item-text">
                    <strong>${log.participants.nick_name || log.participants.name}</strong> logged ${log.activities.name}: ${valueDisplay}
                </div>
                <div class="activity-item-time">${timeAgo}</div>
            </div>
        `;
        
        feed.appendChild(item);
    });
}

// ============================================
// LEADERBOARD
// ============================================
async function loadLeaderboard() {
    document.getElementById('leaderboardWeekDisplay').textContent = getWeekDisplay(currentLeaderboardWeek);
    
    const today = getWeekStart(new Date());
    document.getElementById('nextWeekBtn').disabled = currentLeaderboardWeek >= today;

    await calculateWeekScores(currentLeaderboardWeek);

    const { data: scores, error } = await supabaseClient
        .from('weekly_scores')
        .select(`
            *,
            participants (name, nick_name, photo)
        `)
        .eq('week_start_date', currentLeaderboardWeek)
        .order('participants(name)', { ascending: true });

    if (error) {
        console.error('Error loading leaderboard:', error);
        return;
    }

    renderLeaderboardChart(scores);
    renderLeaderboardList(scores);
}

function renderLeaderboardChart(scores) {
    const ctx = document.getElementById('leaderboardChart');
    
    if (leaderboardChart) {
        leaderboardChart.destroy();
    }

    if (scores.length === 0) {
        ctx.parentElement.innerHTML = '<p style="text-align: center; padding: 3rem; color: var(--gray-500);">No data available</p>';
        return;
    }

    // Create labels array with empty slots at start and end
    const labels = ['', ...scores.map(s => s.participants.nick_name || s.participants.name), ''];
    
    // Create points array with null values at start and end
    const points = [null, ...scores.map(s => s.total_points), null];
    
    // Prepare images for point styles
    const pointImages = [null, ...scores.map(s => {
        const img = new Image(40, 40);
        img.src = s.participants.photo || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ddd"%3E%3Cpath d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/%3E%3C/svg%3E';
        return img;
    }), null];

    leaderboardChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Points',
                data: points,
                pointStyle: pointImages,
                pointRadius: 20,
                pointHoverRadius: 25,
                borderColor: '#0EA5E9',
                backgroundColor: '#0EA5E9',
                borderWidth: 0,
                tension: 0,
                showLine: false // Don't connect the points with lines
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#1F2937',
                    titleColor: '#FFFFFF',
                    bodyColor: '#FFFFFF',
                    borderColor: '#374151',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    titleFont: {
                        family: 'Inter',
                        size: 14,
                        weight: '600'
                    },
                    bodyFont: {
                        family: 'Inter',
                        size: 13
                    },
                    callbacks: {
                        title: function(context) {
                            // Skip first and last (empty) entries
                            if (context[0].dataIndex === 0 || context[0].dataIndex === scores.length + 1) {
                                return '';
                            }
                            const scoreIndex = context[0].dataIndex - 1; // Adjust for offset
                            return scores[scoreIndex].participants.name;
                        },
                        label: function(context) {
                            // Skip first and last (empty) entries
                            if (context.dataIndex === 0 || context.dataIndex === scores.length + 1) {
                                return '';
                            }
                            return `Points: ${context.parsed.y.toFixed(1)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: '#F3F4F6',
                        drawBorder: false
                    },
                    ticks: {
                        color: '#6B7280',
                        font: {
                            family: 'Inter',
                            size: 11
                        }
                    }
                },
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        color: '#6B7280',
                        font: {
                            family: 'Inter',
                            size: 11,
                            weight: '500'
                        }
                    }
                }
            }
        }
    });
}

function renderLeaderboardList(scores) {
    const list = document.getElementById('leaderboardList');
    list.innerHTML = '';

    if (scores.length === 0) {
        list.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--gray-500);">No scores yet for this week</p>';
        return;
    }

    scores.forEach((score, index) => {
        const item = document.createElement('div');
        item.className = `leaderboard-item rank-${index + 1}`;
        
        const photoUrl = score.participants.photo || 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23ddd"%3E%3Cpath d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/%3E%3C/svg%3E';
        
        item.innerHTML = `
            <div class="rank-badge">${index + 1}</div>
            <img src="${photoUrl}" alt="${score.participants.name}" class="participant-avatar" 
                 onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' viewBox=\\'0 0 24 24\\' fill=\\'%23ddd\\'%3E%3Cpath d=\\'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z\\'/%3E%3C/svg%3E'">
            <div class="participant-details" style="flex: 1;">
                <div class="participant-name">${score.participants.name}</div>
                <div class="participant-stats">
                    ${score.activities_completed}/7 activities • ${score.bonus_points > 0 ? `+${score.bonus_points} bonus` : 'No bonus'}
                </div>
                <button class="toggle-breakdown-btn" onclick="toggleBreakdown(${score.participant_id}, '${currentLeaderboardWeek}', this)">
                    View Breakdown
                </button>
                <div class="activity-breakdown" id="breakdown-${score.participant_id}">
                    <div class="breakdown-title">Activity Points Breakdown</div>
                    <div class="breakdown-items" id="breakdown-items-${score.participant_id}">
                        Loading...
                    </div>
                </div>
            </div>
            <div class="participant-score">${score.total_points.toFixed(1)}</div>
        `;
        
        list.appendChild(item);
    });
}

async function toggleBreakdown(participantId, weekStart, button) {
    const breakdownDiv = document.getElementById(`breakdown-${participantId}`);
    const itemsDiv = document.getElementById(`breakdown-items-${participantId}`);
    
    if (breakdownDiv.classList.contains('show')) {
        breakdownDiv.classList.remove('show');
        button.textContent = 'View Breakdown';
        return;
    }
    
    // Load breakdown data
    const { data: logs, error } = await supabaseClient
        .from('activity_logs')
        .select(`
            *,
            activities (name, activity_type, min_threshold, min_points, increment_threshold, increment_points, max_points)
        `)
        .eq('participant_id', participantId)
        .eq('week_start_date', weekStart);
    
    if (error) {
        console.error('Error loading breakdown:', error);
        itemsDiv.innerHTML = '<p style="color: var(--error);">Error loading data</p>';
        breakdownDiv.classList.add('show');
        return;
    }
    
    // Calculate points per activity
    const activityPoints = {};
    
    logs.forEach(log => {
        const activity = log.activities;
        if (!activityPoints[activity.name]) {
            activityPoints[activity.name] = { points: 0, value: 0, type: activity.activity_type };
        }
        
        if (activity.activity_type === 'accumulative') {
            activityPoints[activity.name].value += parseFloat(log.value);
        } else {
            activityPoints[activity.name].value += 1;
        }
    });
    
    // Calculate points based on thresholds
    Object.keys(activityPoints).forEach(activityName => {
        const activityData = activityPoints[activityName];
        const activity = logs.find(l => l.activities.name === activityName).activities;
        
        if (activity.activity_type === 'accumulative') {
            const value = activityData.value;
            if (value >= activity.min_threshold) {
                activityData.points = activity.min_points;
                const extraValue = value - activity.min_threshold;
                const increments = Math.floor(extraValue / activity.increment_threshold);
                activityData.points += increments * activity.increment_points;
                activityData.points = Math.min(activityData.points, activity.max_points);
            }
        } else {
            // Daily boolean
            const daysCompleted = activityData.value;
            if (daysCompleted >= activity.min_threshold) {
                activityData.points = activity.min_points;
                const extraDays = daysCompleted - activity.min_threshold;
                activityData.points += extraDays * activity.increment_points;
                activityData.points = Math.min(activityData.points, activity.max_points);
            }
        }
    });
    
    // Render breakdown
    itemsDiv.innerHTML = '';
    let totalPoints = 0;
    
    Object.keys(activityPoints).forEach(activityName => {
        const data = activityPoints[activityName];
        totalPoints += data.points;
        
        const item = document.createElement('div');
        item.className = 'breakdown-item';
        
        let valueDisplay = '';
        if (data.type === 'accumulative') {
            if (activityName === 'Walking') {
                valueDisplay = `${data.value.toLocaleString()} steps`;
            } else {
                valueDisplay = `${data.value} pages`;
            }
        } else {
            valueDisplay = `${data.value} days`;
        }
        
        item.innerHTML = `
            <span class="breakdown-activity">${activityName}: ${valueDisplay}</span>
            <span class="breakdown-points">${data.points.toFixed(1)} pts</span>
        `;
        itemsDiv.appendChild(item);
    });
    
    // Add bonus if any
    const { data: scoreData } = await supabaseClient
        .from('weekly_scores')
        .select('bonus_points')
        .eq('participant_id', participantId)
        .eq('week_start_date', weekStart)
        .single();
    
    if (scoreData && scoreData.bonus_points > 0) {
        const bonusItem = document.createElement('div');
        bonusItem.className = 'breakdown-item';
        bonusItem.innerHTML = `
            <span class="breakdown-activity">All Activities Bonus</span>
            <span class="breakdown-points" style="color: var(--success);">+${scoreData.bonus_points} pts</span>
        `;
        itemsDiv.appendChild(bonusItem);
        totalPoints += scoreData.bonus_points;
    }
    
    // Add total
    const totalItem = document.createElement('div');
    totalItem.className = 'breakdown-item';
    totalItem.style.borderTop = '2px solid var(--gray-300)';
    totalItem.style.marginTop = '0.5rem';
    totalItem.style.paddingTop = '0.75rem';
    totalItem.innerHTML = `
        <span class="breakdown-activity" style="font-weight: 600;">Total</span>
        <span class="breakdown-points" style="font-size: 1.125rem; font-weight: 700;">${totalPoints.toFixed(1)} pts</span>
    `;
    itemsDiv.appendChild(totalItem);
    
    breakdownDiv.classList.add('show');
    button.textContent = 'Hide Breakdown';
}

async function calculateWeekScores(weekStart) {
    const { data: existing } = await supabaseClient
        .from('weekly_scores')
        .select('id')
        .eq('week_start_date', weekStart)
        .limit(1);

    const today = getWeekStart(new Date());
    if (!existing || existing.length === 0 || weekStart === today) {
        const { error } = await supabaseClient.rpc('calculate_weekly_scores', {
            p_week_start_date: weekStart
        });

        if (error) {
            console.error('Error calculating scores:', error);
        }
    }
}

async function changeWeek(direction) {
    const currentDate = new Date(currentLeaderboardWeek);
    currentDate.setDate(currentDate.getDate() + (direction * 7));
    currentLeaderboardWeek = getWeekStart(currentDate);
    
    await loadLeaderboard();
}

// ============================================
// LOG MODAL
// ============================================
function setTodayDate() {
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('logDate');
    if (dateInput) {
        dateInput.value = today;
        dateInput.max = today;
    }
}

async function openLogModal() {
    const modal = document.getElementById('logModal');
    modal.classList.add('active');
    
    setTodayDate();
    selectedActivity = null;
    selectedDate = document.getElementById('logDate').value;
    
    await renderActivityIcons();
    
    document.getElementById('activityForm').style.display = 'none';
}

function closeLogModal(event) {
    if (event && event.target !== event.currentTarget) return;
    
    const modal = document.getElementById('logModal');
    modal.classList.remove('active');
    selectedActivity = null;
}

async function renderActivityIcons() {
    const grid = document.getElementById('activityIconGrid');
    grid.innerHTML = '';
    
    const selectedDate = document.getElementById('logDate').value;
    
    // Get logged activities for selected date
    const { data: logs } = await supabaseClient
        .from('activity_logs')
        .select('activity_id')
        .eq('participant_id', currentUser.id)
        .eq('log_date', selectedDate);
    
    loggedActivitiesForDate = logs ? logs.map(l => l.activity_id) : [];
    
    activities.forEach(activity => {
        const isLogged = loggedActivitiesForDate.includes(activity.id);
        const isBoolean = activity.activity_type === 'daily_boolean';
        
        const button = document.createElement('button');
        button.className = 'activity-icon-btn';
        button.type = 'button';
        
        if (isLogged && isBoolean) {
            button.classList.add('completed');
        } else if (isLogged && !isBoolean) {
            // Accumulative activities can be logged multiple times
        }
        
        button.innerHTML = `
            ${activityIcons[activity.name] || ''}
            <span>${activity.name}</span>
            ${isLogged && isBoolean ? `
                <div class="activity-check">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                </div>
            ` : ''}
        `;
        
        button.onclick = () => selectActivity(activity, isLogged && isBoolean);
        
        grid.appendChild(button);
    });
}

function selectActivity(activity, isCompleted) {
    if (isCompleted) {
        showToast('Already logged for this date');
        return;
    }
    
    selectedActivity = activity;
    
    // Update selected state
    document.querySelectorAll('.activity-icon-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    event.currentTarget.classList.add('selected');
    
    // Show form
    const form = document.getElementById('activityForm');
    const display = document.getElementById('selectedActivityDisplay');
    const inputArea = document.getElementById('activityInputArea');
    
    display.innerHTML = `
        ${activityIcons[activity.name] || ''}
        <span class="selected-activity-name">${activity.name}</span>
    `;
    
    if (activity.activity_type === 'accumulative') {
        let unit = activity.name === 'Walking' ? 'steps' : 'pages';
        let placeholder = activity.name === 'Walking' ? 'e.g., 10000' : 'e.g., 20';
        
        inputArea.innerHTML = `
            <div class="activity-input-group">
                <label for="activityValue" class="input-label">Enter ${unit}</label>
                <input type="number" id="activityValue" class="activity-input" 
                       placeholder="${placeholder}" min="1" required>
                <div class="input-hint">Enter the number of ${unit} you want to log</div>
            </div>
        `;
    } else {
        inputArea.innerHTML = `
            <div class="activity-input-group">
                <p style="color: var(--gray-600); font-size: 0.875rem;">
                    ${getActivityDescription(activity.name)}
                </p>
            </div>
        `;
    }
    
    form.style.display = 'block';
}

function getActivityDescription(activityName) {
    const descriptions = {
        'Meditation': 'Mark this activity as completed for the selected date.',
        'Water': 'Did you drink 2.5L of water?',
        'Screen Time': 'Were you under your screen time limit?',
        'Sleep': 'Did you sleep in the correct window (9-10pm to 4:30-5:30am)?'
    };
    return descriptions[activityName] || 'Mark this activity as completed.';
}

async function submitActivity() {
    if (!selectedActivity) {
        alert('Please select an activity');
        return;
    }
    
    const logDate = document.getElementById('logDate').value;
    const weekStart = getWeekStart(new Date(logDate));
    let value;
    
    if (selectedActivity.activity_type === 'accumulative') {
        const input = document.getElementById('activityValue');
        value = parseFloat(input.value);
        
        if (!value || value <= 0) {
            alert('Please enter a valid number');
            return;
        }
    } else {
        value = 1;
    }
    
    const { data, error } = await supabaseClient
        .from('activity_logs')
        .insert({
            participant_id: currentUser.id,
            activity_id: selectedActivity.id,
            log_date: logDate,
            value: value,
            week_start_date: weekStart
        });
    
    if (error) {
        if (error.code === '23505') {
            alert('You already logged this activity for this date!');
        } else {
            console.error('Error logging activity:', error);
            alert('Error logging activity. Please try again.');
        }
        return;
    }
    
    showToast(`${selectedActivity.name} logged successfully!`);
    closeLogModal();
    
    // Refresh dashboard if we're on current week
    if (weekStart === getWeekStart(new Date())) {
        await loadDashboard();
    }
}

// Date change handler
document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('logDate');
    if (dateInput) {
        dateInput.addEventListener('change', renderActivityIcons);
    }
});

// ============================================
// START APPLICATION
// ============================================
init();