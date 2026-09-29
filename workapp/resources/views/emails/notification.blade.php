<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

  <!-- Outer wrapper -->
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 16px;">
    <tr>
      <td align="center">

        <!-- Card -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">

          <!-- Blue header -->
          <tr>
            <td style="background-color:#1d4ed8;padding:28px 32px;">
              <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">{{ config('app.name') }}</p>
              <p style="margin:6px 0 0;font-size:13px;color:#bfdbfe;">You have a new notification</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;font-size:17px;font-weight:700;color:#111827;">{{ $notifTitle }}</p>
              <p style="margin:0 0 28px;font-size:15px;color:#4b5563;line-height:1.65;">{{ $notifMessage }}</p>

              @if($actionUrl)
              <!-- Button — inline everything so Gmail renders correctly -->
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background-color:#1d4ed8;border-radius:7px;">
                    <a href="{{ $actionUrl }}"
                       target="_blank"
                       style="display:inline-block;padding:12px 26px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:7px;background-color:#1d4ed8;mso-padding-alt:0;">
                      <!--[if mso]>&nbsp;<![endif]-->
                      {{ $actionLabel }}
                      <!--[if mso]>&nbsp;<![endif]-->
                    </a>
                  </td>
                </tr>
              </table>
              @endif
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 32px;">
              <hr style="border:none;border-top:1px solid #f3f4f6;margin:0;" />
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px 28px;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.6;">
                You are receiving this email because an action was taken on your
                <strong style="color:#6b7280;">{{ config('app.name') }}</strong> account.
                If this wasn't you, please ignore this email.
              </p>
              @if($actionUrl)
              <p style="margin:10px 0 0;font-size:12px;color:#9ca3af;">
                If the button above doesn't work, copy and paste this link into your browser:<br />
                <a href="{{ $actionUrl }}" style="color:#1d4ed8;word-break:break-all;">{{ $actionUrl }}</a>
              </p>
              @endif
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>

</body>
</html>
