/**
 * ZEMSTARK Platform Database & State Management (Google Classroom Overhaul)
 * Mandatory Auth, Classwork Topics, Assignments, HTML Attachments, Quizzes & Submissions.
 */

const STORAGE_KEY = 'zemstark_app_state_v3';

const initialAppState = {
  // Current session user (null if not logged in)
  currentUser: {
    id: 'usr_teacher_1',
    name: 'Jasur Mavlonov',
    email: 'jasur@zemstark.uz',
    role: 'teacher',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250'
  },
  users: [
    {
      id: 'usr_teacher_1',
      name: 'Jasur Mavlonov',
      email: 'jasur@zemstark.uz',
      password: '123',
      role: 'teacher',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250'
    },
    {
      id: 'usr_student_1',
      name: 'Sardor Karimov',
      email: 'sardor@student.uz',
      password: '123',
      role: 'student',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=250'
    },
    {
      id: 'usr_student_2',
      name: 'Malika Axmedova',
      email: 'malika@student.uz',
      password: '123',
      role: 'student',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=250'
    }
  ],
  classes: [
    {
      id: 'class_101',
      code: 'ZM-8942',
      name: 'IELTS Intensive 7.5+ & Academic Skills',
      subject: 'Ingliz tili / IELTS',
      section: 'Baland Daraja - 2026',
      room: 'Online Room A1',
      teacherName: 'Jasur Mavlonov',
      coverGradient: 'linear-gradient(135deg, #00f2fe 0%, #4facfe 100%)',
      enrolledCount: 28,
      topics: [
        { id: 'top_1', name: 'Unit 1: Listening & Vocabulary' },
        { id: 'top_2', name: 'Unit 2: Academic Writing Task 2' },
        { id: 'top_3', name: 'AutoProctor Mid-Term Mock Exams' }
      ],
      streamPosts: [
        {
          id: 'post_1',
          authorName: 'Jasur Mavlonov',
          authorRole: 'O\'qituvchi',
          authorAvatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
          content: 'Assalomu alaykum qadrli o\'quvchilar! Bugun Classwork bo\'limiga yangi HTML mashq va Writing Task 2 topshiriqlari joylandi. Muxlat: Shanba kunigacha!',
          createdAt: '2026-08-02 10:15',
          comments: [
            {
              id: 'c_1',
              authorName: 'Sardor Karimov',
              authorAvatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=250',
              content: 'Tushunarli ustozi, bajarishni boshladik!',
              createdAt: '2026-08-02 10:20'
            }
          ]
        }
      ],
      assignments: [
        {
          id: 'asg_1',
          topicId: 'top_1',
          type: 'html', // 'assignment', 'html', 'material', 'quiz'
          title: 'Interactive HTML Quiz: Listening Keywords & Vocabulary',
          instructions: 'Quyida joylashtirilgan interaktiv HTML fayl mashqini bajarib, natijangizni skrinshot yoki matn shaklida yuboring.',
          points: 100,
          dueDate: '2026-08-08',
          htmlContent: `
            <div style="font-family:sans-serif; background:#0f172a; color:#fff; padding:20px; border-radius:12px; border:1px solid #00f2fe;">
              <h2 style="color:#00f2fe; margin-bottom:10px;">🎧 Interactive IELTS Vocabulary Challenge</h2>
              <p style="color:#94a3b8; margin-bottom:15px;">Match the academic synonym with its definition:</p>
              <div style="margin-bottom:12px; background:rgba(255,255,255,0.05); padding:10px; border-radius:8px;">
                <strong>1. Substantial:</strong>
                <select style="padding:6px; background:#1e293b; color:#fff; border:1px solid #38bdf8; border-radius:6px; margin-left:10px;">
                  <option>Select Option</option>
                  <option>Large or considerable in amount</option>
                  <option>Very small and negligible</option>
                </select>
              </div>
              <div style="margin-bottom:12px; background:rgba(255,255,255,0.05); padding:10px; border-radius:8px;">
                <strong>2. Exponential:</strong>
                <select style="padding:6px; background:#1e293b; color:#fff; border:1px solid #38bdf8; border-radius:6px; margin-left:10px;">
                  <option>Select Option</option>
                  <option>Becoming more and more rapid</option>
                  <option>Constant and unchanged</option>
                </select>
              </div>
              <button onclick="alert('Muvaffaqiyatli bajarildi! 100% Correct!')" style="background:#00f2fe; color:#000; font-weight:bold; border:none; padding:10px 20px; border-radius:8px; cursor:pointer; margin-top:10px;">Natijani Tekshirish ✨</button>
            </div>
          `,
          attachments: ['Interactive_Vocab.html'],
          submissions: [
            {
              studentId: 'usr_student_1',
              studentName: 'Sardor Karimov',
              submittedAt: '2026-08-02 14:00',
              answerText: 'Topshiriq to\'liq bajarildi. Natija: 100%',
              status: 'Graded', // 'Turned In', 'Graded'
              grade: 95,
              feedback: 'Ajoyib natija Sardor! Lug\'at boyligingiz baland.'
            }
          ]
        },
        {
          id: 'asg_2',
          topicId: 'top_2',
          type: 'assignment',
          title: 'Writing Task 2: Artificial Intelligence Essay',
          instructions: 'Discuss both views and give your opinion (Minimum 250 words).',
          points: 100,
          dueDate: '2026-08-10',
          attachments: ['Essay_Rubric.pdf'],
          submissions: [
            {
              studentId: 'usr_student_2',
              studentName: 'Malika Axmedova',
              submittedAt: '2026-08-02 16:30',
              answerText: 'In the modern era, Artificial Intelligence has become an integral part of modern society...',
              status: 'Turned In',
              grade: null,
              feedback: null
            }
          ]
        }
      ],
      quizzes: [
        {
          id: 'quiz_proctor_1',
          topicId: 'top_3',
          title: 'Mid-term IELTS Proctored Exam (AutoProctor Active)',
          durationMinutes: 30,
          proctoringSettings: { webcamRequired: true, audioDetection: true, maxTabSwitches: 2 },
          questions: [
            {
              id: 1,
              type: 'mcq',
              question: 'According to Listening Passage 1, what is the main purpose of the research project?',
              options: [
                'To evaluate coastal ecosystem preservation',
                'To build new urban transportation networks',
                'To analyze historic weather patterns',
                'To fund agricultural modern technology'
              ],
              correct: 0
            }
          ]
        }
      ]
    }
  ],
  proctorReports: [
    {
      id: 'rep_1',
      studentName: 'Sardor Karimov',
      examTitle: 'Mid-term IELTS Proctored Exam',
      date: '2026-08-02 14:30',
      trustScore: 92,
      status: 'Passed',
      violations: [
        { 
          time: '04:12', 
          type: 'Tab Switch', 
          description: 'Ekrandan boshqa oyna ochildi (1 marta)',
          snapshot: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" style="background:%230f172a;"><text x="20" y="40" fill="%23ef4444" font-size="14" font-family="sans-serif">⚠️ SNAPSHOT: TAB SWITCH DETECTED</text><rect x="60" y="60" width="200" height="100" fill="none" stroke="%23ef4444" stroke-width="2"/><text x="110" y="115" fill="%2394a3b8" font-size="12">Sardor Karimov</text></svg>'
        }
      ]
    }
  ],
  gradebook: [
    {
      studentId: 'usr_student_1',
      studentName: 'Sardor Karimov',
      classId: 'class_101',
      quizScores: [{ quizTitle: 'Mid-term IELTS Exam', score: 90, trustScore: 92 }],
      attendancePercent: 96,
      overallGrade: 'A'
    }
  ]
};

class Storage {
  static get() {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) {
      this.save(initialAppState);
      return initialAppState;
    }
    try {
      return JSON.parse(data);
    } catch(e) {
      return initialAppState;
    }
  }

  static save(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  static reset() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialAppState));
    return initialAppState;
  }
}

window.ZemstarkDB = Storage;
