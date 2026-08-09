import { getChatGPTUser } from "../../chatgpt-auth";

const ADMIN_EMAILS = new Set(["doliy4784@gmail.com"]);

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ role: "employee", name: "Employee" });
  return Response.json({
    role: ADMIN_EMAILS.has(user.email.toLowerCase()) ? "admin" : "employee",
    name: user.fullName ?? user.email,
  });
}
