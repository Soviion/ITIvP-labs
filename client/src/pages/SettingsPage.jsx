import AvatarCard from '../components/AvatarCard';
import { EmailCard, PasswordCard, TwoFactorCard } from '../components/SettingsCards';

export default function SettingsPage() {
  return (
    <>
      <title>Настройки — Твой талон</title>
      <div className="page-head">
        <div>
          <h1>Настройки</h1>
          <p>Аватар, почта, пароль и двухфакторная защита через Google Authenticator</p>
        </div>
      </div>
      <div className="sections">
        <AvatarCard />
        <EmailCard />
        <PasswordCard />
        <TwoFactorCard />
      </div>
    </>
  );
}
