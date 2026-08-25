import "dotenv/config";
import { Resend } from "resend";

const resend = new Resend(
  process.env.RESEND_API_KEY
);

async function testEmail() {
  try {
    const { data, error } =
      await resend.emails.send({
        from: "MySchoolLearn <onboarding@resend.dev>",
        to: "akindeledby86@gmail.com",
        subject: "MySchoolLearn Test Email",
        html: `
          <h2>MySchoolLearn Email Test</h2>

          <p>
            If you received this email,
            Resend is working correctly.
          </p>
        `,
      });

    if (error) {
      console.error(
        "Resend returned an error:",
        error
      );

      return;
    }

    console.log(
      "Email sent successfully:"
    );

    console.log(data);
  } catch (error) {
    console.error(
      "Failed to send email:",
      error
    );
  }
}

testEmail();