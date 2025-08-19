const Subscription = require("../models/Subscription");
const User = require("../models/users");
const moment = require("moment-timezone");
const nodemailer = require("nodemailer");

// Configure your email transporter (example using Gmail / SMTP)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtpout.secureserver.net",
  port: process.env.SMTP_PORT || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER || "team@xalgos.in",
    pass: process.env.SMTP_PASS || "Xalgoglobal@456",
  },
});

// Stylized HTML email template generator for days 3 and 2
function generateEmailHTML(username, brokerName, daysLeft, expiryDate) {
  return `
    <body style="margin: 0; background-color: #f4f6f8; font-family: 'Open Sans', sans-serif;">
  <table width="100%" bgcolor="#f4f6f8" cellpadding="0" cellspacing="0">
    <tr>
      <td>
        <table align="center" width="100%" style="max-width: 650px; margin: 40px auto; background: #ffffff; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 20px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; color: var(--text-color);">Subscription Expiry Alert</h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 30px; color: #333333; font-size: 16px; line-height: 1.6;">
              <p style="margin: 0 0 15px;">Hello <strong>${username}</strong>,</p>

              <p style="margin: 0 0 15px;">
                This is a reminder that your subscription of <strong>${brokerName}</strong> API will expire on 
                <span style="color: #d9534f;"><strong>${expiryDate} (${daysLeft} day(s) left)</strong></span>.
              </p>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 20px 30px; text-align: center; font-size: 14px; color: #777;">
              <p style="margin: 0;">Best regards,<br><strong>The X-Algos Team</strong></p>
              <p style="margin: 10px 0 0;">Need help? <a href="mailto:support@xalgos.in" style="color: #007BFF;">Contact Support</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
`;
}

// Stylized HTML email template for final day (1 day left)
function generateFinalDayEmailHTML(username, brokerName, expiryDate) {
  return `
    <body style="margin: 0; background-color: #f4f6f8; font-family: 'Open Sans', sans-serif;">
  <table width="100%" bgcolor="#f4f6f8" cellpadding="0" cellspacing="0">
    <tr>
      <td>
        <table align="center" width="100%" style="max-width: 650px; margin: 40px auto; background: #ffffff; border-radius: 10px; box-shadow: 0 4px 12px rgba(0,0,0,0.08); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 20px 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px; color: var(--text-color);">Final Subscription Expiry Alert</h1>
            </td>
          </tr>
          
          <!-- Body -->
          <tr>
            <td style="padding: 30px; color: #333333; font-size: 16px; line-height: 1.6;">
              <p style="margin: 0 0 15px;">Hello <strong>${username}</strong>,</p>

              <p style="margin: 0 0 15px;">
                This is your <strong>FINAL REMINDER</strong> that your subscription of <strong>${brokerName}</strong> API will expire 
                <span style="color: #d9534f;"><strong>tomorrow, ${expiryDate}</strong></span>.
              </p>

              <p style="margin: 0 0 15px;">
                Please note that upon expiry, all associated brokers and deployed accounts will be removed from our system. 
                To continue using our services without interruption, please renew your subscription before the expiry date.
              </p>

              <p style="margin: 0 0 15px;">
                <a href="https://xalgos.in/profile?section=Subscription" style="display: inline-block; padding: 12px 24px; background-color: #007BFF; color: #ffffff; text-decoration: none; border-radius: 5px;">Renew Now</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9f9f9; padding: 20px 30px; text-align: center; font-size: 14px; color: #777;">
              <p style="margin: 0;">Best regards,<br><strong>The X-Algos Team</strong></p>
              <p style="margin: 10px 0 0;">Need help? <a href="mailto:team@xalgos.in" style="color: #007BFF;">Contact Support</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
`;
}

const sendSubscriptionMail = async () => {
  try {
    const today = moment().tz("Asia/Kolkata").startOf("day");

    const subs = await Subscription.find({ Duration: { $ne: "3" } });

    for (const s of subs) {
      const expiryDate = moment(s.CreatedAt)
        .tz("Asia/Kolkata")
        .add(s.Duration, "days")
        .startOf("day");
      const daysLeft = expiryDate.diff(today, "days");

      if ([3, 2, 1].includes(daysLeft)) {
        const user = await User.findOne({ XalgoID: s.XalgoID });
        if (!user || !user.Email) continue;

        const isFinalDay = daysLeft === 1;
        const mailOptions = {
          from: `X-Algos <team@xalgos.in>`,
          to: user.Email,
          subject: isFinalDay
            ? `Final Subscription Expiry Notice`
            : `${daysLeft}-Day Subscription Expiry Notice`,
          html: isFinalDay
            ? generateFinalDayEmailHTML(
                user.Name,
                s.Account,
                expiryDate.format("DD-MM-YYYY")
              )
            : generateEmailHTML(
                user.Name,
                s.Account,
                daysLeft,
                expiryDate.format("DD-MM-YYYY")
              ),
        };
        await transporter.sendMail(mailOptions);
        console.log(
          `Sent ${isFinalDay ? "final" : daysLeft + "-day"} reminder to ${
            user.Email
          }`
        );
      } else if (daysLeft < 0) {
        console.log(`Deleted expired subscription for XalgoID ${s.XalgoID}`);
      }
    }
  } catch (error) {
    console.error("Error in cron job:", error);
  }
};

module.exports = sendSubscriptionMail;
