import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="card" style={{ maxWidth: 440, margin: "40px auto" }}>
      <h1>Sign in</h1>
      <p className="muted">Mailbox Order Manager — internal tool</p>
      <LoginForm />
      <p className="muted" style={{ marginTop: 16 }}>
        Demo accounts (seeded):<br />
        Admin — <code>admin@iyrix.test</code> / <code>Admin123!</code>
        <br />
        Customer — <code>customer@demo.test</code> / <code>Customer123!</code>
      </p>
    </div>
  );
}
