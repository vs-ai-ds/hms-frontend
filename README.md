# Hospital Management System – Frontend

A modern, enterprise-grade web application for comprehensive hospital management. Built with React, TypeScript, and Vite for optimal performance and developer experience.

This project is part of a **multi-tenant Hospital Management System (HMS)** designed to handle patient records, appointments, prescriptions, admissions, and administrative operations for hospitals and healthcare facilities.

This project was created as part of **HackArena 2.0 by Masaiverse x Platform Commons**, which was held on 29th & 30th November 2025!

## 🔗 Related Repositories

- **Frontend Repository** (this repository) - React-based frontend application
- **[Backend Repository](https://github.com/vs-ai-ds/hms-backend)** - FastAPI-based backend API


## 🌐 Live Demo

[![Frontend Live](https://img.shields.io/badge/Frontend-Live-green)](https://hms.varunanalytics.com/)

[![Backend Live](https://img.shields.io/badge/Backend-API-blue)](https://hms-backend-5z1l.onrender.com/)

---

## 📸 Screenshots

### Authentication & Onboarding

🔐 Login Page — Multi-tenant authentication with demo account selector
![Login page with demo account selection](docs/screenshots/login-page.png)

🏥 Hospital Registration — Self-service tenant registration
![Hospital registration form](docs/screenshots/hospital-registration.png)

### Dashboard & Analytics

📊 Dashboard — Role-based overview with real-time metrics
![Dashboard with metrics and charts](docs/screenshots/dashboard-overview.png)

📈 Analytics Charts — Patient registrations, appointments, and prescription trends
![Interactive charts and analytics](docs/screenshots/dashboard-charts.png)

### Patient Management

👥 Patients List — Comprehensive patient directory with advanced filtering
![Patients list with filters and search](docs/screenshots/patients-list.png)

📋 Patient Detail — Complete patient profile with medical history
![Patient detail page with tabs](docs/screenshots/patient-detail.png)

📝 Quick Registration — Fast patient registration dialog
![Quick patient registration form](docs/screenshots/quick-register.png)

💉 Vitals Recording — Track patient vital signs
![Vitals recording dialog](docs/screenshots/vitals-dialog.png)

### Appointments (OPD)

📅 Appointments — Outpatient department appointment management
![Appointments page with status filters](docs/screenshots/appointments-page.png)

📆 Appointment Detail — Full appointment information and actions
![Appointment detail dialog](docs/screenshots/appointment-detail.png)

📝 Create Appointment — Create Appointment for OPD patient
![Appointment detail dialog](docs/screenshots/create_appointment.png)

✅ Check-in Flow — Patient check-in and consultation workflow
![Appointment check-in interface](docs/screenshots/appointment-checkin.png)

🔄 Reschedule Appointment — Easily modify appointment date or time
![Reschedule appointment dialog](docs/screenshots/reschedule-appointment.png)

🚫 Close Appointment — Mark appointments as completed or closed
![Close appointment confirmation](docs/screenshots/close-appointment.png)

❌ Cancel Appointment — Easily cancel scheduled appointments  
![Cancel appointment dialog](docs/screenshots/cancel-appointment.png)

### Prescriptions

💊 Prescriptions — Prescription management and dispensing
![Prescriptions list with status filters](docs/screenshots/prescriptions-page.png)

📄 Prescription Forms — Three types: for OPD appointments, without appointment, and for IPD patients  
![OPD Prescription Form](docs/screenshots/prescription-form-opd.png)  
![No Appointment Prescription Form](docs/screenshots/prescription-form-no-appointment.png)  
![IPD Prescription Form](docs/screenshots/prescription-form-ipd.png)

### Prescription Management Enhancements

🐞 Issue Prescription — Issue new prescriptions for patients  
![Issue prescription process](docs/screenshots/issue-prescription.png)

❌ Cancel Prescription — Cancel prescriptions with audit trail  
![Cancel prescription confirmation dialog](docs/screenshots/cancel-prescription.png)


🖨️ Prescription Print — Printable prescription view
![Prescription print view](docs/screenshots/prescription-print.png)

### Admissions (IPD)

🏥 Admissions — Inpatient department management
![Admissions list with active patients](docs/screenshots/admissions-page.png)

📝 Admission Form — Admit patients to IPD
![Admission form dialog](docs/screenshots/admission-form.png)

🏥 Discharge — Patient discharge workflow
![Discharge dialog with summary](docs/screenshots/discharge-dialog.png)

### Administrative Features

👤 User Management — Staff and user administration
![Users management page](docs/screenshots/users-management.png)

🏢 Departments — Department configuration
![Departments management](docs/screenshots/departments-page.png)

🔐 Roles & Permissions — Role-based access control
![Roles and permissions management](docs/screenshots/roles-page.png)

📦 Stock Items — Medicine and equipment inventory
![Stock items management](docs/screenshots/stock-items-page.png)

### Patient Sharing

🤝 Patient Record Sharing — Easily share patient records with other hospitals  
![Patient record sharing dialog](docs/screenshots/patient-sharing-dialog.png)

📝 Sharing Requests — Manage sharing requests
![Sharing requests management](docs/screenshots/sharing-requests.png)


### Super Admin
📊 Platform Dashboard — Centralized dashboard for Super Admins  
![Platform dashboard metrics](docs/screenshots/platform-dashboard.png)

🏢 Tenant Management — Manage tenants (hospitals) at platform level  
![Tenant management interface](docs/screenshots/platform-tenants.png)

### Multilingual Support

🌐 **Multilingual Interface** — The application is designed with provisions for multiple languages, allowing users to select their preferred language for a localized experience.

![Login](docs/screenshots/login-hi.png)

🈳 **Dynamic Translation** — Key interface elements are dynamically translated based on the chosen language, enhancing accessibility for diverse user groups.

![Translated dashboard in Hindi](docs/screenshots/dashboard-hi.png)

### Mobile Experience

📱 Responsive Design — Mobile-optimized interface
![Mobile responsive view](docs/screenshots/mobile-dashboard.png)

---

## ✨ Features

### 🔐 Authentication & Security

#### Multi-Tenant Authentication
- **Hospital Self-Registration**: Hospitals can register and create their tenant
- **Email Verification**: Secure email verification flow for new accounts
- **Password Management**: 
  - Forgot password with email reset
  - First login password change requirement
  - Secure password reset flow
- **Demo Mode**: Pre-configured demo accounts for testing (configurable via `VITE_DEMO_MODE`)
- **JWT Authentication**: Secure token-based authentication with automatic refresh
- **Role-Based Access Control (RBAC)**: Granular permissions per role
- **Protected Routes**: Route-level permission checking

#### Security Features
- **Session Management**: Automatic token refresh and session handling
- **Permission Guards**: Component-level permission checking
- **Secure API Communication**: Axios-based API client with interceptors
- **Input Validation**: Client-side validation with Zod schemas

### 📊 Dashboard & Analytics

#### Role-Based Dashboards
- **Super Admin Dashboard**: Platform-wide metrics (total tenants, users, patients, appointments, prescriptions)
- **Hospital Admin Dashboard**: Hospital operations overview
- **Doctor Dashboard**: Personal appointments, pending consultations, prescriptions
- **Nurse Dashboard**: Pending vitals recording, IPD admissions
- **Pharmacist Dashboard**: Prescriptions to dispense, stock alerts
- **Receptionist Dashboard**: Pending check-ins, appointment scheduling

#### Real-Time Metrics
- **Today's Activity**: Patients registered, appointments, prescriptions, IPD admissions
- **Status Breakdowns**: Appointments and prescriptions by status
- **Trend Analysis**: Patient registrations over time (7/30/90 days)
- **Interactive Charts**: 
  - Bar charts for status distribution
  - Line charts for trends
  - Pie charts for category breakdowns
- **Quick Actions**: Clickable metrics that navigate to filtered views

#### Demo Data Management (Super Admin)
- **Seed Demo Data**: Create fresh demo data for testing
- **Freshen Demo Data**: Shift demo data dates forward
- **Reset Demo Data**: Clear all demo data
- **Demo Credentials Display**: Show all demo account credentials

### 👥 Patient Management

#### Patient Registration
- **Quick Registration**: Fast registration dialog for walk-in patients
- **Full Registration**: Comprehensive patient form with all details
- **Duplicate Detection**: Smart detection of existing patients
- **Patient Code Generation**: Automatic unique patient code assignment
- **Comprehensive Data Capture**:
  - Personal information (name, DOB, gender, contact)
  - Address details
  - Emergency contact
  - Medical information (blood group, allergies, chronic conditions)
  - Consent management (SMS, email)

#### Patient Profile
- **Complete Patient View**: 
  - Personal information
  - Medical history
  - Appointment history
  - Prescription history
  - Admission history
  - Vitals history
  - Documents
- **Clinical Snapshot**: Quick overview of patient's clinical status
- **Edit Profile**: Update patient information
- **Last Visit Tracking**: Automatic tracking of patient visits

#### Patient Search & Filtering
- **Advanced Search**: Search by name, patient code, phone, email
- **Filter Options**:
  - Gender
  - Age range
  - Last visit date
  - Registration date
  - Blood group
- **Sort Options**: By name, registration date, last visit
- **Pagination**: Efficient handling of large patient lists

#### Vitals Management
- **Vitals Recording**: Record comprehensive vital signs
  - Blood pressure (systolic/diastolic)
  - Heart rate
  - Temperature
  - Respiratory rate
  - SpO2
  - Weight and height
- **Vitals History**: View historical vitals data
- **OPD & IPD Vitals**: Support for both outpatient and inpatient vitals

### 📅 Appointments (OPD)

#### Appointment Management
- **Create Appointments**: Schedule appointments with doctors
- **Status Workflow**: 
  - SCHEDULED → CHECKED_IN → IN_CONSULTATION → COMPLETED
  - NO_SHOW and CANCELLED states
- **15-Minute Intervals**: Time slots in 15-minute blocks
- **Appointment Segments**: 
  - UPCOMING: Future appointments
  - TODAY: Today's appointments
  - PAST: Historical appointments
  - ALL: Complete list

#### Appointment Actions
- **Check-In**: Receptionist can check in patients
- **Start Consultation**: Doctor can start consultation
- **Complete Appointment**: Mark appointment as completed
- **Cancel Appointment**: Cancel with reason
- **No-Show Marking**: Mark patients who didn't show up

#### Advanced Features
- **Eligibility Checking**: Prevent duplicate appointments within time window
- **Doctor Assignment**: Assign appointments to specific doctors
- **Department Filtering**: Filter by department
- **Date Range Filtering**: Filter by date range
- **Status Filtering**: Filter by appointment status
- **Bulk Actions**: Select and manage multiple appointments

### 💊 Prescriptions

#### Prescription Management
- **Create Prescriptions**: Link to appointments or admissions
- **Prescription Items**: Add multiple medicines with dosages
- **Status Workflow**:
  - DRAFT → ISSUED → DISPENSED
  - CANCELLED state
- **Stock Integration**: Automatic stock checking and deduction
- **Prescription Codes**: Unique prescription identifiers

#### Prescription Features
- **Print View**: Printable prescription format
- **Medicine Catalog**: Select from stock items
- **Dosage Management**: Configure dosage, frequency, duration
- **Instructions**: Add patient instructions
- **Status Tracking**: Track prescription through workflow
- **Filtering**: Filter by status, patient, doctor, date range

#### Dispensing (Pharmacist)
- **Dispense Prescriptions**: Mark prescriptions as dispensed
- **Stock Deduction**: Automatic stock level updates
- **Pending Queue**: View prescriptions awaiting dispensing

### 🏥 Admissions (IPD)

#### Admission Management
- **Admit Patients**: Create IPD admissions
- **Admission Details**:
  - Department assignment
  - Primary doctor
  - Admission reason
  - Room/bed assignment (if applicable)
- **Status Tracking**: ACTIVE and DISCHARGED states
- **Admission History**: View all admissions for a patient

#### Discharge Workflow
- **Discharge Patients**: Complete discharge process
- **Discharge Summary**: Add clinical summary
- **Discharge Date**: Automatic timestamp tracking
- **Admission Duration**: Calculate length of stay

#### IPD Features
- **Active Admissions**: View currently admitted patients
- **Vitals Tracking**: Record vitals for IPD patients
- **Prescription Linking**: Link prescriptions to admissions
- **Department Filtering**: Filter by department

### 👤 User Management

#### User Administration
- **Create Users**: Add staff members with roles
- **Role Assignment**: Assign multiple roles per user
- **Department Assignment**: Assign users to departments
- **User Status**: Activate/deactivate users
- **Password Management**: Admin-triggered password reset

#### User Features
- **User Profiles**: Complete user information
- **Activity Tracking**: Track user activity
- **Permission Management**: Role-based permissions
- **Bulk Operations**: Bulk activate/deactivate users
- **Search & Filter**: Advanced user search and filtering

### 🏢 Department Management

#### Department Configuration
- **Create Departments**: Add new departments
- **Department Types**: 
  - Patient-facing departments
  - Staff-only departments
- **Department Details**: Name, description, status
- **Department Assignment**: Assign staff to departments

### 🔐 Roles & Permissions

#### Role-Based Access Control
- **System Roles**: Pre-defined roles (HOSPITAL_ADMIN, DOCTOR, NURSE, PHARMACIST, RECEPTIONIST)
- **Custom Roles**: Create custom roles with specific permissions
- **Permission Assignment**: Granular permission management
- **Permission Categories**: Organized by feature area
- **Role Permissions**: View and manage role permissions

### 📦 Stock Management

#### Inventory Management
- **Stock Items**: Manage medicines, equipment, and consumables
- **Stock Types**:
  - MEDICINE: Prescription medicines
  - EQUIPMENT: Medical equipment
  - CONSUMABLE: Non-prescription items
- **Stock Details**:
  - Current stock level
  - Reorder level
  - Stock item information (name, form, strength for medicines)
- **Stock Tracking**: Automatic deduction on prescription dispensing
- **Low Stock Alerts**: Alerts for items below reorder level

### 🤝 Patient Sharing

#### Inter-Hospital Sharing
- **Share Patients**: Share patient records with other hospitals
- **Sharing Requests**: Send and receive sharing requests
- **Shared Patients**: View patients shared with your hospital
- **Sharing Status**: Track sharing request status
- **Access Control**: Permission-based sharing

### 🏢 Platform Management (Super Admin)

#### Multi-Tenant Administration
- **Tenant Management**: View and manage all hospital tenants
- **Tenant Status**: Activate/deactivate tenants
- **Tenant Metrics**: Platform-wide statistics
- **Admin Password Reset**: Reset tenant admin passwords
- **Tenant Details**: View tenant information and configuration

### 🌐 Internationalization

#### Multi-Language Support
- **English & Hindi**: Full translation support
- **Language Switcher**: Easy language switching
- **RTL Support**: Right-to-left language support (if needed)
- **Date Format Configuration**: Configurable date formats (DD/MM/YYYY, MM/DD/YYYY, etc.)

### 🎨 User Interface

#### Modern Design
- **Material-UI (MUI)**: Professional component library
- **Responsive Design**: Mobile-first, works on all devices
- **Dark Mode Ready**: Theme system supports dark mode
- **Accessibility**: WCAG-compliant components
- **Toast Notifications**: User-friendly feedback system
- **Loading States**: Clear loading indicators
- **Error Handling**: Comprehensive error messages

#### User Experience
- **Intuitive Navigation**: Clear menu structure
- **Quick Actions**: Contextual action buttons
- **Keyboard Shortcuts**: Power user features
- **Form Validation**: Real-time validation feedback
- **Confirmation Dialogs**: Prevent accidental actions
- **Bulk Operations**: Efficient multi-select operations

---

## 🛠️ Tech Stack

### Core
- **React 19** - Modern UI library with latest features
- **TypeScript 5.9** - Type-safe development
- **Vite 7** - Fast build tool and dev server
- **React Router 7** - Client-side routing with data loaders

### UI & Styling
- **Material-UI (MUI) 7** - Comprehensive component library
- **Emotion** - CSS-in-JS styling solution
- **Recharts 3** - Composable charting library for analytics

### State Management & Data Fetching
- **Zustand** - Lightweight state management
- **TanStack Query (React Query) 5** - Powerful data synchronization and caching
- **Axios** - HTTP client with interceptors

### Forms & Validation
- **React Hook Form 7** - Performant form library
- **Zod 4** - Schema validation
- **@hookform/resolvers** - Zod integration for React Hook Form

### Internationalization
- **i18next 25** - Internationalization framework
- **react-i18next 16** - React bindings for i18next

### Development Tools
- **ESLint 9** - Code linting with TypeScript support
- **TypeScript ESLint** - TypeScript-specific linting rules
- **Vite SWC Plugin** - Fast compilation with SWC

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ and pnpm/npm
- **Backend API** running (see backend README)
- **Environment Variables** configured (see `.env.example`)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-org/hms-frontend
   cd hms-frontend
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   # or
   npm install
   ```

3. **Configure environment variables**
   
   Create `.env.local` file (refer to `.env.example`):
   ```env
   # API Configuration
   VITE_API_BASE_URL=http://localhost:8000/api/v1
   
   # Demo Mode (optional)
   VITE_DEMO_MODE=true
   
   # Date Format (optional, default: DD/MM/YYYY)
   VITE_DATE_FORMAT=DD/MM/YYYY
   ```

4. **Start development server**
   ```bash
   pnpm dev
   # or
   npm run dev
   ```
   The app will be available at `http://localhost:5173`

### Building for Production

```bash
pnpm build
# or
npm run build
```
This generates optimized static files in the `dist/` folder.

---

## ☁️ Deployment

### Option 1: Vercel (Recommended)

1. Connect your GitHub repository to Vercel
2. Add environment variables in Vercel dashboard
3. Deploy automatically on every push

**Benefits:**
- Automatic HTTPS
- Global CDN
- Zero-config deployment
- Preview deployments for PRs

### Option 2: Netlify

1. Connect GitHub repository
2. Set build command: `pnpm build`
3. Set publish directory: `dist`
4. Add environment variables
5. Deploy

### Option 3: Static Hosting (AWS S3, Google Cloud Storage, etc.)

1. **Build the application**
   ```bash
   pnpm build
   ```

2. **Upload to hosting service**
   - Upload `dist/` folder contents
   - Configure as static website
   - Set up CDN for optimal performance

---

## 📁 Project Structure

```
hms-frontend/
├── src/
│   ├── app/
│   │   ├── components/          # Reusable UI components
│   │   │   ├── auth/           # Authentication components
│   │   │   ├── appointments/   # Appointment-related components
│   │   │   ├── common/         # Common components (dialogs, toolbars, etc.)
│   │   │   ├── layout/        # Layout components
│   │   │   ├── patients/       # Patient-related components
│   │   │   └── prescriptions/ # Prescription components
│   │   ├── features/          # Feature modules
│   │   │   ├── admissions/    # IPD admission features
│   │   │   ├── appointments/  # OPD appointment features
│   │   │   ├── auth/          # Authentication pages
│   │   │   ├── dashboard/     # Dashboard page
│   │   │   ├── departments/   # Department management
│   │   │   ├── landing/       # Landing page
│   │   │   ├── patients/       # Patient management
│   │   │   ├── platform/      # Platform/tenant management
│   │   │   ├── prescriptions/ # Prescription management
│   │   │   ├── roles/        # Role management
│   │   │   ├── sharing/      # Patient sharing
│   │   │   ├── stock_items/  # Stock management
│   │   │   ├── tenants/      # Tenant registration
│   │   │   └── users/       # User management
│   │   ├── layout/           # Layout components
│   │   │   ├── AuthLayout.tsx
│   │   │   └── DashboardLayout.tsx
│   │   ├── lib/              # Utilities and helpers
│   │   │   ├── api/          # API client functions
│   │   │   ├── constants/    # App constants
│   │   │   ├── utils/       # Utility functions
│   │   │   └── validation/  # Zod validation schemas
│   │   ├── routes.tsx        # Route definitions
│   │   ├── store/            # Zustand state stores
│   │   │   ├── authStore.ts
│   │   │   ├── i18nStore.ts
│   │   │   └── uiStore.ts
│   │   └── types/            # TypeScript type definitions
│   ├── hooks/                # Custom React hooks
│   │   ├── useAuth.ts
│   │   ├── usePermissions.ts
│   │   └── useTenantTheme.ts
│   ├── i18n/                 # Internationalization
│   │   ├── index.ts
│   │   └── locales/
│   │       ├── en/
│   │       └── hi/
│   ├── styles/               # Global styles
│   │   └── theme.ts
│   ├── App.tsx               # Main app component
│   ├── main.tsx              # Application entry point
│   └── router.tsx            # Router configuration
├── public/                   # Static assets
├── docs/                     # Documentation
│   └── screenshots/          # Screenshot images
├── .env.example             # Environment variables template
├── vite.config.ts           # Vite configuration
├── tsconfig.json            # TypeScript configuration
└── package.json             # Dependencies and scripts
```

---

## 🔑 Key Features Deep Dive

### Role-Based Access Control (RBAC)

The application implements a comprehensive permission system:

- **Permission-Based Navigation**: Menu items shown based on user permissions
- **Route Protection**: Routes protected by permission requirements
- **Component-Level Guards**: Components check permissions before rendering
- **API-Level Security**: Backend validates all permissions

**Permission Categories:**
- `dashboard:view` - View dashboard
- `patients:view/create/update` - Patient management
- `appointments:view/create/update_status` - Appointment management
- `prescriptions:view/create/update_status` - Prescription management
- `users:view/create/update/deactivate` - User management
- `departments:view/create/update/delete` - Department management
- `roles:view/create/update/assign_permissions` - Role management
- `stock_items:view/manage` - Stock management
- And more...

### Multi-Tenant Architecture

- **Tenant Isolation**: Each hospital operates in its own tenant context
- **Schema-Per-Tenant**: Database-level isolation
- **Super Admin**: Platform-level administration across all tenants
- **Tenant Registration**: Self-service hospital registration
- **Tenant Context**: Automatic tenant context in all API calls

### Patient Management Workflow

1. **Registration**: Quick or full patient registration
2. **Appointment**: Schedule OPD appointment
3. **Check-In**: Receptionist checks in patient
4. **Consultation**: Doctor starts consultation
5. **Vitals**: Nurse records vitals (if needed)
6. **Prescription**: Doctor creates prescription
7. **Dispensing**: Pharmacist dispenses medicines
8. **Follow-up**: Schedule follow-up appointment if needed

### Appointment Lifecycle

```
SCHEDULED → CHECKED_IN → IN_CONSULTATION → COMPLETED
     ↓                                           ↓
  NO_SHOW                                    (End)
     ↓
  CANCELLED
```

- **Status Transitions**: Enforced workflow with validation
- **Time Tracking**: Automatic timestamp recording at each stage
- **Eligibility Checks**: Prevent duplicate appointments
- **15-Minute Slots**: All appointments in 15-minute intervals

### Prescription Workflow

```
DRAFT → ISSUED → DISPENSED
  ↓
CANCELLED
```

- **Appointment/Admission Linking**: Prescriptions linked to visits
- **Stock Integration**: Automatic stock checking and deduction
- **Multi-Item Support**: Multiple medicines per prescription
- **Dosage Management**: Detailed dosage, frequency, duration
- **Print Support**: Printable prescription format

### Date Format Configuration

The application supports configurable date formats:

- **Frontend**: Set via `VITE_DATE_FORMAT` environment variable
- **Backend**: Set via `DATE_FORMAT` environment variable
- **Supported Formats**:
  - `DD/MM/YYYY` (default) - European format
  - `MM/DD/YYYY` - US format
  - `YYYY-MM-DD` - ISO format
  - `DD-MM-YYYY` - European with dashes

### Demo Mode

When `VITE_DEMO_MODE=true`:

- **Demo Account Selector**: Quick login with pre-configured accounts
- **Demo Credentials Display**: Show all demo accounts on Super Admin dashboard
- **Demo Data Management**: Seed, freshen, and reset demo data
- **Pre-configured Tenants**: Two demo tenants (A and B) with sample data

---

## 🔐 Security

- **JWT Authentication**: Secure token-based authentication with refresh tokens
- **Protected Routes**: Route-level permission checking
- **Permission Guards**: Component-level permission validation
- **CSRF Protection**: Safe API communication
- **Input Validation**: Client and server-side validation with Zod
- **Secure File Uploads**: Image type and size validation
- **XSS Protection**: React's built-in XSS protection
- **Secure Storage**: Token storage with appropriate security measures

---

## 🧪 Development

### Available Scripts

```bash
# Start development server
pnpm dev

# Build for production
pnpm build

# Preview production build
pnpm preview

# Run linter
pnpm lint
```

### Code Style

- Follow TypeScript best practices
- Use functional components with hooks
- Prefer composition over inheritance
- Keep components small and focused
- Use meaningful variable and function names
- Add comments only when necessary (code should be self-explanatory)
- Follow ESLint rules (zero warnings policy)

### Environment Variables

Key environment variables:

- `VITE_API_BASE_URL` - Backend API base URL (required)
- `VITE_DEMO_MODE` - Enable demo mode features (optional)
- `VITE_DATE_FORMAT` - Date format preference (optional)

---

## 📊 Performance Optimizations

- **Code Splitting**: Automatic route-based code splitting
- **Lazy Loading**: Components loaded on demand
- **React Query Caching**: Intelligent data caching and refetching
- **Memoization**: React.memo and useMemo for expensive computations
- **Bundle Optimization**: Tree-shaking and minification
- **Image Optimization**: Optimized image handling
- **CDN Delivery**: Static assets served via CDN (in production)

---

## 🌐 Internationalization

The application supports multiple languages:

- **English** (default)
- **Hindi** (हिंदी)

**Adding a New Language:**

1. Create translation file in `src/i18n/locales/{locale}/translation.json`
2. Add locale to i18n configuration
3. Add language switcher option

**Translation Keys:**
- Organized by feature area
- Consistent naming convention
- Fallback to English if translation missing

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Write TypeScript with proper types
- Follow existing code patterns
- Add tests for new features
- Update documentation
- Ensure ESLint passes (zero warnings)
- Test on multiple browsers
- Test responsive design

---

## 📝 License

This project is licensed under the MIT License. See the `LICENSE` file for details.

---

## Acknowledgments

- Built with modern web technologies
- Uses Material-UI for professional UI components
- Powered by React Query for efficient data management
- Multi-language support with i18next
- Type-safe development with TypeScript

---

## 📞 Support

For issues, questions, or contributions, please open an issue on GitHub.

---

## 🔒 Security & Code Quality

- Use ESLint for enforcing code style and preventing common mistakes
- Write all code in TypeScript for type safety
- Conduct code reviews via Pull Requests
- Follow secure coding guidelines
- Keep dependencies up-to-date and review for vulnerabilities
- Run automated tests and static analysis tools

**Last Updated:** December 2025