import { commissionRequest } from "../commissions/commissions";

/** Calls a Server & health endpoint as the signed-in admin. */
export const serverRequest = (path, options) => commissionRequest("admin", path, options);

export const SERVER_TABS = [
  { key: "overview", label: "Overview" },
  { key: "problems", label: "Problems" },
  { key: "speed", label: "Speed" },
  { key: "storage", label: "Storage" },
  { key: "log", label: "Log" },
];

export const SEVERITY = {
  critical: { label: "Urgent", tone: "danger" },
  warning: { label: "Needs attention", tone: "warning" },
  info: { label: "Good to know", tone: "info" },
  ok: { label: "Healthy", tone: "ok" },
};

export const AUDIENCES = { customer: "Shoppers", seller: "Sellers", admin: "Admins", guest: "Not signed in", system: "Background tasks" };

export const SOURCES = { server: "Server", website: "Website", app: "App" };

/** 1536 → "1.5 KB" */
export function formatBytes(bytes) {
  const units = ["bytes", "KB", "MB", "GB", "TB"];
  let value = Number(bytes) || 0;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toLocaleString("en-IN", { maximumFractionDigits: unit ? 1 : 0 })} ${units[unit]}`;
}

/** 0.4 → "under 1 ms", 340 → "340 ms", 1830 → "1.8 s" */
export function formatMs(ms) {
  const value = Number(ms) || 0;
  if (value >= 1000) return `${(value / 1000).toLocaleString("en-IN", { maximumFractionDigits: 1 })} s`;
  return value > 0 && value < 1 ? "under 1 ms" : `${Math.round(value)} ms`;
}

/** "just now", "5 min ago", "3 h ago", "2 days ago" */
export function timeAgo(value) {
  if (!value) return "never";
  const seconds = Math.max(0, (Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} h ago`;
  const days = Math.floor(seconds / 86400);
  return `${days} ${days === 1 ? "day" : "days"} ago`;
}

/** 93784 → "1 day 2 h" */
export function formatUptime(seconds) {
  if (seconds == null) return "—";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return days ? `${days} ${days === 1 ? "day" : "days"} ${hours} h` : `${hours} h ${Math.floor((seconds % 3600) / 60)} min`;
}

/** "Shoppers 12 · Sellers 2" */
export const affectedText = (affected) => Object.entries(affected || {})
  .sort(([, a], [, b]) => b - a)
  .map(([who, count]) => `${AUDIENCES[who] || who} ${count}`)
  .join(" · ");

/** Commands to free disk space outside the store's own files, safe on Ubuntu. */
export const SPACE_COMMANDS = [
  { command: "df -h /", note: "How full the disk is." },
  { command: "sudo du -xh / --max-depth=2 2>/dev/null | sort -rh | head -25", note: "The biggest folders on the disk." },
  { command: "sudo journalctl --vacuum-size=100M", note: "Shrinks the system journal to 100 MB." },
  { command: "sudo apt-get clean && sudo apt-get autoremove --purge -y", note: "Removes downloaded packages and old kernels." },
  { command: "sudo find /var/log -name '*.gz' -mtime +14 -delete", note: "Deletes old compressed system logs." },
  { command: "rm -rf ~/.npm/_cacache ~/.cache/composer", note: "Clears npm and Composer download caches." },
];

/** Making the EC2 disk (EBS volume) bigger, without stopping the server. */
export const GROW_DISK_STEPS = [
  "AWS console › EC2 › Instances › your server › Storage tab › click the volume ID.",
  "Actions › Modify volume › enter the new size (e.g. 20 GiB) › Modify. Extra space costs a few cents per GB per month.",
  "Wait until the volume’s state shows “optimizing” or “completed”, then run the commands below on the server.",
];

export const GROW_DISK_COMMANDS = [
  "lsblk",
  "sudo growpart /dev/nvme0n1 1   # or /dev/xvda 1 — use the disk name lsblk shows",
  "sudo resize2fs /dev/root",
  "df -h /",
];
