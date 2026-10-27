import React, { useContext, useEffect, useState } from "react";
import { toast } from "react-toastify";
import { apiUrl } from "../common/http";
import PhoneSignInSettings from "../common/PhoneSignInSettings";
import { AdminAuthContext } from "../context/AdminAuth";
import CustomerShell from "./CustomerShell";
import { customerRequest, formatDate } from "./customerApi";

const emptyPasswords = { current_password: "", password: "", password_confirmation: "" };

const CustomerProfile = () => {
  const { user, login } = useContext(AdminAuthContext);
  const [profile, setProfile] = useState({ name: user?.user?.name || "", phone: user?.user?.phone || "" });
  const [account, setAccount] = useState(user?.user || null);
  const [profileErrors, setProfileErrors] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [passwords, setPasswords] = useState(emptyPasswords);
  const [passwordErrors, setPasswordErrors] = useState({});
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    customerRequest("profile").then((data) => {
      setAccount(data);
      setProfile({ name: data.name || "", phone: data.phone || "" });
    }).catch((requestError) => toast.error(requestError.message));
  }, []);

  const saveProfile = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    setProfileErrors({});
    try {
      const result = await customerRequest("profile", { method: "PUT", body: profile });
      setAccount(result.user);
      login({ ...user, user: result.user }); // keep the header and sidebar name in sync
      toast.success(result.message);
    } catch (requestError) {
      setProfileErrors(requestError.errors || {});
      toast.error(requestError.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (event) => {
    event.preventDefault();
    if (passwords.password !== passwords.password_confirmation) {
      setPasswordErrors({ password_confirmation: "Passwords do not match." });
      return;
    }
    setSavingPassword(true);
    setPasswordErrors({});
    try {
      const response = await fetch(`${apiUrl}/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", Authorization: `Bearer ${localStorage.getItem("customerToken")}` },
        body: JSON.stringify(passwords),
      });
      const data = await response.json();
      if (response.status === 422) {
        setPasswordErrors(Object.fromEntries(Object.entries(data.errors || {}).map(([field, messages]) => [field, messages[0]])));
        return;
      }
      if (!response.ok) throw new Error(data.message || "Unable to change your password.");
      toast.success(data.message);
      setPasswords(emptyPasswords);
    } catch (requestError) {
      toast.error(requestError instanceof TypeError ? "Cannot reach the store right now." : requestError.message);
    } finally {
      setSavingPassword(false);
    }
  };

  const passwordField = (name, label, autoComplete) => (
    <div className="mb-3">
      <label htmlFor={`pw-${name}`} className="form-label">{label}</label>
      <input id={`pw-${name}`} type="password" className={`form-control ${passwordErrors[name] ? "is-invalid" : ""}`} autoComplete={autoComplete} value={passwords[name]} required
        onChange={(event) => { setPasswords((current) => ({ ...current, [name]: event.target.value })); setPasswordErrors((current) => ({ ...current, [name]: undefined })); }} />
      {passwordErrors[name] && <div className="invalid-feedback">{passwordErrors[name]}</div>}
    </div>
  );

  return (
    <CustomerShell>
      <div className="customer-page-head">
        <span className="customer-eyebrow">SETTINGS</span>
        <h1>Profile &amp; security</h1>
        <p>{account ? `Signed in as ${account.email} · member since ${formatDate(account.created_at)}` : "Manage your personal details."}</p>
      </div>
      <div className="row g-4">
        <div className="col-lg-6">
          <section className="customer-panel h-100">
            <header className="customer-panel-header"><div><h2>Personal details</h2><p>How we address you and reach you about deliveries.</p></div></header>
            <form onSubmit={saveProfile}>
              <div className="mb-3">
                <label htmlFor="profile-name" className="form-label">Full name</label>
                <input id="profile-name" className={`form-control ${profileErrors.name ? "is-invalid" : ""}`} autoComplete="name" maxLength={255} required value={profile.name} onChange={(event) => setProfile((current) => ({ ...current, name: event.target.value }))} />
                {profileErrors.name && <div className="invalid-feedback">{profileErrors.name}</div>}
              </div>
              <div className="mb-3">
                <label htmlFor="profile-email" className="form-label">Email address</label>
                <input id="profile-email" className="form-control" value={account?.email || ""} disabled readOnly />
                <div className="form-text">Your email is your sign-in and can’t be changed here.</div>
              </div>
              <div className="mb-4">
                <label htmlFor="profile-phone" className="form-label">Mobile number</label>
                <input id="profile-phone" type="tel" className={`form-control ${profileErrors.phone ? "is-invalid" : ""}`} autoComplete="tel" maxLength={40} value={profile.phone} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} />
                {profileErrors.phone && <div className="invalid-feedback">{profileErrors.phone}</div>}
              </div>
              <button type="submit" className="btn btn-primary" disabled={savingProfile}>{savingProfile ? "Saving…" : "Save changes"}</button>
            </form>
          </section>
        </div>
        <div className="col-lg-6">
          <section className="customer-panel h-100">
            <header className="customer-panel-header"><div><h2>Change password</h2><p>Other devices are signed out after a change.</p></div></header>
            <form onSubmit={savePassword}>
              {passwordField("current_password", "Current password", "current-password")}
              {passwordField("password", "New password", "new-password")}
              {passwordField("password_confirmation", "Confirm new password", "new-password")}
              <p className="form-text mt-0 mb-3">Use 8+ characters with upper and lower case letters, a number and a symbol.</p>
              <button type="submit" className="btn btn-outline-secondary" disabled={savingPassword}>{savingPassword ? "Updating…" : "Update password"}</button>
            </form>
          </section>
        </div>
        {/* Saving a different mobile number above clears its confirmation, so the card reloads. */}
        <div className="col-12"><PhoneSignInSettings key={account?.phone || ""} portal="customer" className="customer-panel" /></div>
      </div>
    </CustomerShell>
  );
};

export default CustomerProfile;
