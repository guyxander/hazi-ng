export function getAutomationServerSecret() {
  const secret = process.env.WALLET_SERVER_SECRET || process.env.AUTOMATION_SERVER_SECRET;

  if (!secret) {
    throw new Error("Automation server secret is not configured.");
  }

  return secret;
}
