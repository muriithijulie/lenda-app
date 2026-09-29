import { getValue, setValue } from "./store";

export async function logActivity(icon, cls, text) {
  const activity = (await getValue("activity")) || [];
  activity.unshift({ icon, cls, text, time: new Date().toLocaleString() });
  await setValue("activity", activity.slice(0, 20));
}
