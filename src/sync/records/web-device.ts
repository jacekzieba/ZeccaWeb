const WEB_DEVICE_ID_KEY = "investor-web-device-id";

export function getWebDeviceId(): string {
  if (typeof localStorage === "undefined") return "web-ssr";
  let id = localStorage.getItem(WEB_DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(WEB_DEVICE_ID_KEY, id);
  }
  return id;
}

export function getWebDeviceName() {
  return "Web Browser";
}

export function getWebDevicePlatform() {
  return "web";
}
