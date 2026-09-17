import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function sendEmailMessage(req, res) {
  try {
    const { name, email, message } = req.body;

    // Validate required fields
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "Name, email and message are required.",
      });
    }

    // Validate name
    if (typeof name !== "string" || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid name.",
      });
    }

    // Validate email
    if (typeof email !== "string") {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address.",
      });
    }

    // Validate message
    if (typeof message !== "string" || message.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: "Message must be at least 10 characters long.",
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim();
    const cleanMessage = message.trim();

    // Escape values before inserting into HTML
    const safeName = escapeHtml(cleanName);
    const safeEmail = escapeHtml(cleanEmail);
    const safeMessage = escapeHtml(cleanMessage).replace(/\n/g, "<br>");

    const { data, error } = await resend.emails.send({
      from: "MySchoolLearn <hello@myschoollearn.com>",

      to: [
        "hello@myschoollearn.com",
        "akindeledby86@gmail.com",
      ],

      // Replies will go directly to the person who submitted the form
      replyTo: cleanEmail,

      subject: `New Message from ${cleanName}`,

      text: `
New message from MySchoolLearn website.

Name:
${cleanName}

Email:
${cleanEmail}

Message:
${cleanMessage}
      `.trim(),

      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
          <h2 style="color: #1f2937;">
            New Message from MySchoolLearn Website
          </h2>

          <div style="margin-top: 20px;">
            <p>
              <strong>Name:</strong><br />
              ${safeName}
            </p>

            <p>
              <strong>Email:</strong><br />
              ${safeEmail}
            </p>

            <p>
              <strong>Message:</strong><br />
              ${safeMessage}
            </p>
          </div>

          <hr style="margin: 25px 0; border: none; border-top: 1px solid #ddd;" />

          <p style="font-size: 13px; color: #777;">
            This message was submitted through the MySchoolLearn website
            contact form.
          </p>
        </div>
      `,
    });

    if (error) {
      console.error("[sendContactEmail] Resend error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to send email.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Your message has been sent successfully.",
      emailId: data?.id || null,
    });
  } catch (error) {
    console.error("[sendContactEmail] Unexpected error:", error);

    return res.status(500).json({
      success: false,
      message: "An unexpected error occurred while sending the email.",
    });
  }
}