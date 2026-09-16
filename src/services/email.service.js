import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FRONTEND_URL =
  process.env.FRONTEND_URL ||
    "https://myschoollearn.com";


export async function sendPasswordEmail({
  to,
  subject,
  html,
}) {
  const { data, error } = await resend.emails.send({
    from: "MySchoolLearn <noreply@myschoollearn.com>",
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


export async function sendWelcomeEmail({
  to,
  firstName,
  lastName,
  invitationCode,
}) {
  const fullName =
    `${firstName || ""} ${lastName || ""}`.trim();

  /*
   * Generate this user's personal invitation link.
   */
  const invitationLink = invitationCode
    ? `${FRONTEND_URL}/auth?mode=register&invitationCode=${encodeURIComponent(
        invitationCode
      )}`
    : null;

  const { data, error } = await resend.emails.send({
    from:
      process.env.EMAIL_FROM ||
      "MySchoolLearn <hello@myschoollearn.com>",

    to: [to],

    subject:
      "Welcome to MySchoolLearn | Complete Your Registration and Start Learning",

    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />

        <title>Welcome to MySchoolLearn</title>
      </head>

      <body
        style="
          margin: 0;
          padding: 0;
          background-color: #f3f4f6;
          font-family: Arial, Helvetica, sans-serif;
          color: #111827;
        "
      >
        <table
          width="100%"
          cellpadding="0"
          cellspacing="0"
          border="0"
          style="
            background-color: #f3f4f6;
            padding: 40px 15px;
          "
        >
          <tr>
            <td align="center">

              <table
                width="100%"
                cellpadding="0"
                cellspacing="0"
                border="0"
                style="
                  max-width: 620px;
                  background-color: #ffffff;
                  border-radius: 16px;
                  overflow: hidden;
                  box-shadow: 0 4px 20px rgba(0,0,0,0.06);
                "
              >

                <!-- HEADER -->
                <tr>
                  <td
                    style="
                      background-color: #4f46e5;
                      padding: 34px 30px;
                      text-align: center;
                    "
                  >
                    <div
                      style="
                        font-size: 28px;
                        font-weight: 700;
                        color: #ffffff;
                        letter-spacing: -0.5px;
                      "
                    >
                      MySchool<span style="color:#c7d2fe;">Learn</span>
                    </div>

                    <div
                      style="
                        margin-top: 9px;
                        font-size: 14px;
                        color: #e0e7ff;
                        line-height: 1.5;
                      "
                    >
                      Personalized learning. Better outcomes.
                    </div>
                  </td>
                </tr>

                <!-- MAIN CONTENT -->
                <tr>
                  <td style="padding: 40px 35px;">

                    <!-- WELCOME -->
                    <h1
                      style="
                        margin: 0 0 18px 0;
                        font-size: 26px;
                        line-height: 1.3;
                        color: #111827;
                      "
                    >
                      Welcome${fullName ? `, ${fullName}` : ""}! 🎉
                    </h1>

                    <p
                      style="
                        margin: 0 0 18px 0;
                        font-size: 16px;
                        line-height: 1.7;
                        color: #4b5563;
                      "
                    >
                      Thank you for joining
                      <strong>MySchoolLearn</strong>.
                      Your account has been created successfully,
                      and we are excited to have you as part of our
                      learning community.
                    </p>

                    <p
                      style="
                        margin: 0 0 25px 0;
                        font-size: 16px;
                        line-height: 1.7;
                        color: #4b5563;
                      "
                    >
                      You are now just a few steps away from getting
                      the most out of your MySchoolLearn experience.
                      Sign in and visit your
                      <strong>Profile & Settings</strong>
                      menu to select your account role and complete
                      any remaining profile information.
                    </p>

                    <!-- COMPLETE REGISTRATION -->
                    <table
                      width="100%"
                      cellpadding="0"
                      cellspacing="0"
                      border="0"
                      style="
                        background-color: #eef2ff;
                        border: 1px solid #c7d2fe;
                        border-radius: 12px;
                        margin: 25px 0;
                      "
                    >
                      <tr>
                        <td style="padding: 22px;">

                          <div
                            style="
                              font-size: 16px;
                              font-weight: 700;
                              color: #3730a3;
                              margin-bottom: 12px;
                            "
                          >
                            Complete your registration
                          </div>

                          <div
                            style="
                              font-size: 14px;
                              line-height: 1.7;
                              color: #4338ca;
                            "
                          >
                            Sign in to your MySchoolLearn account,
                            open
                            <strong>Profile & Settings</strong>,
                            select your account role and complete
                            any remaining profile information.
                          </div>

                        </td>
                      </tr>
                    </table>

                    <!-- SIGN IN BUTTON -->
                    <table
                      width="100%"
                      cellpadding="0"
                      cellspacing="0"
                      border="0"
                      style="margin: 30px 0;"
                    >
                      <tr>
                        <td align="center">

                          <a
                            href="${FRONTEND_URL}/auth"
                            style="
                              display: inline-block;
                              background-color: #4f46e5;
                              color: #ffffff;
                              text-decoration: none;
                              font-size: 15px;
                              font-weight: 700;
                              padding: 14px 28px;
                              border-radius: 8px;
                            "
                          >
                            Sign In to MySchoolLearn
                          </a>

                        </td>
                      </tr>
                    </table>

                    <!-- CHROME RECOMMENDATION -->
                    <table
                      width="100%"
                      cellpadding="0"
                      cellspacing="0"
                      border="0"
                      style="
                        background-color: #fff7ed;
                        border: 1px solid #fed7aa;
                        border-radius: 12px;
                        margin: 30px 0;
                      "
                    >
                      <tr>
                        <td style="padding: 23px;">

                          <div
                            style="
                              font-size: 17px;
                              font-weight: 700;
                              color: #9a3412;
                              margin-bottom: 10px;
                            "
                          >
                            🌐 For Students and Pupils
                          </div>

                          <p
                            style="
                              margin: 0 0 12px 0;
                              font-size: 14px;
                              line-height: 1.7;
                              color: #9a3412;
                            "
                          >
                            For the best MySchoolLearn learning
                            experience, we recommend that students
                            and pupils use the latest version of
                            <strong>Google Chrome</strong> when
                            accessing their lessons, AI Tutor,
                            homework, tests, examinations and other
                            learning activities.
                          </p>

                          <p
                            style="
                              margin: 0;
                              font-size: 13px;
                              line-height: 1.6;
                              color: #c2410c;
                            "
                          >
                            Using Google Chrome can help provide a
                            smoother and more reliable learning
                            experience, especially when using
                            interactive learning features.
                          </p>

                        </td>
                      </tr>
                    </table>

                    <!-- REFERRAL PROGRAM -->
                    ${
                      invitationCode && invitationLink
                        ? `
                    <table
                      width="100%"
                      cellpadding="0"
                      cellspacing="0"
                      border="0"
                      style="
                        background-color: #f0fdf4;
                        border: 1px solid #bbf7d0;
                        border-radius: 12px;
                        margin: 30px 0;
                      "
                    >
                      <tr>
                        <td style="padding: 24px;">

                          <div
                            style="
                              font-size: 18px;
                              font-weight: 700;
                              color: #166534;
                              margin-bottom: 10px;
                            "
                          >
                            Invite others and earn commissions 🎁
                          </div>

                          <p
                            style="
                              margin: 0 0 18px 0;
                              font-size: 14px;
                              line-height: 1.7;
                              color: #166534;
                            "
                          >
                            You also have your own
                            <strong>MySchoolLearn invitation code</strong>.
                            Share it with friends, parents, students,
                            teachers, schools or anyone who may benefit
                            from MySchoolLearn.
                          </p>

                          <p
                            style="
                              margin: 0 0 18px 0;
                              font-size: 14px;
                              line-height: 1.7;
                              color: #166534;
                            "
                          >
                            When eligible users join through your
                            invitation and make qualifying
                            subscriptions, you may earn a
                            <strong>commission</strong> according to
                            the MySchoolLearn referral program.
                          </p>

                          <!-- INVITATION CODE -->
                          <div
                            style="
                              background-color: #ffffff;
                              border: 1px solid #bbf7d0;
                              border-radius: 8px;
                              padding: 15px;
                              margin: 18px 0;
                            "
                          >
                            <div
                              style="
                                font-size: 11px;
                                font-weight: 700;
                                text-transform: uppercase;
                                letter-spacing: 1px;
                                color: #6b7280;
                                margin-bottom: 7px;
                              "
                            >
                              Your Invitation Code
                            </div>

                            <div
                              style="
                                font-family: monospace;
                                font-size: 20px;
                                font-weight: 700;
                                letter-spacing: 1px;
                                color: #166534;
                              "
                            >
                              ${invitationCode}
                            </div>
                          </div>

                          <!-- INVITATION LINK -->
                          <div
                            style="
                              background-color: #ffffff;
                              border: 1px solid #bbf7d0;
                              border-radius: 8px;
                              padding: 15px;
                              margin: 18px 0;
                            "
                          >
                            <div
                              style="
                                font-size: 11px;
                                font-weight: 700;
                                text-transform: uppercase;
                                letter-spacing: 1px;
                                color: #6b7280;
                                margin-bottom: 7px;
                              "
                            >
                              Your Invitation Link
                            </div>

                            <a
                              href="${invitationLink}"
                              style="
                                color: #4f46e5;
                                font-size: 13px;
                                line-height: 1.5;
                                word-break: break-all;
                                text-decoration: none;
                              "
                            >
                              ${invitationLink}
                            </a>
                          </div>

                          <!-- REFERRAL CTA -->
                          <table
                            width="100%"
                            cellpadding="0"
                            cellspacing="0"
                            border="0"
                            style="margin-top: 20px;"
                          >
                            <tr>
                              <td align="center">

                                <a
                                  href="${invitationLink}"
                                  style="
                                    display: inline-block;
                                    background-color: #16a34a;
                                    color: #ffffff;
                                    text-decoration: none;
                                    font-size: 14px;
                                    font-weight: 700;
                                    padding: 12px 22px;
                                    border-radius: 8px;
                                  "
                                >
                                  Invite Someone to MySchoolLearn
                                </a>

                              </td>
                            </tr>
                          </table>

                        </td>
                      </tr>
                    </table>
                    `
                        : ""
                    }

                    <!-- FEATURES -->
                    <div
                      style="
                        margin-top: 30px;
                        padding-top: 25px;
                        border-top: 1px solid #e5e7eb;
                      "
                    >

                      <div
                        style="
                          font-size: 15px;
                          font-weight: 700;
                          color: #111827;
                          margin-bottom: 15px;
                        "
                      >
                        Your MySchoolLearn journey starts here
                      </div>

                      <p
                        style="
                          margin: 8px 0;
                          font-size: 14px;
                          line-height: 1.6;
                          color: #6b7280;
                        "
                      >
                        ✓ Personalized learning resources
                      </p>

                      <p
                        style="
                          margin: 8px 0;
                          font-size: 14px;
                          line-height: 1.6;
                          color: #6b7280;
                        "
                      >
                        ✓ Voice enabled AI Tutor
                      </p>

                      <p
                        style="
                          margin: 8px 0;
                          font-size: 14px;
                          line-height: 1.6;
                          color: #6b7280;
                        "
                      >
                        ✓ Video lessons and homework assistance
                      </p>

                      <p
                        style="
                          margin: 8px 0;
                          font-size: 14px;
                          line-height: 1.6;
                          color: #6b7280;
                        "
                      >
                        ✓ Test and examination preparation
                      </p>

                      <p
                        style="
                          margin: 8px 0;
                          font-size: 14px;
                          line-height: 1.6;
                          color: #6b7280;
                        "
                      >
                        ✓ Progress tracking and academic performance
                        insights
                      </p>

                      <p
                        style="
                          margin: 8px 0;
                          font-size: 14px;
                          line-height: 1.6;
                          color: #6b7280;
                        "
                      >
                        ✓ Interactive games and learning challenges
                      </p>

                    </div>

                    <!-- SUPPORT -->
                    <p
                      style="
                        margin: 30px 0 0 0;
                        font-size: 14px;
                        line-height: 1.7;
                        color: #6b7280;
                      "
                    >
                      If you did not create this account, please
                      contact the MySchoolLearn support team.
                    </p>

                  </td>
                </tr>

                <!-- FOOTER -->
                <tr>
                  <td
                    style="
                      background-color: #f9fafb;
                      border-top: 1px solid #e5e7eb;
                      padding: 25px 35px;
                      text-align: center;
                    "
                  >

                    <p
                      style="
                        margin: 0 0 8px 0;
                        font-size: 13px;
                        color: #6b7280;
                      "
                    >
                      © ${new Date().getFullYear()} MySchoolLearn.
                      All rights reserved.
                    </p>

                    <p
                      style="
                        margin: 0;
                        font-size: 12px;
                        color: #9ca3af;
                      "
                    >
                      Learn smarter. Practice better. Achieve more.
                    </p>

                  </td>
                </tr>

              </table>

            </td>
          </tr>
        </table>
      </body>
      </html>
    `,
  });

  if (error) {
    throw error;
  }

  return data;
}


// export async function sendWelcomeEmail({
//   to,
//   firstName,
//   lastName,
//   invitationCode,
// }) {
//   const fullName =
//     `${firstName || ""} ${lastName || ""}`.trim();

//   /*
//    * Generate this user's personal invitation link.
//    */
//   const invitationLink = invitationCode
//     ? `${FRONTEND_URL}/auth?mode=register&invitationCode=${encodeURIComponent(
//         invitationCode
//       )}`
//     : null;

//   const { data, error } = await resend.emails.send({
//     from:
//       process.env.EMAIL_FROM ||
//       "MySchoolLearn <hello@myschoollearn.com>",

//     to: [to],

//     subject:
//       "Welcome to MySchoolLearn — Complete Your Registration & Start Earning",

//     html: `
//       <!DOCTYPE html>
//       <html lang="en">
//       <head>
//         <meta charset="UTF-8" />
//         <meta
//           name="viewport"
//           content="width=device-width, initial-scale=1.0"
//         />

//         <title>Welcome to MySchoolLearn</title>
//       </head>

//       <body
//         style="
//           margin: 0;
//           padding: 0;
//           background-color: #f3f4f6;
//           font-family: Arial, Helvetica, sans-serif;
//           color: #111827;
//         "
//       >
//         <table
//           width="100%"
//           cellpadding="0"
//           cellspacing="0"
//           border="0"
//           style="
//             background-color: #f3f4f6;
//             padding: 40px 15px;
//           "
//         >
//           <tr>
//             <td align="center">

//               <table
//                 width="100%"
//                 cellpadding="0"
//                 cellspacing="0"
//                 border="0"
//                 style="
//                   max-width: 620px;
//                   background-color: #ffffff;
//                   border-radius: 16px;
//                   overflow: hidden;
//                   box-shadow: 0 4px 20px rgba(0,0,0,0.06);
//                 "
//               >

//                 <!-- HEADER -->
//                 <tr>
//                   <td
//                     style="
//                       background-color: #4f46e5;
//                       padding: 32px 35px;
//                       text-align: center;
//                     "
//                   >
//                     <div
//                       style="
//                         font-size: 28px;
//                         font-weight: 700;
//                         color: #ffffff;
//                         letter-spacing: -0.5px;
//                       "
//                     >
//                       MySchool<span style="color:#c7d2fe;">Learn</span>
//                     </div>

//                     <div
//                       style="
//                         margin-top: 8px;
//                         font-size: 14px;
//                         color: #e0e7ff;
//                       "
//                     >
//                       Personalized learning. Better outcomes.
//                     </div>
//                   </td>
//                 </tr>

//                 <!-- MAIN CONTENT -->
//                 <tr>
//                   <td style="padding: 40px 35px;">

//                     <!-- WELCOME -->
//                     <h1
//                       style="
//                         margin: 0 0 18px 0;
//                         font-size: 26px;
//                         line-height: 1.3;
//                         color: #111827;
//                       "
//                     >
//                       Welcome${fullName ? `, ${fullName}` : ""}! 🎉
//                     </h1>

//                     <p
//                       style="
//                         margin: 0 0 18px 0;
//                         font-size: 16px;
//                         line-height: 1.7;
//                         color: #4b5563;
//                       "
//                     >
//                       Thank you for joining
//                       <strong>MySchoolLearn</strong>.
//                       Your account has been created successfully,
//                       and we are excited to have you as part of our
//                       learning community.
//                     </p>

//                     <p
//                       style="
//                         margin: 0 0 25px 0;
//                         font-size: 16px;
//                         line-height: 1.7;
//                         color: #4b5563;
//                       "
//                     >
//                       You are just a few steps away from getting
//                       the most out of your MySchoolLearn experience.
//                       Please sign in and visit your
//                       <strong>Profile & Settings</strong>
//                       menu to select your account role and complete
//                       your registration.
//                     </p>

//                     <!-- COMPLETE REGISTRATION -->
//                     <table
//                       width="100%"
//                       cellpadding="0"
//                       cellspacing="0"
//                       border="0"
//                       style="
//                         background-color: #eef2ff;
//                         border: 1px solid #c7d2fe;
//                         border-radius: 12px;
//                         margin: 25px 0;
//                       "
//                     >
//                       <tr>
//                         <td style="padding: 22px;">

//                           <div
//                             style="
//                               font-size: 16px;
//                               font-weight: 700;
//                               color: #3730a3;
//                               margin-bottom: 12px;
//                             "
//                           >
//                             Complete your registration
//                           </div>

//                           <div
//                             style="
//                               font-size: 14px;
//                               line-height: 1.7;
//                               color: #4338ca;
//                             "
//                           >
//                             Sign in to your MySchoolLearn account,
//                             open
//                             <strong>Profile & Settings</strong>,
//                             select your account role and complete
//                             any remaining profile information.
//                           </div>

//                         </td>
//                       </tr>
//                     </table>

//                     <!-- SIGN IN BUTTON -->
//                     <table
//                       width="100%"
//                       cellpadding="0"
//                       cellspacing="0"
//                       border="0"
//                       style="margin: 30px 0;"
//                     >
//                       <tr>
//                         <td align="center">

//                           <a
//                             href="${FRONTEND_URL}/auth"
//                             style="
//                               display: inline-block;
//                               background-color: #4f46e5;
//                               color: #ffffff;
//                               text-decoration: none;
//                               font-size: 15px;
//                               font-weight: 700;
//                               padding: 14px 28px;
//                               border-radius: 8px;
//                             "
//                           >
//                             Sign In to MySchoolLearn
//                           </a>

//                         </td>
//                       </tr>
//                     </table>

//                     <!-- REFERRAL PROGRAM -->
//                     ${
//                       invitationCode && invitationLink
//                         ? `
//                     <table
//                       width="100%"
//                       cellpadding="0"
//                       cellspacing="0"
//                       border="0"
//                       style="
//                         background-color: #f0fdf4;
//                         border: 1px solid #bbf7d0;
//                         border-radius: 12px;
//                         margin: 30px 0;
//                       "
//                     >
//                       <tr>
//                         <td style="padding: 24px;">

//                           <div
//                             style="
//                               font-size: 18px;
//                               font-weight: 700;
//                               color: #166534;
//                               margin-bottom: 10px;
//                             "
//                           >
//                             Invite others and earn commissions 🎁
//                           </div>

//                           <p
//                             style="
//                               margin: 0 0 18px 0;
//                               font-size: 14px;
//                               line-height: 1.7;
//                               color: #166534;
//                             "
//                           >
//                             You also have your own
//                             <strong>MySchoolLearn invitation code</strong>.
//                             Share it with friends, parents, students,
//                             teachers, schools, or anyone who may benefit
//                             from MySchoolLearn.
//                           </p>

//                           <p
//                             style="
//                               margin: 0 0 18px 0;
//                               font-size: 14px;
//                               line-height: 1.7;
//                               color: #166534;
//                             "
//                           >
//                             When eligible users join through your
//                             invitation and make qualifying subscriptions,
//                             you may earn a
//                             <strong>commission</strong>
//                             according to the MySchoolLearn referral
//                             program.
//                           </p>

//                           <!-- INVITATION CODE -->
//                           <div
//                             style="
//                               background-color: #ffffff;
//                               border: 1px solid #bbf7d0;
//                               border-radius: 8px;
//                               padding: 15px;
//                               margin: 18px 0;
//                             "
//                           >
//                             <div
//                               style="
//                                 font-size: 11px;
//                                 font-weight: 700;
//                                 text-transform: uppercase;
//                                 letter-spacing: 1px;
//                                 color: #6b7280;
//                                 margin-bottom: 7px;
//                               "
//                             >
//                               Your Invitation Code
//                             </div>

//                             <div
//                               style="
//                                 font-family: monospace;
//                                 font-size: 20px;
//                                 font-weight: 700;
//                                 letter-spacing: 1px;
//                                 color: #166534;
//                               "
//                             >
//                               ${invitationCode}
//                             </div>
//                           </div>

//                           <!-- INVITATION LINK -->
//                           <div
//                             style="
//                               background-color: #ffffff;
//                               border: 1px solid #bbf7d0;
//                               border-radius: 8px;
//                               padding: 15px;
//                               margin: 18px 0;
//                             "
//                           >
//                             <div
//                               style="
//                                 font-size: 11px;
//                                 font-weight: 700;
//                                 text-transform: uppercase;
//                                 letter-spacing: 1px;
//                                 color: #6b7280;
//                                 margin-bottom: 7px;
//                               "
//                             >
//                               Your Invitation Link
//                             </div>

//                             <a
//                               href="${invitationLink}"
//                               style="
//                                 color: #4f46e5;
//                                 font-size: 13px;
//                                 line-height: 1.5;
//                                 word-break: break-all;
//                                 text-decoration: none;
//                               "
//                             >
//                               ${invitationLink}
//                             </a>
//                           </div>

//                           <!-- REFERRAL CTA -->
//                           <table
//                             width="100%"
//                             cellpadding="0"
//                             cellspacing="0"
//                             border="0"
//                             style="margin-top: 20px;"
//                           >
//                             <tr>
//                               <td align="center">

//                                 <a
//                                   href="${invitationLink}"
//                                   style="
//                                     display: inline-block;
//                                     background-color: #16a34a;
//                                     color: #ffffff;
//                                     text-decoration: none;
//                                     font-size: 14px;
//                                     font-weight: 700;
//                                     padding: 12px 22px;
//                                     border-radius: 8px;
//                                   "
//                                 >
//                                   Invite Someone to MySchoolLearn
//                                 </a>

//                               </td>
//                             </tr>
//                           </table>

//                         </td>
//                       </tr>
//                     </table>
//                     `
//                         : ""
//                     }

//                     <!-- FEATURES -->
//                     <div
//                       style="
//                         margin-top: 30px;
//                         padding-top: 25px;
//                         border-top: 1px solid #e5e7eb;
//                       "
//                     >

//                       <div
//                         style="
//                           font-size: 15px;
//                           font-weight: 700;
//                           color: #111827;
//                           margin-bottom: 15px;
//                         "
//                       >
//                         Your MySchoolLearn journey starts here
//                       </div>

//                       <p
//                         style="
//                           margin: 8px 0;
//                           font-size: 14px;
//                           line-height: 1.6;
//                           color: #6b7280;
//                         "
//                       >
//                         ✓ Personalized learning resources
//                       </p>

//                       <p
//                         style="
//                           margin: 8px 0;
//                           font-size: 14px;
//                           line-height: 1.6;
//                           color: #6b7280;
//                         "
//                       >
//                         ✓ AI-powered learning assistance
//                       </p>

//                       <p
//                         style="
//                           margin: 8px 0;
//                           font-size: 14px;
//                           line-height: 1.6;
//                           color: #6b7280;
//                         "
//                       >
//                         ✓ Lessons, homework and examination preparation
//                       </p>

//                       <p
//                         style="
//                           margin: 8px 0;
//                           font-size: 14px;
//                           line-height: 1.6;
//                           color: #6b7280;
//                         "
//                       >
//                         ✓ Progress tracking and performance insights
//                       </p>

//                     </div>

//                     <!-- SUPPORT -->
//                     <p
//                       style="
//                         margin: 30px 0 0 0;
//                         font-size: 14px;
//                         line-height: 1.7;
//                         color: #6b7280;
//                       "
//                     >
//                       If you did not create this account, please
//                       contact the MySchoolLearn support team.
//                     </p>

//                   </td>
//                 </tr>

//                 <!-- FOOTER -->
//                 <tr>
//                   <td
//                     style="
//                       background-color: #f9fafb;
//                       border-top: 1px solid #e5e7eb;
//                       padding: 25px 35px;
//                       text-align: center;
//                     "
//                   >

//                     <p
//                       style="
//                         margin: 0 0 8px 0;
//                         font-size: 13px;
//                         color: #6b7280;
//                       "
//                     >
//                       © ${new Date().getFullYear()} MySchoolLearn.
//                       All rights reserved.
//                     </p>

//                     <p
//                       style="
//                         margin: 0;
//                         font-size: 12px;
//                         color: #9ca3af;
//                       "
//                     >
//                       Unlock your potential with personalized learning.
//                     </p>

//                   </td>
//                 </tr>

//               </table>

//             </td>
//           </tr>
//         </table>
//       </body>
//       </html>
//     `,
//   });

//   if (error) {
//     throw error;
//   }

//   return data;
// }