import { doSignIn } from "../actions";

export default function SignIn() {
  return (
    <div className="signin-wrap">
      <div className="signin-card">
        <div className="signin-logo">🔮</div>
        <h1>Astro Marketing Intelligence</h1>
        <p>Sign in to access the dashboard. Access is restricted to approved accounts.</p>
        <form action={doSignIn}>
          <button className="google-btn" type="submit">
            <span className="g">G</span> Sign in with Google
          </button>
        </form>
      </div>
    </div>
  );
}
