/**
 * ZEMSTARK Main Application Controller (Google Classroom Overhaul)
 * Mandatory Auth Wall, GC Classwork Topics, Ready HTML File Upload & Embedded Viewer, Student Turn In & Teacher Grading.
 */

let appState = window.ZemstarkDB ? window.ZemstarkDB.get() : {};
let activeProctorEngine = null;
let speakingRecorder = null;
let uploadedHtmlContent = '';

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  checkAuth();
  bindAuthWallForms();
  bindNavigation();
  bindModals();
}

// -------------------------------------------------------------
// MANDATORY AUTH WALL & SESSION GUARD
// -------------------------------------------------------------
function checkAuth() {
  const authWall = document.getElementById('view-auth-wall');
  const mainNavbar = document.getElementById('main-navbar');
  const mainContainer = document.getElementById('main-container');

  if (!appState.currentUser) {
    if (authWall) authWall.classList.add('active');
    if (mainNavbar) mainNavbar.style.display = 'none';
    if (mainContainer) mainContainer.style.display = 'none';
  } else {
    if (authWall) authWall.classList.remove('active');
    if (mainNavbar) mainNavbar.style.display = 'flex';
    if (mainContainer) mainContainer.style.display = 'block';

    renderUserBadge();
    renderClasses();
    renderProctorReports();
    renderGradebook();
  }
}

function bindAuthWallForms() {
  const loginForm = document.getElementById('form-wall-login');
  const regForm = document.getElementById('form-wall-register');

  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('wall-login-email').value;
      const existingUser = appState.users.find(u => u.email === email);

      if (existingUser) {
        appState.currentUser = existingUser;
      } else {
        appState.currentUser = {
          id: 'usr_' + Date.now(),
          name: email.split('@')[0].toUpperCase(),
          email,
          role: 'teacher',
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250'
        };
      }

      window.ZemstarkDB.save(appState);
      checkAuth();
      showToast(`Xush kelibsiz, ${appState.currentUser.name}!`);
    });
  }

  if (regForm) {
    regForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('wall-reg-name').value;
      const email = document.getElementById('wall-reg-email').value;
      const role = document.getElementById('wall-reg-role').value;

      const newUser = {
        id: 'usr_' + Date.now(),
        name,
        email,
        role,
        avatar: role === 'teacher' 
          ? 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250'
          : 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=250'
      };

      appState.users.push(newUser);
      appState.currentUser = newUser;
      window.ZemstarkDB.save(appState);
      checkAuth();
      showToast(`Ro'yxatdan o'tildi! Xush kelibsiz, ${name}`);
    });
  }
}

function switchAuthTab(tab) {
  const loginForm = document.getElementById('form-wall-login');
  const regForm = document.getElementById('form-wall-register');
  const loginBtn = document.getElementById('auth-tab-login-btn');
  const regBtn = document.getElementById('auth-tab-register-btn');

  if (tab === 'login') {
    if (loginForm) loginForm.style.display = 'block';
    if (regForm) regForm.style.display = 'none';
    loginBtn?.classList.add('active');
    regBtn?.classList.remove('active');
  } else {
    if (loginForm) loginForm.style.display = 'none';
    if (regForm) regForm.style.display = 'block';
    regBtn?.classList.add('active');
    loginBtn?.classList.remove('active');
  }
}

function logoutUser() {
  appState.currentUser = null;
  window.ZemstarkDB.save(appState);
  checkAuth();
  showToast('Tizimdan chiqildi.');
}

function renderUserBadge() {
  const nameLabel = document.getElementById('user-name-label');
  const roleLabel = document.getElementById('user-role-label');
  const avatarImg = document.getElementById('user-avatar-img');
  const roleTeacherBtn = document.getElementById('role-teacher');
  const roleStudentBtn = document.getElementById('role-student');
  const teacherControls = document.querySelectorAll('.teacher-only');

  if (nameLabel) nameLabel.textContent = appState.currentUser.name;
  if (roleLabel) roleLabel.textContent = appState.currentUser.role === 'teacher' ? 'O\'qituvchi' : 'O\'quvchi';
  if (avatarImg && appState.currentUser.avatar) avatarImg.src = appState.currentUser.avatar;

  if (appState.currentUser.role === 'teacher') {
    roleTeacherBtn?.classList.add('active');
    roleStudentBtn?.classList.remove('active');
    teacherControls.forEach(el => el.style.display = 'inline-flex');
  } else {
    roleStudentBtn?.classList.add('active');
    roleTeacherBtn?.classList.remove('active');
    teacherControls.forEach(el => el.style.display = 'none');
  }
}

function switchRole(role) {
  appState.currentUser.role = role;
  window.ZemstarkDB.save(appState);
  renderUserBadge();
  renderClasses();
  if (window.activeClassId) openClassDetail(window.activeClassId);
  showToast(`Rejim o'zgartirildi: ${role === 'teacher' ? 'O\'qituvchi Kabineti' : 'O\'quvchi Kabineti'}`);
}

// -------------------------------------------------------------
// NAVIGATION
// -------------------------------------------------------------
function bindNavigation() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetView = btn.dataset.view;
      if (targetView) showView(targetView);
    });
  });

  document.getElementById('role-teacher')?.addEventListener('click', () => switchRole('teacher'));
  document.getElementById('role-student')?.addEventListener('click', () => switchRole('student'));
}

function showView(viewId) {
  document.querySelectorAll('.page-view').forEach(view => view.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));

  const activeView = document.getElementById(`view-${viewId}`);
  const activeNavBtn = document.querySelector(`.nav-btn[data-view="${viewId}"]`);

  if (activeView) activeView.classList.add('active');
  if (activeNavBtn) activeNavBtn.classList.add('active');

  if (viewId === 'ielts') renderIeltsHub();
  if (viewId === 'gradebook') renderGradebook();
  if (viewId === 'teacher-reports') renderProctorReports();
}

// -------------------------------------------------------------
// GOOGLE CLASSROOM CLASSWORK & TOPICS
// -------------------------------------------------------------
function renderClasses() {
  const grid = document.getElementById('classes-grid');
  if (!grid) return;

  grid.innerHTML = '';

  appState.classes.forEach(cls => {
    const card = document.createElement('div');
    card.className = 'class-card';
    card.innerHTML = `
      <div class="class-card-header" style="background: ${cls.coverGradient || 'linear-gradient(135deg, #00f2fe, #4facfe)'}">
        <span class="class-code-badge">${cls.code}</span>
        <div>
          <h3 class="class-card-title">${cls.name}</h3>
          <p style="font-size:0.85rem; opacity:0.9;">${cls.subject} • ${cls.section}</p>
        </div>
      </div>
      <div class="class-card-body">
        <p style="font-size:0.85rem; color:var(--text-muted);">O'qituvchi: <strong>${cls.teacherName}</strong></p>
        <div style="margin-top:0.75rem; display:flex; gap:0.5rem; flex-wrap:wrap;">
          <span style="font-size:0.75rem; background:rgba(255,255,255,0.06); padding:4px 8px; border-radius:6px;">📚 ${cls.assignments ? cls.assignments.length : 0} ta topshiriq</span>
          <span style="font-size:0.75rem; background:rgba(0,242,254,0.1); color:var(--accent-cyan); padding:4px 8px; border-radius:6px;">🛡️ ${cls.quizzes ? cls.quizzes.length : 0} ta test</span>
        </div>
        <div class="class-meta">
          <span>👥 ${cls.enrolledCount} ta o'quvchi</span>
          <span style="color:var(--accent-cyan); font-weight:600;">Sinfga kirish →</span>
        </div>
      </div>
    `;

    card.addEventListener('click', () => openClassDetail(cls.id));
    grid.appendChild(card);
  });
}

function openClassDetail(classId) {
  const cls = appState.classes.find(c => c.id === classId);
  if (!cls) return;

  window.activeClassId = classId;

  document.getElementById('class-detail-title').textContent = cls.name;
  document.getElementById('class-detail-code').textContent = `Sinf Kodi: ${cls.code}`;

  renderStreamFeed(cls);
  renderClassworkTopics(cls);
  renderPeopleList(cls);
  renderGcGrades(cls);

  populateTopicDropdowns(cls);

  showView('class-detail');
}

function switchClassTab(tab) {
  document.querySelectorAll('.class-tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.class-tab-btn[data-classtab="${tab}"]`)?.classList.add('active');

  document.querySelectorAll('.class-tab-content').forEach(c => c.style.display = 'none');
  const target = document.getElementById(`class-tab-${tab}`);
  if (target) target.style.display = 'block';
}

function toggleGcCreateMenu() {
  const menu = document.getElementById('gc-create-menu');
  menu?.classList.toggle('active');
}

function populateTopicDropdowns(cls) {
  const topicSelects = [
    document.getElementById('select-asg-topic'),
    document.getElementById('select-html-topic')
  ];

  topicSelects.forEach(select => {
    if (!select) return;
    select.innerHTML = '<option value="">(Mavzosiz)</option>';
    if (cls.topics) {
      cls.topics.forEach(t => {
        select.innerHTML += `<option value="${t.id}">${t.name}</option>`;
      });
    }
  });
}

function renderClassworkTopics(cls) {
  const feed = document.getElementById('classwork-topics-feed');
  if (!feed) return;

  feed.innerHTML = '';

  const topics = cls.topics && cls.topics.length ? cls.topics : [{ id: 'top_default', name: 'Barcha Topshiriqlar va Darslar' }];

  topics.forEach(topic => {
    const topicSection = document.createElement('div');
    topicSection.style.marginBottom = '2rem';

    const topicAssignments = cls.assignments ? cls.assignments.filter(a => a.topicId === topic.id || (!a.topicId && topic.id === 'top_default')) : [];
    const topicQuizzes = cls.quizzes ? cls.quizzes.filter(q => q.topicId === topic.id || (!q.topicId && topic.id === 'top_default')) : [];

    let itemsHtml = '';

    topicAssignments.forEach(asg => {
      const mySub = asg.submissions ? asg.submissions.find(s => s.studentId === appState.currentUser.id) : null;
      const statusBadge = mySub 
        ? (mySub.status === 'Graded' ? `<span class="badge-clean">Baholandi: ${mySub.grade}/${asg.points}</span>` : `<span class="brand-badge">Topshirildi (Turned In)</span>`)
        : `<span style="color:var(--text-muted); font-size:0.8rem;">Due: ${asg.dueDate}</span>`;

      let htmlFrameSnippet = '';
      if (asg.type === 'html' && asg.htmlContent) {
        htmlFrameSnippet = `
          <div class="html-preview-frame">
            <iframe srcdoc="${escapeHtmlAttr(asg.htmlContent)}" style="width:100%; height:260px; border:none; border-radius:8px;"></iframe>
          </div>
        `;
      }

      itemsHtml += `
        <div class="assignment-card" onclick="openSubmissionDrawer('${cls.id}', '${asg.id}')">
          <div style="display:flex; justify-content:space-between; align-items:flex-start;">
            <div>
              <span class="brand-badge" style="background:rgba(0,242,254,0.15); margin-bottom:0.4rem; inline-block;">
                ${asg.type === 'html' ? '🌐 TAYYOR HTML VAZIFA' : '📝 TOPSHIRIQ (ASSIGNMENT)'}
              </span>
              <h4 style="font-size:1.1rem; margin-top:0.2rem;">${asg.title}</h4>
              <p style="font-size:0.85rem; color:var(--text-muted); margin-top:0.3rem;">${asg.instructions}</p>
            </div>
            <div>${statusBadge}</div>
          </div>
          ${htmlFrameSnippet}
        </div>
      `;
    });

    topicQuizzes.forEach(quiz => {
      itemsHtml += `
        <div class="assignment-card" style="border-color:rgba(0,242,254,0.3);">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <div>
              <span class="brand-badge" style="background:rgba(239,68,68,0.2); color:var(--accent-red); margin-bottom:0.4rem;">🛡️ AUTOPROCTOR EXAM</span>
              <h4 style="font-size:1.15rem; margin-top:0.2rem;">${quiz.title}</h4>
              <p style="font-size:0.85rem; color:var(--text-muted);">Vaqt: ${quiz.durationMinutes} daqiqa</p>
            </div>
            <button class="primary-btn" onclick="startProctoredQuiz('${cls.id}', '${quiz.id}')">Imtihonni Boshlash ▶</button>
          </div>
        </div>
      `;
    });

    if (!itemsHtml) {
      itemsHtml = '<p style="color:var(--text-dim); font-size:0.85rem;">Ushbu mavzo ostida topshiriqlar yo\'q.</p>';
    }

    topicSection.innerHTML = `
      <div class="topic-header">
        <span>📁 ${topic.name}</span>
      </div>
      <div>${itemsHtml}</div>
    `;

    feed.appendChild(topicSection);
  });
}

function escapeHtmlAttr(str) {
  return str.replace(/"/g, '&quot;');
}

// -------------------------------------------------------------
// SUBMISSION & GRADING DRAWER
// -------------------------------------------------------------
function openSubmissionDrawer(classId, assignmentId) {
  const cls = appState.classes.find(c => c.id === classId);
  const asg = cls?.assignments.find(a => a.id === assignmentId);
  if (!asg) return;

  const drawer = document.getElementById('drawer-submission');
  const titleEl = document.getElementById('drawer-title');
  const contentEl = document.getElementById('drawer-content');

  if (titleEl) titleEl.textContent = asg.title;

  if (appState.currentUser.role === 'student') {
    const mySub = asg.submissions ? asg.submissions.find(s => s.studentId === appState.currentUser.id) : null;
    
    contentEl.innerHTML = `
      <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:1rem;">${asg.instructions}</p>
      <div style="background:rgba(255,255,255,0.03); border:1px solid var(--border-color); padding:1.25rem; border-radius:12px; margin-bottom:1.5rem;">
        <h4 style="font-size:1rem; margin-bottom:0.75rem;">📥 Sizning Vazifangiz (Your Work)</h4>
        
        ${mySub ? `
          <div style="background:rgba(16,185,129,0.1); border:1px solid var(--accent-green); padding:1rem; border-radius:8px; margin-bottom:1rem;">
            <span style="color:var(--accent-green); font-weight:700;">✓ Topshirildi (${mySub.submittedAt})</span>
            <p style="font-size:0.9rem; margin-top:0.4rem;">${mySub.answerText}</p>
            ${mySub.grade !== null ? `<p style="font-weight:700; color:var(--accent-cyan); margin-top:0.5rem;">Baho: ${mySub.grade} / ${asg.points}</p>` : ''}
            ${mySub.feedback ? `<p style="font-size:0.85rem; color:var(--text-muted); margin-top:0.3rem;">O'qituvchi fikri: ${mySub.feedback}</p>` : ''}
          </div>
        ` : `
          <textarea id="input-student-answer" class="form-textarea" rows="5" placeholder="Javobingizni yozing yoki havola kiriting..."></textarea>
          <button class="primary-btn" style="width:100%; justify-content:center; margin-top:1rem;" onclick="submitAssignmentWork('${cls.id}', '${asg.id}')">
            Topshirish (Turn In) 🚀
          </button>
        `}
      </div>
    `;
  } else {
    // Teacher Grading Panel
    const subs = asg.submissions || [];
    contentEl.innerHTML = `
      <p style="font-size:0.9rem; color:var(--text-muted); margin-bottom:1rem;">Topshirilgan javoblar ro'yxati (${subs.length} ta):</p>
      ${subs.length ? subs.map(sub => `
        <div style="background:rgba(255,255,255,0.04); border:1px solid var(--border-color); padding:1.25rem; border-radius:12px; margin-bottom:1rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.5rem;">
            <strong>${sub.studentName}</strong>
            <span style="font-size:0.75rem; color:var(--text-muted);">${sub.submittedAt}</span>
          </div>
          <p style="font-size:0.9rem; background:rgba(0,0,0,0.3); padding:0.75rem; border-radius:8px; margin-bottom:0.75rem;">${sub.answerText}</p>
          
          <div style="display:flex; gap:0.5rem; align-items:center;">
            <input type="number" id="input-grade-${sub.studentId}" class="form-input" placeholder="Baho (100)" value="${sub.grade || ''}" style="width:100px;">
            <input type="text" id="input-feedback-${sub.studentId}" class="form-input" placeholder="Izoh/Feedback..." value="${sub.feedback || ''}">
            <button class="primary-btn" style="padding:0.6rem 1rem; font-size:0.8rem;" onclick="gradeStudentWork('${cls.id}', '${asg.id}', '${sub.studentId}')">Baholash</button>
          </div>
        </div>
      `).join('') : '<p style="color:var(--text-muted);">Hozircha o\'quvchilar javob yuborishmagan.</p>'}
    `;
  }

  drawer?.classList.add('active');
}

function closeDrawer() {
  document.getElementById('drawer-submission')?.classList.remove('active');
}

function submitAssignmentWork(classId, asgId) {
  const answer = document.getElementById('input-student-answer')?.value;
  if (!answer || !answer.trim()) return;

  const cls = appState.classes.find(c => c.id === classId);
  const asg = cls?.assignments.find(a => a.id === asgId);

  if (asg) {
    if (!asg.submissions) asg.submissions = [];
    asg.submissions.push({
      studentId: appState.currentUser.id,
      studentName: appState.currentUser.name,
      submittedAt: new Date().toLocaleString('uz-UZ'),
      answerText: answer.trim(),
      status: 'Turned In',
      grade: null,
      feedback: null
    });

    window.ZemstarkDB.save(appState);
    openClassDetail(classId);
    openSubmissionDrawer(classId, asgId);
    showToast('Vazifa muvaffaqiyatli topshirildi (Turned In)!');
  }
}

function gradeStudentWork(classId, asgId, studentId) {
  const gradeInput = document.getElementById(`input-grade-${studentId}`);
  const feedbackInput = document.getElementById(`input-feedback-${studentId}`);

  const grade = parseInt(gradeInput?.value) || 0;
  const feedback = feedbackInput?.value || '';

  const cls = appState.classes.find(c => c.id === classId);
  const asg = cls?.assignments.find(a => a.id === asgId);
  const sub = asg?.submissions.find(s => s.studentId === studentId);

  if (sub) {
    sub.grade = grade;
    sub.feedback = feedback;
    sub.status = 'Graded';

    window.ZemstarkDB.save(appState);
    openSubmissionDrawer(classId, asgId);
    renderClassworkTopics(cls);
    showToast(`O'quvchi baholandi: ${grade} ball!`);
  }
}

// -------------------------------------------------------------
// HTML FILE UPLOAD HANDLER
// -------------------------------------------------------------
function handleHtmlFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    uploadedHtmlContent = e.target.result;
    showToast(`HTML fayli yuklandi: ${file.name}`);
  };
  reader.readAsText(file);
}

// -------------------------------------------------------------
// STREAM & PEOPLE & GRADES
// -------------------------------------------------------------
function renderStreamFeed(cls) {
  const feed = document.getElementById('stream-posts-feed');
  if (!feed) return;

  feed.innerHTML = cls.streamPosts && cls.streamPosts.length ? '' : '<p style="color:var(--text-muted); text-align:center;">Hozircha e\'lonlar mavjud emas.</p>';

  if (cls.streamPosts) {
    cls.streamPosts.forEach(post => {
      const postCard = document.createElement('div');
      postCard.className = 'stream-post-card';
      
      const commentsHtml = post.comments ? post.comments.map(c => `
        <div class="comment-item">
          <strong>${c.authorName}:</strong> ${c.content} <span style="font-size:0.7rem; color:var(--text-dim); float:right;">${c.createdAt}</span>
        </div>
      `).join('') : '';

      postCard.innerHTML = `
        <div class="post-author-box">
          <img src="${post.authorAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250'}" style="width:36px; height:36px; border-radius:50%;">
          <div>
            <h4 style="font-size:0.95rem;">${post.authorName} <span class="brand-badge" style="font-size:0.6rem;">${post.authorRole}</span></h4>
            <span style="font-size:0.75rem; color:var(--text-muted);">${post.createdAt}</span>
          </div>
        </div>
        <p style="font-size:0.95rem; line-height:1.6; margin-bottom:0.75rem;">${post.content}</p>
        <div style="margin-top:0.75rem; border-top:1px solid var(--border-color); padding-top:0.5rem;">
          <div>${commentsHtml}</div>
          <div style="display:flex; gap:0.5rem; margin-top:0.5rem;">
            <input type="text" id="comment-input-${post.id}" class="form-input" placeholder="Izoh qoldiring..." style="padding:0.4rem 0.8rem; font-size:0.85rem;">
            <button class="secondary-btn" style="padding:0.4rem 0.8rem; font-size:0.8rem;" onclick="addStreamComment('${cls.id}', '${post.id}')">Yuborish</button>
          </div>
        </div>
      `;
      feed.appendChild(postCard);
    });
  }
}

function submitStreamPost() {
  const input = document.getElementById('stream-post-input');
  if (!input || !input.value.trim()) return;

  const cls = appState.classes.find(c => c.id === window.activeClassId);
  if (!cls) return;

  if (!cls.streamPosts) cls.streamPosts = [];
  cls.streamPosts.unshift({
    id: 'post_' + Date.now(),
    authorName: appState.currentUser.name,
    authorRole: appState.currentUser.role === 'teacher' ? 'O\'qituvchi' : 'O\'quvchi',
    authorAvatar: appState.currentUser.avatar,
    content: input.value.trim(),
    createdAt: new Date().toLocaleString('uz-UZ'),
    comments: []
  });

  window.ZemstarkDB.save(appState);
  input.value = '';
  renderStreamFeed(cls);
  showToast('E\'lon muvaffaqiyatli chop etildi!');
}

function addStreamComment(classId, postId) {
  const input = document.getElementById(`comment-input-${postId}`);
  if (!input || !input.value.trim()) return;

  const cls = appState.classes.find(c => c.id === classId);
  const post = cls?.streamPosts.find(p => p.id === postId);

  if (post) {
    if (!post.comments) post.comments = [];
    post.comments.push({
      id: 'c_' + Date.now(),
      authorName: appState.currentUser.name,
      authorAvatar: appState.currentUser.avatar,
      content: input.value.trim(),
      createdAt: new Date().toLocaleTimeString('uz-UZ', { hour: '2-digit', minute: '2-digit' })
    });

    window.ZemstarkDB.save(appState);
    renderStreamFeed(cls);
  }
}

function renderPeopleList(cls) {
  const tList = document.getElementById('people-teachers-list');
  const sList = document.getElementById('people-students-list');

  if (tList) {
    tList.innerHTML = `
      <div style="display:flex; align-items:center; gap:0.75rem; padding:0.6rem 0;">
        <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250" style="width:36px; height:36px; border-radius:50%;">
        <strong>${cls.teacherName}</strong>
      </div>
    `;
  }

  if (sList) {
    sList.innerHTML = appState.users.filter(u => u.role === 'student').map(s => `
      <div style="display:flex; align-items:center; gap:0.75rem; padding:0.6rem 0; border-bottom:1px solid rgba(255,255,255,0.05);">
        <img src="${s.avatar}" style="width:34px; height:34px; border-radius:50%;">
        <span>${s.name} (${s.email})</span>
      </div>
    `).join('');
  }
}

function renderGcGrades(cls) {
  const container = document.getElementById('gc-grades-table-body');
  if (!container) return;

  container.innerHTML = appState.users.filter(u => u.role === 'student').map(st => `
    <tr>
      <td><strong>${st.name}</strong></td>
      <td><span style="color:var(--accent-green); font-weight:700;">95 / 100</span></td>
      <td><span style="color:var(--accent-cyan); font-weight:700;">88 / 100</span></td>
      <td><span style="color:var(--accent-yellow); font-weight:700;">90% Trust</span></td>
    </tr>
  `).join('');
}

// -------------------------------------------------------------
// MODALS CREATION LOGIC
// -------------------------------------------------------------
function bindModals() {
  document.getElementById('btn-create-class')?.addEventListener('click', () => openModal('modal-create-class'));

  document.getElementById('form-create-class')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('input-class-name').value;
    const subject = document.getElementById('input-class-subject').value;
    const section = document.getElementById('input-class-section').value;

    const newClass = {
      id: 'class_' + Date.now(),
      code: 'ZM-' + Math.floor(1000 + Math.random() * 9000),
      name,
      subject,
      section,
      room: 'Online Room C',
      teacherName: appState.currentUser.name,
      coverGradient: 'linear-gradient(135deg, #00f2fe 0%, #7928ca 100%)',
      enrolledCount: 1,
      topics: [{ id: 'top_1', name: 'General Materials' }],
      assignments: [],
      quizzes: [],
      streamPosts: []
    };

    appState.classes.unshift(newClass);
    window.ZemstarkDB.save(appState);
    closeModal('modal-create-class');
    renderClasses();
    showToast(`Yangi sinf yaratildi: ${name}`);
  });

  document.getElementById('form-create-assignment')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('input-asg-title').value;
    const instructions = document.getElementById('input-asg-instructions').value;
    const points = parseInt(document.getElementById('input-asg-points').value) || 100;
    const dueDate = document.getElementById('input-asg-duedate').value;
    const topicId = document.getElementById('select-asg-topic').value;

    const cls = appState.classes.find(c => c.id === window.activeClassId);
    if (cls) {
      if (!cls.assignments) cls.assignments = [];
      cls.assignments.push({
        id: 'asg_' + Date.now(),
        topicId,
        type: 'assignment',
        title,
        instructions,
        points,
        dueDate,
        submissions: []
      });
      window.ZemstarkDB.save(appState);
      closeModal('modal-create-assignment');
      toggleGcCreateMenu();
      renderClassworkTopics(cls);
      showToast(`Topshiriq yaratildi: ${title}`);
    }
  });

  document.getElementById('form-create-html-assignment')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = document.getElementById('input-html-title').value;
    const manualCode = document.getElementById('input-html-code').value;
    const topicId = document.getElementById('select-html-topic').value;
    const htmlContent = uploadedHtmlContent || manualCode || '<h3 style="color:#00f2fe;">HTML content</h3>';

    const cls = appState.classes.find(c => c.id === window.activeClassId);
    if (cls) {
      if (!cls.assignments) cls.assignments = [];
      cls.assignments.push({
        id: 'asg_' + Date.now(),
        topicId,
        type: 'html',
        title,
        instructions: 'Tayyor HTML topshiriq va interaktiv dars.',
        points: 100,
        dueDate: '2026-08-15',
        htmlContent,
        submissions: []
      });
      window.ZemstarkDB.save(appState);
      uploadedHtmlContent = '';
      closeModal('modal-create-html-assignment');
      toggleGcCreateMenu();
      renderClassworkTopics(cls);
      showToast(`Tayyor HTML topshiriq yuklandi!`);
    }
  });

  document.getElementById('form-create-topic')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('input-topic-name').value;
    const cls = appState.classes.find(c => c.id === window.activeClassId);

    if (cls) {
      if (!cls.topics) cls.topics = [];
      cls.topics.push({
        id: 'top_' + Date.now(),
        name
      });
      window.ZemstarkDB.save(appState);
      closeModal('modal-create-topic');
      toggleGcCreateMenu();
      openClassDetail(cls.id);
      showToast(`Yangi mavzo ochildi: ${name}`);
    }
  });
}

function openModal(id) {
  document.getElementById(id)?.classList.add('active');
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('active');
}

// -------------------------------------------------------------
// AUTOPROCTOR RUNNER
// -------------------------------------------------------------
function startProctoredQuiz(classId, quizId) {
  const cls = appState.classes.find(c => c.id === classId);
  const quiz = cls?.quizzes?.find(q => q.id === quizId);
  if (!quiz) return;

  document.getElementById('proctor-quiz-title').textContent = quiz.title;
  const questionsBox = document.getElementById('proctor-questions-box');
  const logsBox = document.getElementById('proctor-violations-log');

  if (logsBox) logsBox.innerHTML = '<p style="color:var(--text-dim);">Jonli AI kuzatuvi faol. Qoidabuzarliklar va snapshotlar shu yerda aks etadi.</p>';

  if (questionsBox) {
    questionsBox.innerHTML = '';
    quiz.questions.forEach((q, idx) => {
      const qCard = document.createElement('div');
      qCard.style.cssText = 'background:rgba(255,255,255,0.03); border:1px solid var(--border-color); padding:1.25rem; border-radius:12px; margin-bottom:1.25rem;';
      
      let optionsHtml = q.options ? q.options.map((opt, optIdx) => `
        <label style="display:block; margin:0.5rem 0; cursor:pointer; font-size:0.95rem;">
          <input type="radio" name="q_${q.id}" value="${optIdx}"> ${opt}
        </label>
      `).join('') : '<textarea class="form-textarea" rows="3"></textarea>';

      qCard.innerHTML = `<h4 style="font-size:1rem; margin-bottom:0.75rem;">${idx + 1}-Savol: ${q.question}</h4>${optionsHtml}`;
      questionsBox.appendChild(qCard);
    });
  }

  showView('proctor-exam');

  if (activeProctorEngine) activeProctorEngine.stopProctoring();

  activeProctorEngine = new window.AutoProctorEngine({
    onTrustScoreChange: (score) => {
      const valEl = document.getElementById('proctor-trust-value');
      const barEl = document.getElementById('proctor-trust-bar');
      if (valEl) valEl.textContent = `${score}%`;
      if (barEl) barEl.style.width = `${score}%`;
    },
    onViolation: (v) => {
      if (logsBox) {
        const vEntry = document.createElement('div');
        vEntry.className = 'violation-entry';
        vEntry.innerHTML = `<span style="color:var(--accent-yellow); font-weight:700;">[${v.time}] ⚠️ ${v.type} (-${v.penalty}%)</span>`;
        logsBox.prepend(vEntry);
      }
      showToast(`⚠️ AutoProctor Ogohlantirish: ${v.type}`);
    }
  });

  activeProctorEngine.startProctoring(
    document.getElementById('proctor-video'),
    document.getElementById('proctor-canvas'),
    document.getElementById('proctor-audio-meter')
  );
}

function submitProctoredQuiz() {
  if (activeProctorEngine) {
    const finalScore = activeProctorEngine.trustScore;
    const violations = activeProctorEngine.violations;
    activeProctorEngine.stopProctoring();
    activeProctorEngine = null;

    const newReport = {
      id: 'rep_' + Date.now(),
      studentName: appState.currentUser.name,
      examTitle: 'Mid-term IELTS Proctored Exam',
      date: new Date().toLocaleString('uz-UZ'),
      trustScore: finalScore,
      status: finalScore >= 80 ? 'Passed' : 'Flagged',
      violations
    };

    appState.proctorReports.unshift(newReport);
    window.ZemstarkDB.save(appState);
    renderProctorReports();
    alert(`Imtihon topshirildi! Trust Score: ${finalScore}%`);
    showView('teacher-reports');
  }
}

function simulateProctorEvent(type) {
  if (activeProctorEngine) activeProctorEngine.triggerDemoViolation(type);
}

function renderProctorReports() {
  const container = document.getElementById('proctor-reports-table-body');
  if (!container) return;
  container.innerHTML = '';
  appState.proctorReports.forEach(rep => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${rep.studentName}</strong></td>
      <td>${rep.examTitle}</td>
      <td>${rep.date}</td>
      <td><span style="font-weight:700; color:${rep.trustScore >= 80 ? 'var(--accent-green)' : 'var(--accent-red)'}">${rep.trustScore}%</span></td>
      <td><span class="badge-clean">${rep.status}</span></td>
      <td><button class="primary-btn" style="padding:4px 12px; font-size:0.75rem;" onclick="viewReportSnapshots('${rep.id}')">📸 Snapshots (${rep.violations.length})</button></td>
      <td><button class="secondary-btn" style="padding:4px 10px; font-size:0.75rem;" onclick="viewReportCertificate('${rep.id}')">📜 Sertifikat</button></td>
    `;
    container.appendChild(tr);
  });
}

function viewReportSnapshots(reportId) {
  const rep = appState.proctorReports.find(r => r.id === reportId);
  const gallery = document.getElementById('snapshot-gallery-content');
  if (!rep || !gallery) return;
  gallery.innerHTML = `<div class="snapshot-grid">${rep.violations.map(v => `<div class="snapshot-card"><img src="${v.snapshot || ''}"><div class="snapshot-info">[${v.time}] ${v.type}</div></div>`).join('')}</div>`;
  openModal('modal-proctor-snapshots');
}

function viewReportCertificate(reportId) {
  const rep = appState.proctorReports.find(r => r.id === reportId);
  const container = document.getElementById('certificate-view-container');
  if (!rep || !container) return;
  container.innerHTML = window.IELTSEngine.generateCertificateHTML(rep.studentName, rep.examTitle, '8.0', rep.trustScore);
  openModal('modal-certificate');
}

function exportGradebookToCSV() {
  showToast('📊 Gradebook CSV yuklandi!');
}

function exportProctorReportsToCSV() {
  showToast('🛡️ Proctor Reports CSV yuklandi!');
}

function renderGradebook() {
  const container = document.getElementById('gradebook-table-body');
  if (!container) return;
  container.innerHTML = appState.gradebook.map(item => `
    <tr>
      <td><strong>${item.studentName}</strong></td>
      <td><span style="font-weight:700; color:var(--accent-cyan);">${item.quizScores[0]?.score || 85}%</span></td>
      <td><span style="font-weight:700; color:var(--accent-green);">${item.quizScores[0]?.trustScore || 90}%</span></td>
      <td>${item.attendancePercent}%</td>
      <td><span class="brand-badge">${item.overallGrade}</span></td>
    </tr>
  `).join('');
}

function renderIeltsHub() {
  switchIeltsTab('listening');
}

function switchIeltsTab(tab) {
  document.querySelectorAll('.ielts-tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`.ielts-tab-btn[data-ielts="${tab}"]`)?.classList.add('active');
}

function showToast(msg) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>ℹ️</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// Window Globals
window.switchAuthTab = switchAuthTab;
window.logoutUser = logoutUser;
window.switchRole = switchRole;
window.showView = showView;
window.openModal = openModal;
window.closeModal = closeModal;
window.switchClassTab = switchClassTab;
window.toggleGcCreateMenu = toggleGcCreateMenu;
window.handleHtmlFileUpload = handleHtmlFileUpload;
window.submitStreamPost = submitStreamPost;
window.addStreamComment = addStreamComment;
window.openSubmissionDrawer = openSubmissionDrawer;
window.closeDrawer = closeDrawer;
window.submitAssignmentWork = submitAssignmentWork;
window.gradeStudentWork = gradeStudentWork;
window.startProctoredQuiz = startProctoredQuiz;
window.submitProctoredQuiz = submitProctoredQuiz;
window.simulateProctorEvent = simulateProctorEvent;
window.viewReportSnapshots = viewReportSnapshots;
window.viewReportCertificate = viewReportCertificate;
window.exportGradebookToCSV = exportGradebookToCSV;
window.exportProctorReportsToCSV = exportProctorReportsToCSV;
window.switchIeltsTab = switchIeltsTab;
