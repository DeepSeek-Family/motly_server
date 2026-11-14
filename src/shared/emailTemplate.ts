import config from "../config";
import { ICreateAccount, IResetPassword } from "../types/emailTemplate";

const BRAND = {
  name: "Motly",
  green: "#3EB46D",
  text: "#333333",
  muted: "#666666",
  light: "#999999",
  bg: "#f4f6f5",
};

const logoUrl = () => {
  const base = (config.publicApiUrl || "").replace(/\/$/, "");
  return base ? `${base}/motly-logo.png` : "/motly-logo.png";
};

const emailShell = (content: string) => `
<body style="margin:0;padding:0;background-color:${BRAND.bg};font-family:Arial,Helvetica,sans-serif;color:${BRAND.text};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:${BRAND.bg};padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.06);">
          <tr>
            <td align="center" style="padding:28px 24px 8px;">
              <img src="${logoUrl()}" alt="${BRAND.name}" width="96" style="display:block;width:96px;height:auto;border:0;border-radius:18px;" />
            </td>
          </tr>
          <tr>
            <td style="padding:32px 28px 24px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 28px;text-align:center;">
              <p style="margin:0;color:${BRAND.light};font-size:12px;line-height:1.5;">&copy; ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
`;

const otpBlock = (otp: number) => `
  <div style="text-align:center;margin:28px 0;">
    <p style="margin:0 0 12px;color:${BRAND.muted};font-size:15px;">Your single-use code is:</p>
    <div style="display:inline-block;background-color:${BRAND.green};color:#ffffff;font-size:28px;font-weight:700;letter-spacing:6px;padding:14px 28px;border-radius:10px;">${otp}</div>
    <p style="margin:14px 0 0;color:${BRAND.muted};font-size:14px;">This code is valid for 3 minutes.</p>
  </div>
`;

const createAccount = (values: ICreateAccount) => {
  const html = emailShell(`
    <h2 style="margin:0 0 12px;color:${BRAND.green};font-size:22px;">Hey, ${values.name}!</h2>
    <p style="margin:0 0 8px;color:${BRAND.muted};font-size:15px;line-height:1.6;">
      Thank you for signing up for <strong style="color:${BRAND.text};">${BRAND.name}</strong>.
      Please verify your email address to activate your account.
    </p>
    ${otpBlock(values.otp)}
    <p style="margin:0;color:${BRAND.light};font-size:12px;text-align:center;line-height:1.5;">
      If you did not sign up for ${BRAND.name}, you can safely ignore this email.
    </p>
  `);

  return {
    to: values.email,
    subject: `Verify your ${BRAND.name} account`,
    html,
  };
};

const resetPassword = (values: IResetPassword) => {
  const html = emailShell(`
    <h2 style="margin:0 0 12px;color:${BRAND.green};font-size:22px;">Reset your password</h2>
    <p style="margin:0 0 8px;color:${BRAND.muted};font-size:15px;line-height:1.6;">
      We received a request to reset the password for your <strong style="color:${BRAND.text};">${BRAND.name}</strong> account.
      Use the code below to continue.
    </p>
    ${otpBlock(values.otp)}
    <p style="margin:0;color:${BRAND.light};font-size:12px;text-align:center;line-height:1.5;">
      If you did not request a password reset, you can safely ignore this email.
    </p>
  `);

  return {
    to: values.email,
    subject: `Reset your ${BRAND.name} password`,
    html,
  };
};

export const emailTemplate = {
  createAccount,
  resetPassword,
};
