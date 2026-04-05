# AISMS - Demo Login Credentials

> **Important:** Run `node seed_users.mjs` to create these users in your Supabase database before logging in.

---

## 🏢 GOOGLE (Company - Glassmorphism Theme)

| Role | Email | Password | Theme |
|------|-------|----------|-------|
| Admin | admin@google.com | `google@admin` | Glassmorphism |
| HR | hr@google.com | `hr@google` | Glassmorphism |
| IT | it@google.com | `it@google` | Glassmorphism |
| Sales | sales@google.com | `sales@google` | Glassmorphism |
| Marketing | marketing@google.com | `marketing@google` | Glassmorphism |
| Finance | finance@google.com | `finance@google` | Glassmorphism |
| Manager | manager@google.com | `manager@google` | Glassmorphism |

---

## 🏢 MICROSOFT (Company - Glassmorphism Theme)

| Role | Email | Password | Theme |
|------|-------|----------|-------|
| Admin | admin@microsoft.com | `microsoft@admin` | Glassmorphism |
| HR | hr@microsoft.com | `hr@microsoft` | Glassmorphism |
| IT | it@microsoft.com | `it@microsoft` | Glassmorphism |
| Sales | sales@microsoft.com | `sales@microsoft` | Glassmorphism |
| Marketing | marketing@microsoft.com | `marketing@microsoft` | Glassmorphism |
| Finance | finance@microsoft.com | `finance@microsoft` | Glassmorphism |
| Manager | manager@microsoft.com | `manager@microsoft` | Glassmorphism |

---

## 🎓 ANURAG UNIVERSITY (Educational - Neumorphism Theme)

| Role | Email | Password | Theme |
|------|-------|----------|-------|
| Admin | admin@anurag.edu.in | `admin@anurag` | Neumorphism |
| Faculty | saikrishnait@anurag.edu.in | `it@saikrish` | Neumorphism |
| Student | 24eg109a28@anurag.edu.in | `Chatur7` | Neumorphism |
| Student | 24eg109a50@anurag.edu.in | `Divya7` | Neumorphism |

---

## 🎓 BITS PILANI HYDERABAD (Educational - Neumorphism Theme)

| Role | Email | Password | Theme |
|------|-------|----------|-------|
| Admin | admin@hyderabad.bits-pilani.ac.in | `admin@hydbits` | Neumorphism |
| Faculty | saikrishna.it@hyderabad.bits-pilani.ac.in | `it@saikrish` | Neumorphism |
| Student | f2024050@hyderabad.bits-pilani.ac.in | `Divya7` | Neumorphism |
| Student | f2024028@hyderabad.bits-pilani.ac.in | `Chatur7` | Neumorphism |

---

## 🔐 Quick Reference

### Company Logins (Glassmorphism UI)
```
admin@google.com      / google@admin
hr@google.com         / hr@google
it@google.com         / it@google
sales@google.com      / sales@google

admin@microsoft.com   / microsoft@admin
hr@microsoft.com      / hr@microsoft
it@microsoft.com      / it@microsoft
sales@microsoft.com   / sales@microsoft
```

### Educational Logins (Neumorphism UI)
```
admin@anurag.edu.in                    / admin@anurag
saikrishnait@anurag.edu.in            / it@saikrish
24eg109a28@anurag.edu.in              / Chatur7
24eg109a50@anurag.edu.in              / Divya7

admin@hyderabad.bits-pilani.ac.in     / admin@hydbits
saikrishna.it@hyderabad.bits-pilani.ac.in / it@saikrish
f2024050@hyderabad.bits-pilani.ac.in / Divya7
f2024028@hyderabad.bits-pilani.ac.in / Chatur7
```

---

## 🚀 How to Activate

1. **Set environment variables:**
   ```bash
   export SUPABASE_URL=your-supabase-url
   export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

2. **Run the seeder:**
   ```bash
   node seed_users.mjs
   ```

3. **Login** at https://aisms.vercel.app

---

## 📱 Login Page Features

When you type an email address, the login page automatically detects:

- **Organization Type**: Company 🏢 or Educational 🎓
- **Role**: Admin, HR, IT, Sales, Marketing, Finance, Manager, Faculty, Student
- **Theme**: Glassmorphism (Company) or Neumorphism (Educational)

---

## 🔑 Role Permissions

| Role | Dashboard Access | Features |
|------|-----------------|----------|
| **Admin** | Full Access | All features, user management, settings |
| **HR** | Company Dashboard | Employee management, onboarding |
| **IT** | Company Dashboard | Technical management |
| **Sales** | Company Dashboard | Sales reports, client tracking |
| **Marketing** | Company Dashboard | Marketing analytics |
| **Finance** | Company Dashboard | Financial reports |
| **Manager** | Company Dashboard | Team management, reports |
| **Faculty** | Faculty Dashboard | Attendance sessions, student grades |
| **Student** | Student Dashboard | Attendance, timetable, notices |

---

## 🌐 Deployment URLs

| Service | URL |
|---------|-----|
| Frontend | https://aisms.vercel.app |
| AI Server | https://aisms-ai-server.up.railway.app |
| Backend | https://aisms-backend.up.railway.app |
| GitHub | https://github.com/Chatur7x/AI-SmartAttendance |
