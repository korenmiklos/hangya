export async function requestNotificationPermission(): Promise<boolean> {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export function sendNotification(title: string, body: string): void {
  if (Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: "/favicon.svg",
      badge: "/favicon.svg",
    });
  }
}

export async function registerServiceWorker(): Promise<void> {
  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("/sw.js");
    } catch (e) {
      console.warn("SW registration failed:", e);
    }
  }
}
