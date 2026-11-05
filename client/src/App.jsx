import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { useAuth } from './auth/context';
import CabinetLayout from './components/CabinetLayout';
import DoctorLayout from './components/doctor/DoctorLayout';
import SiteLayout from './components/SiteLayout';
import AppointmentsPage from './pages/AppointmentsPage';
import CabinetCardPage from './pages/CabinetCardPage';
import CabinetHistoryPage from './pages/CabinetHistoryPage';
import CabinetTicketsPage from './pages/CabinetTicketsPage';
import CabinetVisitPage from './pages/CabinetVisitPage';
import ContactsPage from './pages/ContactsPage';
import DoctorPage from './pages/DoctorPage';
import HomePage from './pages/HomePage';
import RegisterPage from './pages/RegisterPage';
import SettingsPage from './pages/SettingsPage';
import DoctorAppointmentsPage from './pages/doctor/DoctorAppointmentsPage';
import DoctorLoginPage from './pages/doctor/DoctorLoginPage';
import DoctorPatientPage from './pages/doctor/DoctorPatientPage';
import DoctorProfilePage from './pages/doctor/DoctorProfilePage';
import DoctorSettingsPage from './pages/doctor/DoctorSettingsPage';
import RouteAnnouncer from './components/RouteAnnouncer';
import Banner from './ui/Banner';
import Spinner from './ui/Spinner';
import { ToastProvider } from './ui/Toast';

// Главная; старый адрес /#contacts теперь открывает отдельную страницу «Контакты и FAQ»
function HomeRoute() {
  const { hash } = useLocation();
  if (hash === '#contacts') return <Navigate to="/contacts" replace />;
  return <HomePage />;
}

// Только для вошедших: гостя отправляем на главную (там окно входа) и запоминаем, куда он шёл
function RequireAuth({ children }) {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'guest') return <Navigate to="/" replace state={{ from: location.pathname }} />;
  return children;
}

// Только для сотрудников регистратуры и администратора. Пока роль не получена с сервера — ждём.
function RequireStaff({ children }) {
  const { isStaff, profile } = useAuth();
  if (profile === 'loading') return null;
  if (!isStaff) return <Banner kind="warn" title="Нет доступа">Этот раздел доступен только сотрудникам регистратуры.</Banner>;
  return children;
}

// Только для гостей: вошедшего пользователя сразу уводим на главную
function GuestOnly({ children }) {
  const { status } = useAuth();
  if (status === 'authed') return <Navigate to="/" replace />;
  return children;
}

// Два отдельных входа с независимыми сессиями: сайт пациентов («Твой талон») и кабинет врача («Моя клиника»).
// Токены хранятся по отдельности, поэтому вход на одном сайте не открывает другой.
function SiteSession() {
  return <AuthProvider portal="site"><Outlet /></AuthProvider>;
}

function DoctorSession() {
  return <AuthProvider portal="doctor"><Outlet /></AuthProvider>;
}

// Кабинет врача открыт врачам и администратору: гостя отправляем на отдельный вход, остальным показываем «Нет доступа»
function RequireDoctor({ children }) {
  const { status, isDoctor, isAdmin, profile } = useAuth();
  if (status === 'guest') return <Navigate to="/doctor/login" replace />;
  if (profile === 'loading') {
    return (
      <div className="doctor-wait" role="status">
        <Spinner size={22} />
        <span>Проверяем доступ…</span>
      </div>
    );
  }
  if (!isDoctor && !isAdmin) {
    return (
      <div className="doctor-denied">
        <Banner kind="warn" title="Нет доступа">Этот раздел доступен только врачам. Вы вошли под другой ролью.</Banner>
      </div>
    );
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <RouteAnnouncer />
        <Routes>
          <Route element={<DoctorSession />}>
            <Route path="doctor/login" element={<DoctorLoginPage />} />
            <Route path="doctor" element={<RequireDoctor><DoctorLayout /></RequireDoctor>}>
              <Route index element={<DoctorAppointmentsPage />} />
              <Route path="patients/:patientId" element={<DoctorPatientPage />} />
              <Route path="profile" element={<DoctorProfilePage />} />
              <Route path="settings" element={<DoctorSettingsPage />} />
            </Route>
            <Route path="doctor/*" element={<Navigate to="/doctor" replace />} />
          </Route>

          <Route element={<SiteSession />}>
            <Route element={<SiteLayout />}>
              <Route index element={<HomeRoute />} />
              <Route path="contacts" element={<ContactsPage />} />
              <Route path="doctors/:id" element={<DoctorPage />} />
              <Route path="register" element={<GuestOnly><RegisterPage /></GuestOnly>} />
              <Route path="login" element={<Navigate to="/" replace />} />

              <Route path="cabinet" element={<RequireAuth><CabinetLayout /></RequireAuth>}>
                <Route index element={<Navigate to="card" replace />} />
                <Route path="card" element={<CabinetCardPage />} />
                <Route path="tickets" element={<CabinetTicketsPage />} />
                <Route path="history" element={<CabinetHistoryPage />} />
                <Route path="history/:visitId" element={<CabinetVisitPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>

              <Route path="staff" element={<RequireAuth><RequireStaff><AppointmentsPage /></RequireStaff></RequireAuth>} />
              <Route path="security" element={<Navigate to="/cabinet/settings" replace />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </ToastProvider>
    </BrowserRouter>
  );
}
