import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail({
  to,
  subject,
  html,
}) {
  const { data, error } = await resend.emails.send({
    from: "MySchoolLearn <hello@myschoollearn.com>",
    to,
    subject,
    html,
  });

  if (error) {
    console.error("[Resend] Email error:", error);

    throw new Error(
      error.message || "Unable to send email"
    );
  }

  console.log("[Resend] Email sent:", data?.id);

  return data;
}

// import { Resend } from "resend";

// const resend = new Resend(
//   process.env.RESEND_API_KEY
// );

// export async function sendEmail({
//   to,
//   subject,
//   html,
// }) {
//   const { data, error } =
//     await resend.emails.send({
//       from: "MySchoolLearn <onboarding@resend.dev>",
//       to,
//       subject,
//       html,
//     });

//   if (error) {
//     console.error(
//       "[Resend] Email error:",
//       error
//     );

//     throw new Error(
//       error.message ||
//         "Unable to send email"
//     );
//   }

//   console.log(
//     "[Resend] Email sent:",
//     data?.id
//   );

//   return data;
// }