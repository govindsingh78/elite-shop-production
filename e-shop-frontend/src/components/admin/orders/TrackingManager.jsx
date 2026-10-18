import React, { useState } from "react";
import { apiUrl } from "../../common/http";
import { formatDateTime, lastKnownLocation, TRACKING_STATUSES, timeAgo, trackingLabel } from "../../common/tracking";
import { portalConfig, portalToken } from "../portal";

const blankUpdate = { status: "dispatched", location: "", description: TRACKING_STATUSES.dispatched.note, event_at: "" };

/** Lets an admin post delivery tracking updates that customers see on their order page. */
const TrackingManager = ({ order, onOrderChange, portal = "admin", readOnly = false }) => {
  const [update, setUpdate] = useState(blankUpdate);
  const [noteEdited, setNoteEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const events = order.tracking_events || [];
  const knownLocations = [...new Set(events.map((event) => event.location).filter(Boolean))];

  const request = async (path, options) => {
    const response = await fetch(`${apiUrl}/${portalConfig(portal).api}/orders/${order.id}/tracking${path}`, {
      ...options,
      headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${portalToken(portal) || ""}` },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(Object.values(data.errors || {}).flat()[0] || data.message || "Unable to update tracking.");
    return data;
  };

  const chooseStatus = (status) => {
    // Suggest a customer-friendly note unless the admin has written their own.
    setUpdate((current) => ({ ...current, status, description: noteEdited ? current.description : TRACKING_STATUSES[status].note }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const data = await request("", {
        method: "POST",
        // datetime-local is the admin's local time; send it as an absolute UTC timestamp.
        body: JSON.stringify({ ...update, event_at: update.event_at ? new Date(update.event_at).toISOString() : null }),
      });
      onOrderChange(data.data);
      setSuccess(`${trackingLabel(data.event.status)} update published — the customer can see it now.`);
      setUpdate((current) => ({ ...blankUpdate, status: current.status, description: TRACKING_STATUSES[current.status].note, location: current.location }));
      setNoteEdited(false);
    } catch (requestError) {
      setError(requestError instanceof TypeError ? "Cannot reach the API server." : requestError.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (trackingEvent) => {
    if (!window.confirm(`Remove the “${trackingLabel(trackingEvent.status)}” update? Customers will no longer see it.`)) return;
    setRemovingId(trackingEvent.id);
    setError("");
    setSuccess("");
    try {
      const data = await request(`/${trackingEvent.id}`, { method: "DELETE" });
      onOrderChange(data.data);
      setSuccess(data.message);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <section className="card shadow-sm admin-tracking mt-4">
      <div className="card-header bg-white d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h5 className="mb-0">Delivery tracking</h5>
          <small className="text-muted">Updates appear on the customer’s order page within seconds.</small>
        </div>
        <div className="admin-tracking-now">
          <span>Current location</span>
          <strong>{lastKnownLocation(events) || "Not shared yet"}</strong>
        </div>
      </div>
      <div className="card-body">
        {error && <div className="alert alert-danger py-2" role="alert">{error}</div>}
        {success && <div className="alert alert-success py-2" role="status">{success}</div>}
        {!readOnly && <form onSubmit={submit} className="admin-tracking-form">
          <div className="row g-3">
            <div className="col-md-6">
              <label htmlFor="tracking-status" className="form-label">Shipment status</label>
              <select id="tracking-status" className="form-select" value={update.status} onChange={(event) => chooseStatus(event.target.value)}>
                {Object.entries(TRACKING_STATUSES).map(([value, meta]) => <option key={value} value={value}>{meta.label}</option>)}
              </select>
            </div>
            <div className="col-md-6">
              <label htmlFor="tracking-location" className="form-label">Current location</label>
              <input id="tracking-location" className="form-control" list="tracking-known-locations" placeholder="e.g. Delhi sorting hub" maxLength={255} value={update.location} onChange={(event) => setUpdate((current) => ({ ...current, location: event.target.value }))} />
              <datalist id="tracking-known-locations">{knownLocations.map((location) => <option key={location} value={location} />)}</datalist>
            </div>
            <div className="col-md-8">
              <label htmlFor="tracking-note" className="form-label">Message for the customer</label>
              <input id="tracking-note" className="form-control" maxLength={1000} value={update.description} onChange={(event) => { setNoteEdited(true); setUpdate((current) => ({ ...current, description: event.target.value })); }} />
            </div>
            <div className="col-md-4">
              <label htmlFor="tracking-time" className="form-label">Update time</label>
              <input id="tracking-time" type="datetime-local" className="form-control" value={update.event_at} onChange={(event) => setUpdate((current) => ({ ...current, event_at: event.target.value }))} />
              <div className="form-text">Leave blank for now.</div>
            </div>
          </div>
          <div className="d-flex flex-wrap align-items-center gap-3 mt-3">
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Publishing…" : "Publish tracking update"}</button>
            <small className="text-muted">Order status moves to <strong className="text-capitalize">{{ order_placed: "pending", confirmed: "processing", packed: "processing", delivered: "delivered", cancelled: "cancelled" }[update.status] || "shipped"}</strong>.</small>
          </div>
        </form>}

        <h6 className="admin-tracking-history-title">History</h6>
        {!events.length ? <p className="text-muted mb-0">No tracking updates yet.</p> : (
          <ol className="tracking-history tracking-history--admin">
            {events.map((trackingEvent, index) => (
              <li key={trackingEvent.id} className={index === 0 ? "is-latest" : ""}>
                <span className="tracking-history-dot" aria-hidden="true" />
                <div>
                  <strong>{trackingLabel(trackingEvent.status)}</strong>
                  {trackingEvent.location && <span className="tracking-history-location">📍 {trackingEvent.location}</span>}
                  {trackingEvent.description && <p>{trackingEvent.description}</p>}
                </div>
                <div className="text-end">
                  <time dateTime={trackingEvent.event_at} title={timeAgo(trackingEvent.event_at)}>{formatDateTime(trackingEvent.event_at)}</time>
                  {!readOnly && events.length > 1 && <button type="button" className="admin-tracking-remove" onClick={() => remove(trackingEvent)} disabled={removingId === trackingEvent.id}>{removingId === trackingEvent.id ? "Removing…" : "Remove"}</button>}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
};

export default TrackingManager;
